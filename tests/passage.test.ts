import assert from 'node:assert/strict';
import { test } from 'node:test';
import { passageIndex, passageWindow, samePassage } from '../src/core/passage';
import type { DisplayVerse, VerseRef } from '../src/core/types';

const verse = (surah: number, ayah: number): DisplayVerse => ({
  surah, ayah, translation: `${surah}:${ayah}`, footnotes: '', arabic: `${surah}:${ayah}`,
  name: 'Test', nameArabic: 'Test', basmala: null,
});

test('the on-screen passage is only the previous, current, and next ayahs', () => {
  const verses = new Map<string, DisplayVerse>([
    ['112:1', verse(112, 1)], ['112:2', verse(112, 2)], ['112:3', verse(112, 3)],
    ['112:4', verse(112, 4)], ['113:1', verse(113, 1)],
  ]);
  const peek = (ref: VerseRef) => verses.get(`${ref.surah}:${ref.ayah}`);
  const hasVerse = (ref: VerseRef) => Boolean(peek(ref));
  const window = passageWindow(verse(112, 2), peek, hasVerse);
  assert.deepEqual(window.map((item) => `${item.surah}:${item.ayah}`), ['112:1', '112:2', '112:3']);
  assert.equal(passageIndex(window, verse(112, 2)), 1);
  assert.equal(samePassage(window, passageWindow(verse(112, 2), peek, hasVerse)), true);
  assert.deepEqual(passageWindow(verse(112, 4), peek, hasVerse).map((item) => `${item.surah}:${item.ayah}`), ['112:3', '112:4']);
  assert.deepEqual(passageWindow(verse(113, 1), peek, hasVerse).map((item) => `${item.surah}:${item.ayah}`), ['112:4', '113:1']);
});

test('the focused ayah remains if neighbors are not cached yet', () => {
  const focus = verse(112, 2);
  const window = passageWindow(focus, () => undefined, () => true);
  assert.deepEqual(window.map((item) => `${item.surah}:${item.ayah}`), ['112:2']);
  assert.equal(passageIndex(window, focus), 0);
});
