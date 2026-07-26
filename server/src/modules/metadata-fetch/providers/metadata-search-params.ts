import { MetadataProviderKey } from '@bookorbit/types';

export interface MetadataSearchParams {
  title?: string;
  author?: string;
  isbn?: string;
  existingProviderIds?: Partial<Record<MetadataProviderKey, string>>;
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
  // Internal-only signal used by orchestration timeout/cancellation.
  signal?: AbortSignal;
}
