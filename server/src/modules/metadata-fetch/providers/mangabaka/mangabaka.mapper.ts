import { MetadataCandidate, MetadataProviderKey } from '@bookorbit/types';

import { MangabakaCollection, MangabakaSeries, MangabakaWork } from './mangabaka.types';

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
  if (series.romanized_title && series.romanized_title !== mainTitle) {
    return series.romanized_title;
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
  return series.cover.x250?.x1 ?? series.cover.x350?.x1 ?? series.cover.x150?.x1 ?? series.cover.raw?.url;
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

export function mapMangabakaSeries(series: MangabakaSeries): MetadataCandidate | null {
  if (!series?.id) return null;
  if (series.merged_with !== null) return null;

  const communityRating = normalizeCommunityRating(series.rating);
  const communityRatingCount = series.popularity?.global?.current;

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
    seriesIndex: undefined,
    ...(communityRating !== undefined ? { communityRating } : {}),
    ...(communityRatingCount !== undefined ? { communityRatingCount } : {}),
  };
}

// Pick the best collection for volume matching.
// Prefers: type "volume", English language, digital medium (complete covers),
// then most works (count_main, capped at 50).
export function pickBestCollection(collections: MangabakaCollection[]): MangabakaCollection | null {
  if (collections.length === 0) return null;

  const scored = collections.map((c) => {
    let score = 0;
    if (c.type === 'volume') score += 100;
    if (c.language?.iso === 'en') score += 50;
    if (c.medium === 'digital') score += 40;
    score += Math.min(c.count_main, 50);
    return { collection: c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].collection;
}

export function mapMangabakaWork(work: MangabakaWork, series: MangabakaSeries): MetadataCandidate | null {
  if (!work?.id) return null;

  const communityRating = normalizeCommunityRating(series.rating);
  const communityRatingCount = series.popularity?.global?.current;
  const bestCollection = work.collections?.length ? pickBestCollection(work.collections) : null;

  let isbn10: string | undefined;
  let isbn13: string | undefined;
  for (const ident of work.identifiers ?? []) {
    if (ident.name === 'isbn') {
      const clean = ident.id.replace(/[-\s]/g, '');
      if (clean.length === 13) {
        isbn13 = clean;
      } else if (clean.length === 10) {
        isbn10 = clean;
      }
    }
  }

  const img = work.images?.[0]?.image;
  const coverUrl = img?.x250?.x1 ?? img?.x350?.x1 ?? img?.x150?.x1 ?? img?.raw?.url;

  let publishedYear: number | undefined;
  if (work.release_date) {
    const year = parseInt(work.release_date.substring(0, 4), 10);
    if (Number.isFinite(year) && year >= 1000 && year <= 2200) {
      publishedYear = year;
    }
  }
  if (publishedYear === undefined) {
    publishedYear = resolvePublishedYear(series);
  }

  return {
    provider: MetadataProviderKey.MANGABAKA,
    providerId: work.id,
    title: resolveTitle(series),
    subtitle: work.sub_title ?? undefined,
    authors: resolveAuthors(series),
    description: work.description?.desc?.trim() || undefined,
    publisher: bestCollection?.publisher?.name ?? resolvePublisher(series),
    publishedDate: work.release_date ?? undefined,
    publishedYear,
    language: bestCollection?.language?.iso ?? undefined,
    pageCount: work.pages ?? undefined,
    ...(isbn13 ? { isbn13 } : {}),
    ...(isbn10 ? { isbn10 } : {}),
    seriesName: resolveTitle(series),
    seriesIndex: work.sequence_numeric,
    genres: resolveGenres(series),
    coverUrl,
    sourceUrl: `https://mangabaka.org/work/${work.id}`,
    ...(communityRating !== undefined ? { communityRating } : {}),
    ...(communityRatingCount !== undefined ? { communityRatingCount } : {}),
  };
}
