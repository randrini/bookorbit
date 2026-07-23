import { describe, expect, it } from 'vitest';

import { stripVolumeMarker } from './mangabaka-title-utils';

describe('stripVolumeMarker', () => {
  describe('strips trailing volume markers', () => {
    const cases: Array<[string, string]> = [
      ['Death Note T09', 'Death Note'],
      ['Death Note Tome 09', 'Death Note'],
      ['Death Note tome 9', 'Death Note'],
      ['Death Note vol09', 'Death Note'],
      ['Death Note v09', 'Death Note'],
      ['Death Note volume 09', 'Death Note'],
      ['Death Note issue 09', 'Death Note'],
      ['Death Note Vol. 9', 'Death Note'],
      ['Death Note T 9', 'Death Note'],
      ['Death Note ch12', 'Death Note'],
      ['Death Note chapter 12', 'Death Note'],
      ['death note v09', 'death note'],
      ['Death Note T09 ', 'Death Note'],
      ['Berserk Vol.42', 'Berserk'],
      ['One Piece v100', 'One Piece'],
    ];

    for (const [input, expected] of cases) {
      it(`strips "${input}" -> "${expected}"`, () => {
        expect(stripVolumeMarker(input)).toBe(expected);
      });
    }
  });

  describe('preserves titles without trailing volume markers', () => {
    const cases = [
      'Death Note',
      'V for Vendetta',
      'Vampire Knight',
      'The Walking Dead',
      'Solo Leveling',
      'A Certain Magical Index',
      'Vinland Saga',
      'Vol 7 Complex',
      'T09 Chronicles',
    ];

    for (const input of cases) {
      it(`preserves "${input}"`, () => {
        expect(stripVolumeMarker(input)).toBe(input);
      });
    }
  });

  it('returns empty string for empty input', () => {
    expect(stripVolumeMarker('')).toBe('');
  });

  it('trims surrounding whitespace', () => {
    expect(stripVolumeMarker('  Death Note  ')).toBe('Death Note');
  });
});
