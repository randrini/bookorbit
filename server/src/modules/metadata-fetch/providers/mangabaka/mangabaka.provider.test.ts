import { Test, TestingModule } from '@nestjs/testing';
import { ProviderConfigurations } from '@bookorbit/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProviderConfigService } from '../../../metadata-preferences/provider-config.service';
import { MangabakaClient } from './mangabaka.client';
import { MangabakaProvider } from './mangabaka.provider';
import { MangabakaSeries } from './mangabaka.types';

const enabledConfig: ProviderConfigurations = {
  google: { enabled: false, apiKey: '' },
  amazon: { enabled: false, domain: 'amazon.com', cookie: '' },
  goodreads: { enabled: false },
  hardcover: { enabled: false, apiKey: '' },
  openLibrary: { enabled: false },
  itunes: { enabled: false, coverResolution: 'high' },
  audible: { enabled: false, domain: 'com' },
  audnexus: { enabled: false },
  librofm: { enabled: false },
  comicvine: { enabled: false, apiKey: '' },
  ranobedb: { enabled: false },
  kobo: { enabled: false, country: 'us', language: 'en' },
  lubimyczytac: { enabled: false },
  aladin: { enabled: false, ttbKey: '' },
  mangabaka: { enabled: true },
};

const disabledConfig: ProviderConfigurations = {
  ...enabledConfig,
  mangabaka: { enabled: false },
};

const mockSeries: MangabakaSeries = {
  id: 1,
  state: 'active',
  merged_with: null,
  title: 'DICE',
  native_title: '다이스',
  romanized_title: 'DICE',
  secondary_titles: null,
  cover: null,
  authors: ['Hyun-Seok Yun'],
  artists: ['Hyun-Seok Yun'],
  description: 'A manga about dice.',
  year: 2013,
  published: {
    start_date: '2013-05-18',
    end_date: '2021-07-17',
    start_date_is_estimated: false,
    end_date_is_estimated: false,
  },
  status: 'completed',
  is_licensed: true,
  has_anime: true,
  anime: null,
  content_rating: 'safe',
  type: 'manhwa',
  rating: 70.3,
  popularity: null,
  final_volume: null,
  total_chapters: '388',
  links: [],
  links_v2: [],
  publishers: [{ name: 'LINE Webtoon', type: 'English', note: '' }],
  titles: [{ language: 'en', traits: ['official'], title: 'DICE', note: null, is_primary: true }],
  genres_v2: null,
  genres: ['action', 'drama'],
  tags_v2: [],
  tags: [],
  last_updated_at: '2026-01-01T00:00:00Z',
  relationships: null,
  relationships_v2: [],
  source: null,
};

describe('MangabakaProvider', () => {
  let provider: MangabakaProvider;
  let client: MangabakaClient;
  let providerConfig: ProviderConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MangabakaProvider,
        {
          provide: MangabakaClient,
          useValue: {
            search: vi.fn().mockResolvedValue([]),
            fetchSeries: vi.fn().mockResolvedValue(null),
          },
        },
        {
          provide: ProviderConfigService,
          useValue: {
            getConfig: vi.fn().mockResolvedValue(enabledConfig),
          },
        },
      ],
    }).compile();

    provider = module.get(MangabakaProvider);
    client = module.get(MangabakaClient);
    providerConfig = module.get(ProviderConfigService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('provider metadata', () => {
    it('has key MANGABAKA', () => {
      expect(provider.key).toBe('mangabaka');
    });

    it('has label MangaBaka', () => {
      expect(provider.label).toBe('MangaBaka');
    });

    it('is identifiable', () => {
      expect(provider.identifiable).toBe(true);
    });
  });

  describe('search()', () => {
    it('returns empty array when provider is disabled', async () => {
      vi.mocked(providerConfig.getConfig).mockResolvedValue(disabledConfig);
      const result = await provider.search({ title: 'DICE' });
      expect(result).toEqual([]);
      expect(client.search).not.toHaveBeenCalled();
    });

    it('returns empty array when no title and no author', async () => {
      const result = await provider.search({});
      expect(result).toEqual([]);
      expect(client.search).not.toHaveBeenCalled();
    });

    it('searches by title when only title provided', async () => {
      vi.mocked(client.search).mockResolvedValue([1]);
      vi.mocked(client.fetchSeries).mockResolvedValue(mockSeries);

      const result = await provider.search({ title: 'DICE' });

      expect(client.search).toHaveBeenCalledWith('DICE', 10, undefined);
      expect(result).toHaveLength(1);
      expect(result[0].providerId).toBe('1');
    });

    it('combines title and author in query', async () => {
      vi.mocked(client.search).mockResolvedValue([]);

      await provider.search({ title: 'DICE', author: 'Yun' });

      expect(client.search).toHaveBeenCalledWith('DICE Yun', 10, undefined);
    });

    it('uses author alone when no title provided', async () => {
      vi.mocked(client.search).mockResolvedValue([]);

      await provider.search({ author: 'Yun' });

      expect(client.search).toHaveBeenCalledWith('Yun', 10, undefined);
    });

    it('respects maxCandidatesPerProvider', async () => {
      vi.mocked(client.search).mockResolvedValue([1]);
      vi.mocked(client.fetchSeries).mockResolvedValue(mockSeries);

      await provider.search({ title: 'DICE', maxCandidatesPerProvider: 3 });

      expect(client.search).toHaveBeenCalledWith('DICE', 3, undefined);
    });

    it('returns empty array when client.search returns no IDs', async () => {
      vi.mocked(client.search).mockResolvedValue([]);

      const result = await provider.search({ title: 'unknown' });
      expect(result).toEqual([]);
    });

    it('skips null candidates from fetchSeries', async () => {
      vi.mocked(client.search).mockResolvedValue([1, 9999]);
      vi.mocked(client.fetchSeries).mockResolvedValueOnce(mockSeries).mockResolvedValueOnce(null);

      const result = await provider.search({ title: 'DICE' });
      expect(result).toHaveLength(1);
    });

    it('skips series where mapper returns null (id=0)', async () => {
      const zeroIdSeries: MangabakaSeries = { ...mockSeries, id: 0 };
      vi.mocked(client.search).mockResolvedValue([0]);
      vi.mocked(client.fetchSeries).mockResolvedValue(zeroIdSeries);

      const result = await provider.search({ title: 'DICE' });
      expect(result).toEqual([]);
    });

    it('returns multiple candidates', async () => {
      const series2: MangabakaSeries = { ...mockSeries, id: 2 };
      vi.mocked(client.search).mockResolvedValue([1, 2]);
      vi.mocked(client.fetchSeries).mockResolvedValueOnce(mockSeries).mockResolvedValueOnce(series2);

      const result = await provider.search({ title: 'DICE' });
      expect(result).toHaveLength(2);
    });

    it('passes signal to client', async () => {
      const controller = new AbortController();
      vi.mocked(client.search).mockResolvedValue([1]);
      vi.mocked(client.fetchSeries).mockResolvedValue(mockSeries);

      await provider.search({ title: 'DICE', signal: controller.signal });

      expect(client.search).toHaveBeenCalledWith('DICE', 10, controller.signal);
      expect(client.fetchSeries).toHaveBeenCalledWith(1, controller.signal);
    });
  });

  describe('lookupById()', () => {
    it('returns null when provider is disabled', async () => {
      vi.mocked(providerConfig.getConfig).mockResolvedValue(disabledConfig);
      const result = await provider.lookupById('1');
      expect(result).toBeNull();
    });

    it('returns null for non-numeric ID', async () => {
      const result = await provider.lookupById('abc');
      expect(result).toBeNull();
      expect(client.fetchSeries).not.toHaveBeenCalled();
    });

    it('returns null for ID with trailing non-numeric characters', async () => {
      const result = await provider.lookupById('123abc');
      expect(result).toBeNull();
      expect(client.fetchSeries).not.toHaveBeenCalled();
    });

    it('returns null for empty string ID', async () => {
      const result = await provider.lookupById('');
      expect(result).toBeNull();
    });

    it('returns null when fetchSeries returns null', async () => {
      vi.mocked(client.fetchSeries).mockResolvedValue(null);
      const result = await provider.lookupById('1');
      expect(result).toBeNull();
    });

    it('returns mapped candidate for valid numeric ID', async () => {
      vi.mocked(client.fetchSeries).mockResolvedValue(mockSeries);
      const result = await provider.lookupById('1');
      expect(result).not.toBeNull();
      expect(result?.providerId).toBe('1');
      expect(result?.title).toBe('DICE');
    });

    it('calls fetchSeries with correct integer ID', async () => {
      vi.mocked(client.fetchSeries).mockResolvedValue(mockSeries);
      await provider.lookupById('42');
      expect(client.fetchSeries).toHaveBeenCalledWith(42, undefined);
    });

    it('passes signal to fetchSeries', async () => {
      const controller = new AbortController();
      vi.mocked(client.fetchSeries).mockResolvedValue(mockSeries);
      await provider.lookupById('1', controller.signal);
      expect(client.fetchSeries).toHaveBeenCalledWith(1, controller.signal);
    });

    it('returns null for unsafe integer (overflow)', async () => {
      const unsafe = String(Number.MAX_SAFE_INTEGER + 1);
      const result = await provider.lookupById(unsafe);
      expect(result).toBeNull();
    });

    it('returns null when mapper returns null (series id=0)', async () => {
      const zeroIdSeries: MangabakaSeries = { ...mockSeries, id: 0 };
      vi.mocked(client.fetchSeries).mockResolvedValue(zeroIdSeries);
      const result = await provider.lookupById('1');
      expect(result).toBeNull();
    });
  });
});