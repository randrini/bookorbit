import { describe, expect, it } from 'vitest';

import { detectLanguageHint, extractVolumeNumber, stripVolumeMarker } from './mangabaka-title-utils';

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
      ['Fairy Tail 13', 'Fairy Tail'],
      ['Fairy Tail T13', 'Fairy Tail'],
      ['Fairy Tail v13', 'Fairy Tail'],
      ['Naruto Vol.72 2014', 'Naruto'],
      ['Naruto 1-5', 'Naruto'],
      ['Berserk Vol. 42.5', 'Berserk'],
      ['Naruto 2014', 'Naruto'],
      ['Berserk 1989', 'Berserk'],
    ];

    for (const [input, expected] of cases) {
      it(`strips "${input}" -> "${expected}"`, () => {
        expect(stripVolumeMarker(input)).toBe(expected);
      });
    }
  });

  describe('strips bracketed metadata blocks', () => {
    const cases: Array<[string, string]> = [
      ['Fairy Tail 13 [Hiro Mashima] [Manga FR] [Digital-1246]', 'Fairy Tail'],
      ['Naruto [Manga] [Digital]', 'Naruto'],
      ['Berserk Vol.42 [Kentaro Miura] [Dark Horse]', 'Berserk'],
      ['One Piece [Eiichiro Oda]', 'One Piece'],
      ['Title [Tag1] [Tag2] [Tag3]', 'Title'],
      ['Title [outer [inner]]', 'Title'],
      ['Fairy Tail 13 (Hiro Mashima) (Manga FR)', 'Fairy Tail'],
      ['Naruto (Digital)', 'Naruto'],
      ['Title (Tag1) (Tag2)', 'Title'],
    ];

    for (const [input, expected] of cases) {
      it(`strips "${input}" -> "${expected}"`, () => {
        expect(stripVolumeMarker(input)).toBe(expected);
      });
    }
  });

  describe('preserves titles without trailing volume markers', () => {
    const cases: Array<string | [string, string]> = [
      'Death Note',
      'V for Vendetta',
      'Vampire Knight',
      'The Walking Dead',
      'Solo Leveling',
      'A Certain Magical Index',
      'Vinland Saga',
      'Vol 7 Complex',
      'T09 Chronicles',
      ['123 45', '123 45'],
      ['Naruto 9999', 'Naruto 9999'],
    ];

    for (const entry of cases) {
      const input = Array.isArray(entry) ? entry[0] : entry;
      const expected = Array.isArray(entry) ? entry[1] : entry;
      it(`preserves "${input}"`, () => {
        expect(stripVolumeMarker(input)).toBe(expected);
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

describe('extractVolumeNumber', () => {
  const cases: Array<[string, number | undefined]> = [
    ['Death Note T09', 9],
    ['Death Note Tome 09', 9],
    ['Death Note vol09', 9],
    ['Death Note v09', 9],
    ['Death Note volume 09', 9],
    ['Death Note issue 09', 9],
    ['Death Note Vol. 9', 9],
    ['Death Note ch12', 12],
    ['Death Note chapter 12', 12],
    ['Fairy Tail 13', 13],
    ['Fairy Tail T13', 13],
    ['Fairy Tail v13', 13],
    ['Fairy Tail 13 [Hiro Mashima] [Manga FR] [Digital-1246]', 13],
    ['Naruto Vol.72 2014', 72],
    ['Naruto 1-5', 1],
    ['Death Note Vol.1-3', 1],
    ['Berserk Vol. 42.5', 42],
    ['Death Note', undefined],
    ['Death Note T0', undefined],
    ['13', undefined],
    ['', undefined],
    ['Naruto 2014', undefined],
    ['Naruto T2014', undefined],
    ['Naruto v2014', undefined],
    ['Berserk 1989', undefined],
    ['1984', undefined],
  ];

  for (const [input, expected] of cases) {
    const label = expected !== undefined ? `extracts ${expected} from "${input}"` : `returns undefined for "${input}"`;
    it(label, () => {
      expect(extractVolumeNumber(input)).toBe(expected);
    });
  }
});

describe('detectLanguageHint', () => {
  const cases: Array<[string, string | undefined]> = [
    ['[Manga FR]', 'fr'],
    ['[Manga EN]', 'en'],
    ['[Manga ES]', 'es'],
    ['[Anime JP]', 'jp'],
    ['[Scan IT]', 'it'],
    ['Fairy Tail 13', undefined],
    ['[Digital-1246]', undefined],
    ['Fairy Tail 13 [Manga FR] [Digital-1246]', 'fr'],
  ];

  for (const [input, expected] of cases) {
    const label = expected !== undefined ? `detects "${expected}" from "${input}"` : `returns undefined for "${input}"`;
    it(label, () => {
      expect(detectLanguageHint(input)).toBe(expected);
    });
  }
});

describe('stripVolumeMarker with non-Latin brackets', () => {
  const cases: Array<[string, string]> = [
    ['Naruto 《13》', 'Naruto'],
    ['Fairy Tail 【13】', 'Fairy Tail'],
    ['Naruto 《13》 [Manga JP]', 'Naruto'],
  ];

  for (const [input, expected] of cases) {
    it(`strips "${input}" -> "${expected}"`, () => {
      expect(stripVolumeMarker(input)).toBe(expected);
    });
  }
});
