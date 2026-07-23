import { Injectable, Logger } from '@nestjs/common';

import { fetchWithThrottle } from '../../fetch-with-throttle';
import { ProviderThrottleError } from '../../provider-throttle.error';
import { PROVIDER_DELAYS_MS, PROVIDER_LIMITS, PROVIDER_TIMEOUT_MS } from '../provider-constants';
import { buildRequestSignal, normalizeMaxCandidates, sanitizeLogError, sleep } from '../provider-utils';
import { MangabakaSearchResponse, MangabakaSeries } from './mangabaka.types';

const BASE_URL = 'https://api.mangabaka.org';
const USER_AGENT = 'bookorbit/1.0 (+https://github.com/bookorbit/bookorbit)';

class RateLimiter {
  private nextAllowedTime = 0;

  async throttle(signal?: AbortSignal): Promise<void> {
    const now = Date.now();
    const scheduled = Math.max(now, this.nextAllowedTime);
    this.nextAllowedTime = scheduled + PROVIDER_DELAYS_MS.MANGABAKA_BETWEEN_REQUESTS;
    const wait = scheduled - now;
    if (wait > 0) {
      await sleep(wait, signal);
    }
  }
}

@Injectable()
export class MangabakaClient {
  private readonly logger = new Logger(MangabakaClient.name);
  private readonly rateLimiter = new RateLimiter();

  async search(query: string, limit: number, signal?: AbortSignal): Promise<number[]> {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
    });
    const data = await this.get<MangabakaSearchResponse>('search', `/v1/series/search?${params.toString()}`, signal);
    if (!data?.data) return [];
    return data.data.map((s) => s.id);
  }

  async fetchSeries(id: number, signal?: AbortSignal): Promise<MangabakaSeries | null> {
    return this.get<MangabakaSeries>('fetchSeries', `/v1/series/${id}`, signal);
  }

  private async get<T>(op: string, path: string, signal?: AbortSignal): Promise<T | null> {
    await this.rateLimiter.throttle(signal);
    const startedAt = Date.now();
    this.logger.log(`[mangabaka] [start] op=${op} path="${sanitizeLogError(path)}"`);

    try {
      const res = await fetchWithThrottle(`${BASE_URL}${path}`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: buildRequestSignal(PROVIDER_TIMEOUT_MS.DEFAULT, signal),
      });

      if (!res.ok) {
        this.logger.warn(
          `[mangabaka] [fail] op=${op} status=${res.status} durationMs=${Date.now() - startedAt} error="non-ok response"`,
        );
        return null;
      }

      const body = (await res.json()) as T;
      this.logger.log(`[mangabaka] [end] op=${op} status=${res.status} durationMs=${Date.now() - startedAt}`);
      return body;
    } catch (err) {
      if (err instanceof ProviderThrottleError) {
        this.logger.warn(`[mangabaka] [fail] op=${op} durationMs=${Date.now() - startedAt} error="throttled"`);
        throw err;
      }
      this.logger.warn(
        `[mangabaka] [fail] op=${op} durationMs=${Date.now() - startedAt} error="${sanitizeLogError(err)}"`,
      );
      return null;
    }
  }
}