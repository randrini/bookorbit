import { MetadataCandidate, MetadataProviderKey } from '@bookorbit/types';

import { MangabakaSeries, MangabakaTitle } from './mangabaka.types';

const MANGABAKA_BASE_URL = 'https://mangabaka.org';

function resolveTitle(series: MangabakaSeries): string {
  const englishTitle = findPrimaryTitle(series, 'en');
  if (englishTitle) return englishTitle;
  if (series.romanized_title) return series.romanized_title;
  return series.title;
}

function resolveSubtitle(series: MangabakaSeries): string | undefined {
  const mainTitle = resolveTitle(series);
  if (series.native_title && series.native_title !== mainTitle) {
    return series.native_title;
  }
  return undefined;
}

function findPrimaryTitle(series: MangabakaSeries, lang: string): string | undefined {
  const primary = series.titles?.find((t) => t.language === lang && t.is_primary && t.traits?.includes('official'));
  if (primary) return primary.title;
  const official = series.titles?.find((t) => t.language === lang && t.traits?.includes('official'));
  return official?.title;
}

function resolveAuthors(series: MangabakaSeries): string[] | undefined {
  if (!series.authors?.length) return undefined;
  return series.authors;
}

function resolvePublisher(series: MangabakaSeries): string | undefined {
  if (!series.publishers?.length) return undefined;
  const english = series.publishers.find((p) => p.type === 'English');
  if (english) return english.name;
  const original = series.publishers.find((p) => p.type === 'Original');
  return original?.name;
}

function resolvePublishedYear(series: MangabakaSeries): number | undefined {
  if (series.year) return series.year;
  if (series.published?.start_date) {
    const year = parseInt(series.published.start_date.substring(0, 4), 10);
    if (Number.isFinite(year) && year >= 1000 && year <= 2200) return year;
  }
  return undefined;
}

function resolvePublishedDate(series: MangabakaSeries): string | undefined {
  if (!series.published?.start_date) return undefined;
  return series.published.start_date;
}

function resolveGenres(series: MangabakaSeries): string[] | undefined {
  if (!series.genres?.length) return undefined;
  return series.genres.slice(0, 10);
}

function resolveCoverUrl(series: MangabakaSeries): string | undefined {
  if (!series.cover) return undefined;
  return series.cover.x250?.x1 ?? series.cover.raw?.url;
}

function resolveDescription(series: MangabakaSeries): string | undefined {
  if (!series.description) return undefined;
  const trimmed = series.description.trim();
  return trimmed || undefined;
}

function normalizeCommunityRating(rating: number | null): number | undefined {
  if (rating === null || rating === undefined) return undefined;
  if (!Number.isFinite(rating)) return undefined;
  const normalized = rating / 20;
  if (normalized < 0 || normalized > 5) return undefined;
  return Math.round(normalized * 100) / 100;
}

function resolveSourceUrl(series: MangabakaSeries): string {
  const mangabakaLink = series.links_v2?.find((l) => l.name === 'mangabaka.org');
  if (mangabakaLink) return mangabakaLink.url;
  return `${MANGABAKA_BASE_URL}/${series.id}`;
}

function resolveSeriesIndex(series: MangabakaSeries): number | undefined {
  if (!series.relationships_v2?.length) return undefined;
  const parentRel = series.relationships_v2.find(
    (r) => r.relation_type === 'parent' || r.relation_type === 'series',
  );
  if (!parentRel) return undefined;
  return undefined;
}

export function mapMangabakaSeries(series: MangabakaSeries): MetadataCandidate | null {
  if (!series?.id) return null;

  const communityRating = normalizeCommunityRating(series.rating);

  return {
    provider: MetadataProviderKey.MANGABAKA,
    providerId: String(series.id),
    title: resolveTitle(series),
    subtitle: resolveSubtitle(series),
    authors: resolveAuthors(series),
    description: resolveDescription(series),
    publisher: resolvePublisher(series),
    publishedDate: resolvePublishedDate(series),
    publishedYear: resolvePublishedYear(series),
    genres: resolveGenres(series),
    coverUrl: resolveCoverUrl(series),
    sourceUrl: resolveSourceUrl(series),
    seriesName: undefined,
    seriesIndex: resolveSeriesIndex(series),
    ...(communityRating !== undefined ? { communityRating } : {}),
  };
}