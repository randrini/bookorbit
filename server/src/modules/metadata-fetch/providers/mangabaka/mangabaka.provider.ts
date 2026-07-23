import { Injectable, Logger } from '@nestjs/common';
import { MetadataCandidate, MetadataProviderKey } from '@bookorbit/types';

import { ProviderConfigService } from '../../../metadata-preferences/provider-config.service';
import { IdentifiableProvider } from '../metadata-provider';
import { MetadataSearchParams } from '../metadata-search-params';
import { PROVIDER_LIMITS } from '../provider-constants';
import { normalizeMaxCandidates } from '../provider-utils';
import { MangabakaClient } from './mangabaka.client';
import { mapMangabakaSeries } from './mangabaka.mapper';

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

    const query = params.author ? `${params.title ?? ''} ${params.author}`.trim() : (params.title ?? '');
    const maxResults = normalizeMaxCandidates(params.maxCandidatesPerProvider, PROVIDER_LIMITS.MANGABAKA_MAX_RESULTS);

    const ids = await this.client.search(query, maxResults, params.signal);
    if (ids.length === 0) return [];

    const candidates: MetadataCandidate[] = [];
    for (const id of ids) {
      const series = await this.client.fetchSeries(id, params.signal);
      if (!series) continue;
      const candidate = mapMangabakaSeries(series);
      if (candidate) candidates.push(candidate);
    }
    return candidates;
  }

  async lookupById(providerId: string, signal?: AbortSignal): Promise<MetadataCandidate | null> {
    const { enabled } = await this.providerConfig.getConfig().then((c) => c.mangabaka);
    if (!enabled) return null;

    if (!/^\d+$/.test(providerId) || !Number.isSafeInteger(Number(providerId))) {
      this.logger.warn(`[mangabaka.lookup] invalid providerId="${providerId}"`);
      return null;
    }

    const series = await this.client.fetchSeries(Number(providerId), signal);
    if (!series) return null;

    return mapMangabakaSeries(series);
  }
}
