import { Injectable, Logger } from '@nestjs/common';
import { MetadataCandidate, MetadataProviderKey } from '@bookorbit/types';

import { sanitizeLogValue } from '../../../../common/utils/log-sanitize.utils';
import { ProviderConfigService } from '../../../metadata-preferences/provider-config.service';
import { ProviderThrottleError } from '../../provider-throttle.error';
import { IdentifiableProvider } from '../metadata-provider';
import { MetadataSearchParams } from '../metadata-search-params';
import { PROVIDER_LIMITS } from '../provider-constants';
import { normalizeMaxCandidates } from '../provider-utils';
import { MangabakaClient } from './mangabaka.client';
import { mapMangabakaSeries, mapMangabakaWork, pickBestCollection } from './mangabaka.mapper';
import { detectLanguageHint, extractVolumeNumber, stripVolumeMarker } from './mangabaka-title-utils';

const UUID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

// How many top series to try for volume resolution before falling back.
const VOLUME_RESOLUTION_DEPTH = 3;

@Injectable()
export class MangabakaProvider implements IdentifiableProvider {
  readonly key = MetadataProviderKey.MANGABAKA;
  readonly label = 'MangaBaka';
  readonly identifiable = true as const;

  private readonly logger = new Logger(MangabakaProvider.name);

  constructor(
    private readonly client: MangabakaClient,
    private readonly providerConfig: ProviderConfigService,
  ) {}

  async search(params: MetadataSearchParams): Promise<MetadataCandidate[]> {
    const { enabled } = await this.providerConfig.getConfig().then((c) => c.mangabaka);
    if (!enabled) return [];

    if (!params.title && !params.author) return [];

    const cleanTitle = params.title ? stripVolumeMarker(params.title) : undefined;
    const volumeNumber = params.title ? extractVolumeNumber(params.title) : undefined;
    // Search by title only - the API matches better on clean titles.
    // Author is used for candidate ranking by the pipeline, not for the search query.
    const query = cleanTitle ?? params.author ?? '';

    if (!query) return [];

    const languageHint = params.title ? detectLanguageHint(params.title) : undefined;
    const maxResults = normalizeMaxCandidates(params.maxCandidatesPerProvider, PROVIDER_LIMITS.MANGABAKA_MAX_RESULTS);

    const startedAt = Date.now();
    this.logger.log(`[MangaBaka.search] [start] query="${sanitizeLogValue(query)}" volumeNumber=${volumeNumber ?? 'none'} - search started`);

    // Prefer the stable /v1/series/search endpoint (returns full series objects).
    // Fall back to /v1/series/match (fuzzy) when search yields no candidates.
    let series = await this.client.search(query, maxResults, params.signal);
    if (series.length === 0) {
      series = await this.client.match(query, maxResults, params.signal);
    }

    // If a volume number was extracted, try to resolve a specific work for the
    // top series. Try up to VOLUME_RESOLUTION_DEPTH series before giving up.
    if (volumeNumber !== undefined && series.length > 0) {
      for (let i = 0; i < Math.min(VOLUME_RESOLUTION_DEPTH, series.length); i++) {
        const candidateSeries = series[i];
        try {
          const collections = await this.client.fetchCollections(candidateSeries.id, params.signal);
          const bestCollection = pickBestCollection(collections, languageHint);
          if (bestCollection) {
            const works = await this.client.fetchWorks(bestCollection.id, params.signal, volumeNumber);
            const matchingWork = works.find((w) => w.sequence_numeric === volumeNumber && w.count_type === 'main');
            if (matchingWork) {
              const candidate = mapMangabakaWork(matchingWork, candidateSeries);
              if (candidate) {
                this.logger.log(
                  `[MangaBaka.search] [end] durationMs=${Date.now() - startedAt} candidates=1 - search completed (volume match on series ${candidateSeries.id})`,
                );
                return [candidate];
              }
            }
          }
        } catch (err) {
          if (err instanceof ProviderThrottleError) throw err;
          this.logger.warn(
            `[MangaBaka.search] [fail] seriesId=${candidateSeries.id} volumeNumber=${volumeNumber} errorClass=${err instanceof Error ? err.constructor.name : 'Unknown'} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" - volume resolution failed for this series, trying next`,
          );
        }
      }
    }

    const candidates: MetadataCandidate[] = [];
    for (const s of series) {
      const candidate = mapMangabakaSeries(s);
      if (candidate) candidates.push(candidate);
    }
    this.logger.log(`[MangaBaka.search] [end] durationMs=${Date.now() - startedAt} candidates=${candidates.length} - search completed`);
    return candidates;
  }

  async lookupById(providerId: string, signal?: AbortSignal): Promise<MetadataCandidate | null> {
    const { enabled } = await this.providerConfig.getConfig().then((c) => c.mangabaka);
    if (!enabled) return null;

    const startedAt = Date.now();

    if (UUID_RE.test(providerId)) {
      this.logger.log(`[MangaBaka.lookupById] [start] providerId="${sanitizeLogValue(providerId)}" mode=work - lookup started`);
      const work = await this.client.fetchWork(providerId, signal);
      if (!work) {
        this.logger.log(`[MangaBaka.lookupById] [end] durationMs=${Date.now() - startedAt} found=false - lookup completed (work not found)`);
        return null;
      }
      const series = await this.client.fetchSeries(work.series_id, signal);
      if (!series) {
        this.logger.log(`[MangaBaka.lookupById] [end] durationMs=${Date.now() - startedAt} found=false - lookup completed (series not found)`);
        return null;
      }
      const candidate = mapMangabakaWork(work, series);
      this.logger.log(`[MangaBaka.lookupById] [end] durationMs=${Date.now() - startedAt} found=${candidate !== null} - lookup completed (work)`);
      return candidate;
    }

    // Fallback: treat as a numeric series ID for backwards compatibility.
    if (/^\d+$/.test(providerId) && Number.isSafeInteger(Number(providerId))) {
      this.logger.log(`[MangaBaka.lookupById] [start] providerId="${sanitizeLogValue(providerId)}" mode=series - lookup started`);
      const series = await this.client.fetchSeries(Number(providerId), signal);
      if (!series) {
        this.logger.log(`[MangaBaka.lookupById] [end] durationMs=${Date.now() - startedAt} found=false - lookup completed (series not found)`);
        return null;
      }
      const candidate = mapMangabakaSeries(series);
      this.logger.log(`[MangaBaka.lookupById] [end] durationMs=${Date.now() - startedAt} found=${candidate !== null} - lookup completed (series)`);
      return candidate;
    }

    this.logger.warn(
      `[MangaBaka.lookupById] [fail] providerId="${sanitizeLogValue(providerId)}" errorClass=ValidationError error="invalid id format" - lookup failed`,
    );
    return null;
  }
}
