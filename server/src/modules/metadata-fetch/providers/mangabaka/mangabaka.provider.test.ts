import { Test, TestingModule } from '@nestjs/testing';
import { ProviderConfigurations } from '@bookorbit/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProviderConfigService } from '../../../metadata-preferences/provider-config.service';
import { ProviderThrottleError } from '../../provider-throttle.error';
import { MangabakaClient } from './mangabaka.client';
import { MangabakaProvider } from './mangabaka.provider';
import { MangabakaCollection, MangabakaSeries, MangabakaWork } from './mangabaka.types';

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
            match: vi.fn().mockResolvedValue([]),
            fetchSeries: vi.fn().mockResolvedValue(null),
            fetchCollections: vi.fn().mockResolvedValue([]),
            fetchWorks: vi.fn().mockResolvedValue([]),
            fetchWork: vi.fn().mockResolvedValue(null),
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
      expect(client.match).not.toHaveBeenCalled();
    });

    it('returns empty array when no title and no author', async () => {
      const result = await provider.search({});
      expect(result).toEqual([]);
      expect(client.search).not.toHaveBeenCalled();
      expect(client.match).not.toHaveBeenCalled();
    });

    it('returns empty array when query is empty after cleaning', async () => {
      const result = await provider.search({ title: '[Manga FR] [Digital-1246]' });
      expect(result).toEqual([]);
      expect(client.search).not.toHaveBeenCalled();
      expect(client.match).not.toHaveBeenCalled();
    });

    it('searches by title when only title provided', async () => {
      vi.mocked(client.search).mockResolvedValue([mockSeries]);

      const result = await provider.search({ title: 'DICE' });

      expect(client.search).toHaveBeenCalledWith('DICE', 10, undefined);
      expect(client.match).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].providerId).toBe('1');
    });

    it('searches by title only when both title and author provided', async () => {
      vi.mocked(client.search).mockResolvedValue([]);

      await provider.search({ title: 'DICE', author: 'Yun' });

      expect(client.search).toHaveBeenCalledWith('DICE', 10, undefined);
    });

    it('uses author alone when no title provided', async () => {
      vi.mocked(client.search).mockResolvedValue([]);

      await provider.search({ author: 'Yun' });

      expect(client.search).toHaveBeenCalledWith('Yun', 10, undefined);
    });

    it('respects maxCandidatesPerProvider', async () => {
      vi.mocked(client.search).mockResolvedValue([mockSeries]);

      await provider.search({ title: 'DICE', maxCandidatesPerProvider: 3 });

      expect(client.search).toHaveBeenCalledWith('DICE', 3, undefined);
    });

    it('returns empty array when both search and match return no results', async () => {
      vi.mocked(client.search).mockResolvedValue([]);
      vi.mocked(client.match).mockResolvedValue([]);

      const result = await provider.search({ title: 'unknown' });
      expect(result).toEqual([]);
      expect(client.match).toHaveBeenCalledWith('unknown', 10, undefined);
    });

    it('falls back to match when search returns no results', async () => {
      vi.mocked(client.search).mockResolvedValue([]);
      vi.mocked(client.match).mockResolvedValue([mockSeries]);

      const result = await provider.search({ title: 'DICE' });

      expect(client.search).toHaveBeenCalledWith('DICE', 10, undefined);
      expect(client.match).toHaveBeenCalledWith('DICE', 10, undefined);
      expect(result).toHaveLength(1);
      expect(result[0].providerId).toBe('1');
    });

    it('does not call match when search returns results', async () => {
      vi.mocked(client.search).mockResolvedValue([mockSeries]);

      await provider.search({ title: 'DICE' });

      expect(client.match).not.toHaveBeenCalled();
    });

    it('strips volume markers from title before searching', async () => {
      vi.mocked(client.search).mockResolvedValue([mockSeries]);

      await provider.search({ title: 'Death Note T09' });

      expect(client.search).toHaveBeenCalledWith('Death Note', 10, undefined);
    });

    it('strips volume markers and does not include author in query', async () => {
      vi.mocked(client.search).mockResolvedValue([]);

      await provider.search({ title: 'Death Note Vol. 9', author: 'Ohba' });

      expect(client.search).toHaveBeenCalledWith('Death Note', 10, undefined);
    });

    it('skips series where mapper returns null (id=0)', async () => {
      const zeroIdSeries: MangabakaSeries = { ...mockSeries, id: 0 };
      vi.mocked(client.search).mockResolvedValue([zeroIdSeries]);

      const result = await provider.search({ title: 'DICE' });
      expect(result).toEqual([]);
    });

    it('skips series where mapper returns null (merged_with)', async () => {
      const mergedSeries: MangabakaSeries = { ...mockSeries, merged_with: 42 };
      vi.mocked(client.search).mockResolvedValue([mergedSeries]);

      const result = await provider.search({ title: 'DICE' });
      expect(result).toEqual([]);
    });

    it('returns multiple candidates', async () => {
      const series2: MangabakaSeries = { ...mockSeries, id: 2 };
      vi.mocked(client.search).mockResolvedValue([mockSeries, series2]);

      const result = await provider.search({ title: 'DICE' });
      expect(result).toHaveLength(2);
    });

    it('passes signal to client', async () => {
      const controller = new AbortController();
      vi.mocked(client.search).mockResolvedValue([mockSeries]);

      await provider.search({ title: 'DICE', signal: controller.signal });

      expect(client.search).toHaveBeenCalledWith('DICE', 10, controller.signal);
    });

    it('passes signal to match on fallback', async () => {
      const controller = new AbortController();
      vi.mocked(client.search).mockResolvedValue([]);
      vi.mocked(client.match).mockResolvedValue([mockSeries]);

      await provider.search({ title: 'DICE', signal: controller.signal });

      expect(client.match).toHaveBeenCalledWith('DICE', 10, controller.signal);
    });

    it('with volume number: fetches collections+works and returns work candidate', async () => {
      const mockCollection: MangabakaCollection = {
        id: 'col-1',
        series_id: 1,
        title: 'DICE Vol. 1',
        language: { iso: 'en', language: 'English' },
        publisher: { id: 1, type: 'publisher', sub_type: 'manga', aliases: null, parent_id: null, name: 'LINE Webtoon' },
        edition: { id: 'ed-1', name: 'Standard', language: { iso: 'en', language: 'English' }, description: '', override_text: null },
        type: 'volume',
        format: 'paged',
        medium: 'digital',
        status: 'published',
        reading: 'rtl',
        licensed: true,
        description: { desc: '', source: 'mangabaka' },
        note: null,
        start_date: null,
        end_date: null,
        links: [],
        related_collection_id: null,
        count_main: 10,
        count_extra: 0,
        count_other: 0,
        updated_at: '2024-01-01T00:00:00Z',
      };
      const mockWork: MangabakaWork = {
        id: '019e1d69-4210-767b-acd5-1de151bd138b',
        series_id: 1,
        source_ids: [],
        sub_title: null,
        count_type: 'main',
        images: [],
        release_date: null,
        sequence_string: '1',
        sequence_numeric: 1,
        identifiers: [],
        trim: null,
        description: null,
        note: null,
        pages: null,
        price: null,
        links: [],
        inc_chapters: null,
        part_of_volume: null,
        revision: null,
        updated_at: '2024-01-01T00:00:00Z',
        collections: [mockCollection],
      };

      vi.mocked(client.search).mockResolvedValue([mockSeries]);
      vi.mocked(client.fetchCollections).mockResolvedValue([mockCollection]);
      vi.mocked(client.fetchWorks).mockResolvedValue([mockWork]);

      const result = await provider.search({ title: 'DICE T01' });

      expect(client.search).toHaveBeenCalledWith('DICE', 10, undefined);
      expect(client.fetchCollections).toHaveBeenCalledWith(1, undefined);
      expect(client.fetchWorks).toHaveBeenCalledWith('col-1', undefined, 1);
      expect(result).toHaveLength(1);
      expect(result[0].providerId).toBe('019e1d69-4210-767b-acd5-1de151bd138b');
      expect(result[0].seriesIndex).toBe(1);
    });

    it('with volume number: ignores extra works with same sequence_numeric', async () => {
      const mockCollection: MangabakaCollection = {
        id: 'col-1',
        series_id: 1,
        title: 'DICE Vol. 1',
        language: { iso: 'en', language: 'English' },
        publisher: { id: 1, type: 'publisher', sub_type: 'manga', aliases: null, parent_id: null, name: 'LINE Webtoon' },
        edition: { id: 'ed-1', name: 'Standard', language: { iso: 'en', language: 'English' }, description: '', override_text: null },
        type: 'volume',
        format: 'paged',
        medium: 'digital',
        status: 'published',
        reading: 'rtl',
        licensed: true,
        description: { desc: '', source: 'mangabaka' },
        note: null,
        start_date: null,
        end_date: null,
        links: [],
        related_collection_id: null,
        count_main: 10,
        count_extra: 0,
        count_other: 0,
        updated_at: '2024-01-01T00:00:00Z',
      };
      const extraWork: MangabakaWork = {
        id: 'extra-work-id',
        series_id: 1,
        source_ids: [],
        sub_title: null,
        count_type: 'extra',
        images: [],
        release_date: null,
        sequence_string: '1',
        sequence_numeric: 1,
        identifiers: [],
        trim: null,
        description: null,
        note: null,
        pages: null,
        price: null,
        links: [],
        inc_chapters: null,
        part_of_volume: null,
        revision: null,
        updated_at: '2024-01-01T00:00:00Z',
        collections: [mockCollection],
      };
      const mainWork: MangabakaWork = {
        id: 'main-work-id',
        series_id: 1,
        source_ids: [],
        sub_title: null,
        count_type: 'main',
        images: [],
        release_date: null,
        sequence_string: '1',
        sequence_numeric: 1,
        identifiers: [],
        trim: null,
        description: null,
        note: null,
        pages: null,
        price: null,
        links: [],
        inc_chapters: null,
        part_of_volume: null,
        revision: null,
        updated_at: '2024-01-01T00:00:00Z',
        collections: [mockCollection],
      };

      vi.mocked(client.search).mockResolvedValue([mockSeries]);
      vi.mocked(client.fetchCollections).mockResolvedValue([mockCollection]);
      // Extra work appears first, but should be skipped in favor of main work
      vi.mocked(client.fetchWorks).mockResolvedValue([extraWork, mainWork]);

      const result = await provider.search({ title: 'DICE T01' });

      expect(result).toHaveLength(1);
      expect(result[0].providerId).toBe('main-work-id');
    });

    it('with volume number: tries second series when first has no matching work', async () => {
      const series2: MangabakaSeries = { ...mockSeries, id: 2 };
      const mockCollection1: MangabakaCollection = {
        id: 'col-1',
        series_id: 1,
        title: 'DICE Vol. 1',
        language: { iso: 'en', language: 'English' },
        publisher: { id: 1, type: 'publisher', sub_type: 'manga', aliases: null, parent_id: null, name: 'LINE Webtoon' },
        edition: { id: 'ed-1', name: 'Standard', language: { iso: 'en', language: 'English' }, description: '', override_text: null },
        type: 'volume',
        format: 'paged',
        medium: 'digital',
        status: 'published',
        reading: 'rtl',
        licensed: true,
        description: { desc: '', source: 'mangabaka' },
        note: null,
        start_date: null,
        end_date: null,
        links: [],
        related_collection_id: null,
        count_main: 5,
        count_extra: 0,
        count_other: 0,
        updated_at: '2024-01-01T00:00:00Z',
      };
      const mockCollection2: MangabakaCollection = { ...mockCollection1, id: 'col-2', series_id: 2 };
      const mockWork2: MangabakaWork = {
        id: 'work-from-series-2',
        series_id: 2,
        source_ids: [],
        sub_title: null,
        count_type: 'main',
        images: [],
        release_date: null,
        sequence_string: '1',
        sequence_numeric: 1,
        identifiers: [],
        trim: null,
        description: null,
        note: null,
        pages: null,
        price: null,
        links: [],
        inc_chapters: null,
        part_of_volume: null,
        revision: null,
        updated_at: '2024-01-01T00:00:00Z',
        collections: [mockCollection2],
      };

      vi.mocked(client.search).mockResolvedValue([mockSeries, series2]);
      // First series has collections but no matching work
      vi.mocked(client.fetchCollections).mockResolvedValueOnce([mockCollection1]).mockResolvedValueOnce([mockCollection2]);
      vi.mocked(client.fetchWorks).mockResolvedValueOnce([]).mockResolvedValueOnce([mockWork2]);

      const result = await provider.search({ title: 'DICE T01' });

      expect(client.fetchCollections).toHaveBeenCalledTimes(2);
      expect(client.fetchCollections).toHaveBeenNthCalledWith(1, 1, undefined);
      expect(client.fetchCollections).toHaveBeenNthCalledWith(2, 2, undefined);
      expect(result).toHaveLength(1);
      expect(result[0].providerId).toBe('work-from-series-2');
    });

    it('with volume number but no matching work: falls back to series candidates', async () => {
      const mockCollection: MangabakaCollection = {
        id: 'col-1',
        series_id: 1,
        title: 'DICE Vol. 1',
        language: { iso: 'en', language: 'English' },
        publisher: { id: 1, type: 'publisher', sub_type: 'manga', aliases: null, parent_id: null, name: 'LINE Webtoon' },
        edition: { id: 'ed-1', name: 'Standard', language: { iso: 'en', language: 'English' }, description: '', override_text: null },
        type: 'volume',
        format: 'paged',
        medium: 'digital',
        status: 'published',
        reading: 'rtl',
        licensed: true,
        description: { desc: '', source: 'mangabaka' },
        note: null,
        start_date: null,
        end_date: null,
        links: [],
        related_collection_id: null,
        count_main: 10,
        count_extra: 0,
        count_other: 0,
        updated_at: '2024-01-01T00:00:00Z',
      };
      const mockWork: MangabakaWork = {
        id: '019e1d69-4210-767b-acd5-1de151bd138b',
        series_id: 1,
        source_ids: [],
        sub_title: null,
        count_type: 'main',
        images: [],
        release_date: null,
        sequence_string: '2',
        sequence_numeric: 2,
        identifiers: [],
        trim: null,
        description: null,
        note: null,
        pages: null,
        price: null,
        links: [],
        inc_chapters: null,
        part_of_volume: null,
        revision: null,
        updated_at: '2024-01-01T00:00:00Z',
        collections: [mockCollection],
      };

      vi.mocked(client.search).mockResolvedValue([mockSeries]);
      vi.mocked(client.fetchCollections).mockResolvedValue([mockCollection]);
      vi.mocked(client.fetchWorks).mockResolvedValue([mockWork]);

      const result = await provider.search({ title: 'DICE T01' });

      // sequence_numeric is 2, we searched for volume 1, so no match -> fallback to series
      expect(result).toHaveLength(1);
      expect(result[0].providerId).toBe('1');
    });

    it('without volume number: returns series candidates without collection/work fetch', async () => {
      vi.mocked(client.search).mockResolvedValue([mockSeries]);

      const result = await provider.search({ title: 'DICE' });

      expect(client.fetchCollections).not.toHaveBeenCalled();
      expect(client.fetchWorks).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].providerId).toBe('1');
    });

    it('with volume number but empty series list: no collection/work fetch', async () => {
      vi.mocked(client.search).mockResolvedValue([]);
      vi.mocked(client.match).mockResolvedValue([]);

      const result = await provider.search({ title: 'DICE T01' });

      expect(client.fetchCollections).not.toHaveBeenCalled();
      expect(client.fetchWorks).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it('re-throws ProviderThrottleError from fetchCollections during volume resolution', async () => {
      vi.mocked(client.search).mockResolvedValue([mockSeries]);
      vi.mocked(client.fetchCollections).mockRejectedValue(new ProviderThrottleError(5000));

      await expect(provider.search({ title: 'DICE T01' })).rejects.toThrow(ProviderThrottleError);
    });

    it('passes language hint from [Manga FR] to pickBestCollection', async () => {
      const mockCollection: MangabakaCollection = {
        id: 'col-1',
        series_id: 1,
        title: 'DICE Vol. 1',
        language: { iso: 'en', language: 'English' },
        publisher: { id: 1, type: 'publisher', sub_type: 'manga', aliases: null, parent_id: null, name: 'LINE Webtoon' },
        edition: { id: 'ed-1', name: 'Standard', language: { iso: 'en', language: 'English' }, description: '', override_text: null },
        type: 'volume',
        format: 'paged',
        medium: 'digital',
        status: 'published',
        reading: 'rtl',
        licensed: true,
        description: { desc: '', source: 'mangabaka' },
        note: null,
        start_date: null,
        end_date: null,
        links: [],
        related_collection_id: null,
        count_main: 10,
        count_extra: 0,
        count_other: 0,
        updated_at: '2024-01-01T00:00:00Z',
      };
      const mockWork: MangabakaWork = {
        id: '019e1d69-4210-767b-acd5-1de151bd138b',
        series_id: 1,
        source_ids: [],
        sub_title: null,
        count_type: 'main',
        images: [],
        release_date: null,
        sequence_string: '1',
        sequence_numeric: 1,
        identifiers: [],
        trim: null,
        description: null,
        note: null,
        pages: null,
        price: null,
        links: [],
        inc_chapters: null,
        part_of_volume: null,
        revision: null,
        updated_at: '2024-01-01T00:00:00Z',
        collections: [mockCollection],
      };

      vi.mocked(client.search).mockResolvedValue([mockSeries]);
      vi.mocked(client.fetchCollections).mockResolvedValue([mockCollection]);
      vi.mocked(client.fetchWorks).mockResolvedValue([mockWork]);

      const result = await provider.search({ title: 'DICE T01 [Manga FR]' });

      expect(client.search).toHaveBeenCalledWith('DICE', 10, undefined);
      expect(result).toHaveLength(1);
      expect(result[0].providerId).toBe('019e1d69-4210-767b-acd5-1de151bd138b');
    });

    it('re-throws ProviderThrottleError from fetchWorks during volume resolution', async () => {
      const mockCollection: MangabakaCollection = {
        id: 'col-1',
        series_id: 1,
        title: 'DICE Vol. 1',
        language: { iso: 'en', language: 'English' },
        publisher: { id: 1, type: 'publisher', sub_type: 'manga', aliases: null, parent_id: null, name: 'LINE Webtoon' },
        edition: { id: 'ed-1', name: 'Standard', language: { iso: 'en', language: 'English' }, description: '', override_text: null },
        type: 'volume',
        format: 'paged',
        medium: 'digital',
        status: 'published',
        reading: 'rtl',
        licensed: true,
        description: { desc: '', source: 'mangabaka' },
        note: null,
        start_date: null,
        end_date: null,
        links: [],
        related_collection_id: null,
        count_main: 10,
        count_extra: 0,
        count_other: 0,
        updated_at: '2024-01-01T00:00:00Z',
      };
      vi.mocked(client.search).mockResolvedValue([mockSeries]);
      vi.mocked(client.fetchCollections).mockResolvedValue([mockCollection]);
      vi.mocked(client.fetchWorks).mockRejectedValue(new ProviderThrottleError(5000));

      await expect(provider.search({ title: 'DICE T01' })).rejects.toThrow(ProviderThrottleError);
    });
  });

  describe('lookupById()', () => {
    const validUuid = '019e1d69-4210-767b-acd5-1de151bd138b';

    it('returns null when provider is disabled', async () => {
      vi.mocked(providerConfig.getConfig).mockResolvedValue(disabledConfig);
      const result = await provider.lookupById(validUuid);
      expect(result).toBeNull();
    });

    it('returns null for non-UUID non-numeric ID', async () => {
      const result = await provider.lookupById('abc');
      expect(result).toBeNull();
      expect(client.fetchWork).not.toHaveBeenCalled();
      expect(client.fetchSeries).not.toHaveBeenCalled();
    });

    it('treats numeric ID as series ID and returns mapped candidate', async () => {
      vi.mocked(client.fetchSeries).mockResolvedValue(mockSeries);

      const result = await provider.lookupById('123');
      expect(result).not.toBeNull();
      expect(result?.providerId).toBe('1');
      expect(client.fetchSeries).toHaveBeenCalledWith(123, undefined);
      expect(client.fetchWork).not.toHaveBeenCalled();
    });

    it('returns null for numeric ID when fetchSeries returns null', async () => {
      vi.mocked(client.fetchSeries).mockResolvedValue(null);

      const result = await provider.lookupById('123');
      expect(result).toBeNull();
      expect(client.fetchSeries).toHaveBeenCalledWith(123, undefined);
    });

    it('accepts UUID without hyphens', async () => {
      const noHyphenUuid = '019e1d694210767bacd51de151bd138b';
      const mockWork: MangabakaWork = {
        id: noHyphenUuid,
        series_id: 1,
        source_ids: [],
        sub_title: null,
        count_type: 'main',
        images: [],
        release_date: null,
        sequence_string: '1',
        sequence_numeric: 1,
        identifiers: [],
        trim: null,
        description: null,
        note: null,
        pages: null,
        price: null,
        links: [],
        inc_chapters: null,
        part_of_volume: null,
        revision: null,
        updated_at: '2024-01-01T00:00:00Z',
        collections: [],
      };
      vi.mocked(client.fetchWork).mockResolvedValue(mockWork);
      vi.mocked(client.fetchSeries).mockResolvedValue(mockSeries);

      const result = await provider.lookupById(noHyphenUuid);
      expect(result).not.toBeNull();
      expect(client.fetchWork).toHaveBeenCalledWith(noHyphenUuid, undefined);
    });

    it('returns null for empty string ID', async () => {
      const result = await provider.lookupById('');
      expect(result).toBeNull();
    });

    it('returns null when fetchWork returns null', async () => {
      vi.mocked(client.fetchWork).mockResolvedValue(null);
      const result = await provider.lookupById(validUuid);
      expect(result).toBeNull();
    });

    it('returns null when fetchSeries returns null after work found', async () => {
      const mockWork: MangabakaWork = {
        id: validUuid,
        series_id: 1,
        source_ids: [],
        sub_title: null,
        count_type: 'main',
        images: [],
        release_date: null,
        sequence_string: '1',
        sequence_numeric: 1,
        identifiers: [],
        trim: null,
        description: null,
        note: null,
        pages: null,
        price: null,
        links: [],
        inc_chapters: null,
        part_of_volume: null,
        revision: null,
        updated_at: '2024-01-01T00:00:00Z',
        collections: [],
      };
      vi.mocked(client.fetchWork).mockResolvedValue(mockWork);
      vi.mocked(client.fetchSeries).mockResolvedValue(null);

      const result = await provider.lookupById(validUuid);
      expect(result).toBeNull();
    });

    it('returns mapped candidate for valid UUID', async () => {
      const mockWork: MangabakaWork = {
        id: validUuid,
        series_id: 1,
        source_ids: [],
        sub_title: null,
        count_type: 'main',
        images: [],
        release_date: null,
        sequence_string: '1',
        sequence_numeric: 1,
        identifiers: [],
        trim: null,
        description: null,
        note: null,
        pages: null,
        price: null,
        links: [],
        inc_chapters: null,
        part_of_volume: null,
        revision: null,
        updated_at: '2024-01-01T00:00:00Z',
        collections: [],
      };
      vi.mocked(client.fetchWork).mockResolvedValue(mockWork);
      vi.mocked(client.fetchSeries).mockResolvedValue(mockSeries);

      const result = await provider.lookupById(validUuid);
      expect(result).not.toBeNull();
      expect(result?.providerId).toBe(validUuid);
      expect(result?.title).toBe('DICE');
    });

    it('calls fetchWork with correct UUID', async () => {
      vi.mocked(client.fetchWork).mockResolvedValue({
        id: validUuid,
        series_id: 1,
        source_ids: [],
        sub_title: null,
        count_type: 'main',
        images: [],
        release_date: null,
        sequence_string: '1',
        sequence_numeric: 1,
        identifiers: [],
        trim: null,
        description: null,
        note: null,
        pages: null,
        price: null,
        links: [],
        inc_chapters: null,
        part_of_volume: null,
        revision: null,
        updated_at: '2024-01-01T00:00:00Z',
        collections: [],
      });
      vi.mocked(client.fetchSeries).mockResolvedValue(mockSeries);
      await provider.lookupById(validUuid);
      expect(client.fetchWork).toHaveBeenCalledWith(validUuid, undefined);
    });

    it('passes signal to fetchWork and fetchSeries', async () => {
      const controller = new AbortController();
      const mockWork: MangabakaWork = {
        id: validUuid,
        series_id: 1,
        source_ids: [],
        sub_title: null,
        count_type: 'main',
        images: [],
        release_date: null,
        sequence_string: '1',
        sequence_numeric: 1,
        identifiers: [],
        trim: null,
        description: null,
        note: null,
        pages: null,
        price: null,
        links: [],
        inc_chapters: null,
        part_of_volume: null,
        revision: null,
        updated_at: '2024-01-01T00:00:00Z',
        collections: [],
      };
      vi.mocked(client.fetchWork).mockResolvedValue(mockWork);
      vi.mocked(client.fetchSeries).mockResolvedValue(mockSeries);
      await provider.lookupById(validUuid, controller.signal);
      expect(client.fetchWork).toHaveBeenCalledWith(validUuid, controller.signal);
      expect(client.fetchSeries).toHaveBeenCalledWith(1, controller.signal);
    });
  });
});
