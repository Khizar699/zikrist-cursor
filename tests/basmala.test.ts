import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { OPENING_BASMALA, splitOpeningBasmala } from '../src/core/basmala';

const verses = JSON.parse(readFileSync('assets/content/quran-display.json', 'utf8')).verses as Record<string, string>;

test('Ikhlas ayah 1 keeps Tanzil bytes in the file and presents Basmala as a header', () => {
  assert.ok(verses['112:1']!.startsWith(OPENING_BASMALA));
  assert.deepEqual(splitOpeningBasmala(verses['112:1']!, { surah: 112, ayah: 1 }), {
    header: OPENING_BASMALA,
    ayah: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ',
  });
});

test('Al-Fatihah 1:1 remains the Basmala ayah and At-Tawbah has no opening header', () => {
  assert.equal(splitOpeningBasmala(verses['1:1']!, { surah: 1, ayah: 1 }).header, null);
  assert.equal(splitOpeningBasmala(verses['1:1']!, { surah: 1, ayah: 1 }).ayah, verses['1:1']);
  assert.equal(splitOpeningBasmala(verses['9:1']!, { surah: 9, ayah: 1 }).header, null);
  assert.equal(splitOpeningBasmala(verses['27:30']!, { surah: 27, ayah: 30 }).header, null);
});
