import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as fetchWithThrottleModule from '../../fetch-with-throttle';
import { ProviderThrottleError } from '../../provider-throttle.error';
import { MangabakaClient } from './mangabaka.client';

vi.mock('../../fetch-with-throttle', () => ({
  fetchWithThrottle: vi.fn(),
}));

vi.mock('../provider-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../provider-utils')>();
  return {
    ...actual,
    sleep: vi.fn().mockResolvedValue(undefined),
    buildRequestSignal: vi.fn().mockReturnValue(new AbortController().signal),
  };
});

describe('MangabakaClient', () => {
  let client: MangabakaClient;
  let mockFetch: ReturnType<typeof vi.mocked<typeof fetchWithThrottleModule.fetchWithThrottle>>;

  beforeEach(() => {
    client = new MangabakaClient();
    mockFetch = vi.mocked(fetchWithThrottleModule.fetchWithThrottle);
    vi.clearAllMocks();
  });

  describe('match()', () => {
    it('returns array of series on success', async () => {
      const mockSeries = [
        { id: 1, title: 'DICE', state: 'active', merged_with: null, native_title: '다이스', romanized_title: 'DICE' },
        { id: 2, title: 'One Piece', state: 'active', merged_with: null, native_title: 'ワンピース', romanized_title: 'One Piece' },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 200, data: mockSeries }),
      } as Response);

      const result = await client.match('dice', 5);
      expect(result).toEqual(mockSeries);
    });

    it('builds query parameters correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 200, data: [] }),
      } as Response);

      await client.match('one piece', 5);

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/v1/series/match?'), expect.any(Object));
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('q=one'), expect.any(Object));
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('limit=5'), expect.any(Object));
    });

    it('sends correct User-Agent header', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 200, data: [] }),
      } as Response);

      await client.match('test', 5);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('bookorbit'),
          }),
        }),
      );
    });

    it('returns empty array when response is not ok', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
      } as Response);

      const result = await client.match('query', 5);
      expect(result).toEqual([]);
    });

    it('returns empty array when fetch throws a generic error', async () => {
      mockFetch.mockRejectedValue(new Error('network failure'));

      const result = await client.match('query', 5);
      expect(result).toEqual([]);
    });

    it('rethrows ProviderThrottleError', async () => {
      mockFetch.mockRejectedValue(new ProviderThrottleError(1000));

      await expect(client.match('query', 5)).rejects.toThrow(ProviderThrottleError);
    });

    it('returns empty array when data field is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 200 }),
      } as Response);

      const result = await client.match('query', 5);
      expect(result).toEqual([]);
    });
  });

  describe('fetchSeries()', () => {
    it('returns series response on success', async () => {
      const mockSeries = {
        id: 1,
        title: 'DICE',
        native_title: '다이스',
        romanized_title: 'DICE',
        authors: ['Hyun-Seok Yun'],
        artists: ['Hyun-Seok Yun'],
        description: 'A manga.',
        year: 2013,
        status: 'completed',
        type: 'manhwa',
        rating: 70.3,
        genres: ['action', 'drama'],
        tags: [],
        titles: [],
        publishers: [],
        links: [],
        links_v2: [],
        secondary_titles: null,
        cover: null,
        published: null,
        is_licensed: true,
        has_anime: true,
        anime: null,
        content_rating: 'safe',
        popularity: null,
        final_volume: null,
        total_chapters: '388',
        last_updated_at: '2026-01-01T00:00:00Z',
        relationships: null,
        relationships_v2: [],
        source: null,
        merged_with: null,
        genres_v2: null,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 200, data: mockSeries }),
      } as Response);

      const result = await client.fetchSeries(1);
      expect(result).toEqual(mockSeries);
    });

    it('calls correct URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 200, data: { id: 42 } }),
      } as Response);

      await client.fetchSeries(42);

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/v1/series/42'), expect.any(Object));
    });

    it('returns null when response is not ok', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      const result = await client.fetchSeries(999);
      expect(result).toBeNull();
    });

    it('returns null when fetch throws a generic error', async () => {
      mockFetch.mockRejectedValue(new Error('timeout'));

      const result = await client.fetchSeries(1);
      expect(result).toBeNull();
    });

    it('rethrows ProviderThrottleError', async () => {
      mockFetch.mockRejectedValue(new ProviderThrottleError(1000));

      await expect(client.fetchSeries(1)).rejects.toThrow(ProviderThrottleError);
    });
  });
});