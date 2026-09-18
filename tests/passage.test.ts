import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PASSAGE_LOOKAHEAD, passageIndex, passageWindow, samePassage,
} from '../src/core/passage';
import type { DisplayVerse, VerseRef } from '../src/core/types';

const verse = (surah: number, ayah: number): DisplayVerse => ({
  surah, ayah, translation: `${surah}:${ayah}`, footnotes: '', arabic: `${surah}:${ayah}`,
  name: 'Test', nameArabic: 'Test', basmala: null,
});

function cached(rows: DisplayVerse[]) {
  const verses = new Map(rows.map((item) => [`${item.surah}:${item.ayah}`, item]));
  const peek = (ref: VerseRef) => verses.get(`${ref.surah}:${ref.ayah}`);
  const hasVerse = (ref: VerseRef) => Boolean(peek(ref));
  return { peek, hasVerse };
}

test('after lock the rest of a short surah is already in the passage', () => {
  const { peek, hasVerse } = cached([
    verse(112, 1), verse(112, 2), verse(112, 3), verse(112, 4), verse(113, 1),
  ]);
  const window = passageWindow(verse(112, 1), peek, hasVerse);
  assert.deepEqual(window.map((item) => `${item.surah}:${item.ayah}`), ['112:1', '112:2', '112:3', '112:4']);
  assert.equal(passageIndex(window, verse(112, 1)), 0);
  assert.equal(samePassage(window, passageWindow(verse(112, 1), peek, hasVerse)), true);
  assert.deepEqual(passageWindow(verse(112, 2), peek, hasVerse).map((item) => `${item.surah}:${item.ayah}`), [
    '112:1', '112:2', '112:3', '112:4',
  ]);
  assert.deepEqual(passageWindow(verse(112, 4), peek, hasVerse).map((item) => `${item.surah}:${item.ayah}`), ['112:3', '112:4']);
  assert.deepEqual(passageWindow(verse(113, 1), peek, hasVerse).map((item) => `${item.surah}:${item.ayah}`), ['112:4', '113:1']);
});

test('a Fatiha 1:2 lock lists the rest of Al-Fatihah when those ayahs are cached', () => {
  const { peek, hasVerse } = cached([
    verse(1, 1), verse(1, 2), verse(1, 3), verse(1, 4), verse(1, 5), verse(1, 6), verse(1, 7),
  ]);
  assert.deepEqual(passageWindow(verse(1, 2), peek, hasVerse).map((item) => `${item.surah}:${item.ayah}`), [
    '1:1', '1:2', '1:3', '1:4', '1:5', '1:6', '1:7',
  ]);
});

test('a long surah does not dump every remaining ayah onto the screen', () => {
  const rows = Array.from({ length: 20 }, (_, index) => verse(2, index + 1));
  const { peek, hasVerse } = cached(rows);
  const window = passageWindow(verse(2, 5), peek, hasVerse);
  assert.deepEqual(window.map((item) => `${item.surah}:${item.ayah}`), [
    '2:4', '2:5', '2:6', '2:7', '2:8', '2:9', '2:10', '2:11', '2:12',
  ]);
  assert.equal(window.length, 1 + 1 + PASSAGE_LOOKAHEAD);
  assert.equal(window.at(-1)?.ayah, 5 + PASSAGE_LOOKAHEAD);
});

test('the focused ayah remains if neighbors are not cached yet', () => {
  const focus = verse(112, 2);
  const window = passageWindow(focus, () => undefined, () => true);
  assert.deepEqual(window.map((item) => `${item.surah}:${item.ayah}`), ['112:2']);
  assert.equal(passageIndex(window, focus), 0);
});
