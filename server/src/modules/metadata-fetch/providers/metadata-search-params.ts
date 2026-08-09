import { MetadataProviderKey } from '@bookorbit/types';

export interface MetadataSearchParams {
  title?: string;
  author?: string;
  isbn?: string;
  // Series context for providers that address records by series plus position rather than by title
  // (e.g. ComicVine volume plus issue number). A comic title holds only the issue name, so the
  // pairing cannot be recovered from it.
  seriesName?: string;
  seriesIndex?: number;
  existingProviderIds?: Partial<Record<MetadataProviderKey, string>>;
  // Pins a Hardcover refresh to a previously chosen edition instead of re-deriving one by ISBN.
  hardcoverEditionId?: string;
  isAudiobook?: boolean;
  // Hint for providers to cap deep candidate exploration in non-interactive flows
  // (e.g. auto-fill/background refresh where there is no manual candidate picking).
  maxCandidatesPerProvider?: number;
  // When true, providers that return series-level results should resolve to the
  // best-matching volume/issue candidate when a volume number is available.
  resolveVolumes?: boolean;
  // When true, MangaBaka volume titles use "Series, Vol. NN: Subtitle, Ch NNNN"
  // format with subtitle and chapter. When false/undefined, uses simpler format.
  richTitleFormat?: boolean;
  // Whether the original query contains a chapter marker (e.g. "Ch 14", "c090").
  // Passed to MangaBaka so it can include chapter in the title only when relevant.
  includeChapter?: boolean;
  // Preferred language for collection selection (e.g. "fr", "en").
  // When set, pickBestCollection will prefer collections in this language.
  preferredLanguage?: string;
  // Internal-only signal used by orchestration timeout/cancellation.
  signal?: AbortSignal;
}
