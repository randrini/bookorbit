// Strips trailing volume/tome/issue markers from a book title so metadata
// searches match the series rather than a specific volume.
//
// Handles forms like:
//   "Death Note T09"        -> "Death Note"
//   "Death Note Tome 09"    -> "Death Note"
//   "Death Note tome 9"     -> "Death Note"
//   "Death Note vol09"      -> "Death Note"
//   "Death Note v09"        -> "Death Note"
//   "Death Note volume 09"  -> "Death Note"
//   "Death Note issue 09"   -> "Death Note"
//   "Death Note Vol. 9"     -> "Death Note"
//
// The marker must appear at the end of the string (after optional whitespace)
// so legitimate titles containing "v" mid-string are preserved.
const VOLUME_MARKER_RE = /\s+(?:t(?:ome)?|vol(?:ume)?|v|issue|ch(?:apter)?)\.?\s*\d+\s*$/i;

export function stripVolumeMarker(title: string): string {
  return title.replace(VOLUME_MARKER_RE, '').trim();
}
