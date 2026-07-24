// Title-cleaning utilities for MangaBaka metadata searches.
// Volume markers must appear at the end of the string so legitimate titles
// containing "v" or "t" mid-string are preserved.

// Matches a trailing volume marker with an explicit prefix (T, Vol, v, issue, ch...).
// Allows an optional trailing year (e.g. "Naruto Vol.72 2014") by not requiring
// the marker to be the very last token — the year is stripped separately.
const VOLUME_MARKER_RE = /\s+(?:t(?:ome)?|vol(?:ume)?|v|issue|ch(?:apter)?)\.?\s*\d+(?:\.\d+)?(?:\s+\d{4})?\s*$/i;

// Matches a trailing year (4 digits 1000-2999) that may follow a volume marker.
const TRAILING_YEAR_RE = /\s+\d{4}\s*$/;

// Matches a bare trailing number or range (e.g. "Fairy Tail 13", "Naruto 1-5").
// For ranges, the first number is used as the volume.
const BARE_VOLUME_RE = /\b(\d+)(?:-\d+)?\s*$/;

// Manga volumes rarely exceed 150; reject numbers that are likely years.
const MAX_VOLUME_NUMBER = 200;

function stripBrackets(title: string): string {
  let prev: string;
  let result = title;
  do {
    prev = result;
    result = result
      .replace(/\s*\[[^\][]*\]/g, '')
      .replace(/\s*\([^()]*\)/g, '')
      .replace(/\s*《[^《》]*》/g, '')
      .replace(/\s*【[^【】]*】/g, '')
      .trim();
  } while (result !== prev);
  return result;
}

// Detects language hints from bracketed metadata in filenames.
// "[Manga FR]" -> "fr", "[Manga EN]" -> "en", "[Manga ES]" -> "es"
// Returns undefined when no language hint is found.
const LANG_HINT_RE = /\[(?:manga|anime|scan)\s+([a-z]{2})\]/i;

export function detectLanguageHint(title: string): string | undefined {
  const match = title.match(LANG_HINT_RE);
  if (!match) return undefined;
  return match[1].toLowerCase();
}

function stripTrailingYear(title: string): string {
  return title.replace(TRAILING_YEAR_RE, '').trim();
}

export function stripVolumeMarker(title: string): string {
  const noBrackets = stripBrackets(title);
  const noYear = stripTrailingYear(noBrackets);
  const stripped = noYear.replace(VOLUME_MARKER_RE, '').trim();
  if (stripped !== noYear) return stripped;
  // Only strip a bare trailing number if there is a word before it.
  const bareMatch = noYear.match(/\s+(\d+)(?:-\d+)?\s*$/);
  if (bareMatch) {
    const before = noYear.slice(0, bareMatch.index).trim();
    if (before.length > 0 && /\p{L}/u.test(before)) {
      return before;
    }
  }
  return noYear.trim();
}

// Extracts a trailing volume number from a book title.
// "Death Note T09" -> 9, "Death Note Vol. 9" -> 9, "Fairy Tail 13" -> 13
// For ranges like "Naruto 1-5", returns the first number (1).
// Returns undefined when no volume marker is present or the number exceeds
// MAX_VOLUME_NUMBER (likely a year, not a volume).
const VOLUME_NUMBER_RE = /\b(?:t(?:ome)?|vol(?:ume)?|v|issue|ch(?:apter)?)\.?\s*(\d+)(?:\.\d+)?(?:\s+\d{4})?\s*$/i;

export function extractVolumeNumber(title: string): number | undefined {
  const noBrackets = stripBrackets(title);
  const noYear = stripTrailingYear(noBrackets);

  // Explicit marker (T09, Vol. 9, v12, ch12, etc.)
  const explicitMatch = noYear.match(VOLUME_NUMBER_RE);
  if (explicitMatch) {
    const num = parseInt(explicitMatch[1], 10);
    if (Number.isFinite(num) && num > 0 && num <= MAX_VOLUME_NUMBER) return num;
  }

  // Bare trailing number or range ("Fairy Tail 13", "Naruto 1-5")
  // - only when there is a word before it.
  const bareMatch = noYear.match(BARE_VOLUME_RE);
  if (bareMatch) {
    const before = noYear.slice(0, bareMatch.index).trim();
    if (before.length > 0 && /\p{L}/u.test(before)) {
      const num = parseInt(bareMatch[1], 10);
      if (Number.isFinite(num) && num > 0 && num <= MAX_VOLUME_NUMBER) return num;
    }
  }

  return undefined;
}
