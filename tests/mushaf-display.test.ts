import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { mushafDisplayVerse } from '../src/core/mushaf-display';
import { MUSHAF_ONLY_MVP } from '../src/core/mvp';
import { SHOW_TRANSLATION_PANE } from '../src/core/passage';

const verses = JSON.parse(readFileSync('assets/content/quran-display.json', 'utf8')).verses as Record<string, string>;

test('mushaf-first MVP does not require a translation pane or pack to display Arabic', () => {
  assert.equal(MUSHAF_ONLY_MVP, true);
  assert.equal(SHOW_TRANSLATION_PANE, false);
});

test('mushaf display paints canonical Arabic with an empty translation', () => {
  const fatiha2 = mushafDisplayVerse(
    { surah: 1, ayah: 2 },
    verses['1:2'],
    { surah_name: 'الفاتحة', surah_name_en: 'Al-Fatihah' },
  );
  assert.ok(fatiha2);
  assert.match(fatiha2.arabic, /ٱلْحَمْدُ/);
  assert.equal(fatiha2.translation, '');
  assert.equal(fatiha2.footnotes, '');
  assert.equal(fatiha2.basmala, null);
  assert.equal(fatiha2.nameArabic, 'الفاتحة');
});

test('mushaf display splits the opening Basmala off ayah 1 and still has no translation', () => {
  const baqarah1 = mushafDisplayVerse(
    { surah: 2, ayah: 1 },
    verses['2:1'],
    { surah_name: 'البقرة', surah_name_en: 'Al-Baqarah' },
  );
  assert.ok(baqarah1);
  assert.ok(baqarah1.basmala);
  assert.ok(baqarah1.arabic.length > 0);
  assert.notEqual(baqarah1.arabic, verses['2:1']);
  assert.equal(baqarah1.translation, '');
});

test('mushaf display refuses a missing ayah instead of inventing text', () => {
  assert.equal(
    mushafDisplayVerse({ surah: 1, ayah: 8 }, verses['1:8'], { surah_name: 'الفاتحة', surah_name_en: 'Al-Fatihah' }),
    undefined,
  );
});
