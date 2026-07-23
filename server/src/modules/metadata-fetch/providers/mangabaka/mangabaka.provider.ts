import { Injectable, Logger } from '@nestjs/common';
import { MetadataCandidate, MetadataProviderKey } from '@bookorbit/types';

import { ProviderConfigService } from '../../../metadata-preferences/provider-config.service';
import { IdentifiableProvider } from '../metadata-provider';
import { MetadataSearchParams } from '../metadata-search-params';
import { PROVIDER_LIMITS } from '../provider-constants';
import { normalizeMaxCandidates } from '../provider-utils';
import { MangabakaClient } from './mangabaka.client';
import { mapMangabakaSeries, mapMangabakaWork, pickBestCollection } from './mangabaka.mapper';
import { extractVolumeNumber, stripVolumeMarker } from './mangabaka-title-utils';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    const query = params.author ? `${cleanTitle ?? ''} ${params.author}`.trim() : (cleanTitle ?? '');
    const maxResults = normalizeMaxCandidates(params.maxCandidatesPerProvider, PROVIDER_LIMITS.MANGABAKA_MAX_RESULTS);

    // Prefer the stable /v1/series/search endpoint (returns full series objects).
    // Fall back to /v1/series/match (fuzzy) when search yields no candidates.
    let series = await this.client.search(query, maxResults, params.signal);
    if (series.length === 0) {
      series = await this.client.match(query, maxResults, params.signal);
    }

    // If a volume number was extracted, try to resolve a specific work for the top series.
    if (volumeNumber !== undefined && series.length > 0) {
      const topSeries = series[0];
      try {
        const collections = await this.client.fetchCollections(topSeries.id, params.signal);
        const bestCollection = pickBestCollection(collections);
        if (bestCollection) {
          const works = await this.client.fetchWorks(bestCollection.id, params.signal);
          const matchingWork = works.find((w) => w.sequence_numeric === volumeNumber);
          if (matchingWork) {
            const candidate = mapMangabakaWork(matchingWork, topSeries);
            if (candidate) return [candidate];
          }
        }
      } catch {
        // If collection/work resolution fails, fall through to series-level candidates
      }
    }

    const candidates: MetadataCandidate[] = [];
    for (const s of series) {
      const candidate = mapMangabakaSeries(s);
      if (candidate) candidates.push(candidate);
    }
    return candidates;
  }

  async lookupById(providerId: string, signal?: AbortSignal): Promise<MetadataCandidate | null> {
    const { enabled } = await this.providerConfig.getConfig().then((c) => c.mangabaka);
    if (!enabled) return null;

    if (!UUID_RE.test(providerId)) {
      this.logger.warn(`[mangabaka.lookup] invalid providerId="${providerId}"`);
      return null;
    }

    const work = await this.client.fetchWork(providerId, signal);
    if (!work) return null;

    const series = await this.client.fetchSeries(work.series_id, signal);
    if (!series) return null;

    return mapMangabakaWork(work, series);
  }
}
