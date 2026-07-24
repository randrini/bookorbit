// Title-cleaning utilities for MangaBaka metadata searches.
// Volume markers must appear at the end of the string so legitimate titles
// containing "v" or "t" mid-string are preserved.

// Matches a trailing volume marker with an explicit prefix (T, Vol, v, issue, ch...).
const VOLUME_MARKER_RE = /\s+(?:t(?:ome)?|vol(?:ume)?|v|issue|ch(?:apter)?)\.?\s*\d+\s*$/i;

// Matches a bare trailing number (e.g. "Fairy Tail 13") only when the title has
// at least one word before it. This avoids treating a lone number like "13" as a
// title with volume 13.
const BARE_VOLUME_RE = /\b(\d+)\s*$/;

function stripBrackets(title: string): string {
  let prev: string;
  let result = title;
  do {
    prev = result;
    result = result.replace(/\s*\[[^\][]*\]/g, '').trim();
  } while (result !== prev);
  return result;
}

export function stripVolumeMarker(title: string): string {
  const noBrackets = stripBrackets(title);
  const stripped = noBrackets.replace(VOLUME_MARKER_RE, '').trim();
  if (stripped !== noBrackets) return stripped;
  // Only strip a bare trailing number if there is a word before it.
  const bareMatch = noBrackets.match(/\s+(\d+)\s*$/);
  if (bareMatch) {
    const before = noBrackets.slice(0, bareMatch.index).trim();
    if (before.length > 0 && /\p{L}/u.test(before)) {
      return before;
    }
  }
  return noBrackets.trim();
}

// Extracts a trailing volume number from a book title.
// "Death Note T09" -> 9, "Death Note Vol. 9" -> 9, "Fairy Tail 13" -> 13
// Returns undefined when no volume marker is present.
const VOLUME_NUMBER_RE = /\b(?:t(?:ome)?|vol(?:ume)?|v|issue|ch(?:apter)?)\.?\s*(\d+)\s*$/i;

export function extractVolumeNumber(title: string): number | undefined {
  const noBrackets = stripBrackets(title);

  // Explicit marker (T09, Vol. 9, v12, ch12, etc.)
  const explicitMatch = noBrackets.match(VOLUME_NUMBER_RE);
  if (explicitMatch) {
    const num = parseInt(explicitMatch[1], 10);
    if (Number.isFinite(num) && num > 0) return num;
  }

  // Bare trailing number ("Fairy Tail 13") - only when there is a word before it.
  const bareMatch = noBrackets.match(BARE_VOLUME_RE);
  if (bareMatch) {
    const before = noBrackets.slice(0, bareMatch.index).trim();
    if (before.length > 0 && /\p{L}/u.test(before)) {
      const num = parseInt(bareMatch[1], 10);
      if (Number.isFinite(num) && num > 0) return num;
    }
  }

  return undefined;
}
