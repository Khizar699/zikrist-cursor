import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  DEBUG_HUD_OVERLAYS_ARABIC, DEBUG_HUD_STAGE_INSET, FOCUSED_SCROLL_POSITION, PASSAGE_LOOKAHEAD, SHOW_TRANSLATION_PANE,
  passageIndex, passageLookaheadComplete, passagePanePadding, passageWindow, samePassage,
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
  assert.equal(passageLookaheadComplete(window, focus, () => true), false);
});

test('a short-surah window lists later ayahs once they are cached', () => {
  const focus = verse(112, 2);
  const mushaf = (ref: VerseRef) => ref.surah === 112 && ref.ayah >= 1 && ref.ayah <= 4;
  const partial = cached([verse(112, 1), verse(112, 2)]);
  const incomplete = passageWindow(focus, partial.peek, mushaf);
  assert.deepEqual(incomplete.map((item) => `${item.surah}:${item.ayah}`), ['112:1', '112:2']);
  assert.equal(passageLookaheadComplete(incomplete, focus, mushaf), false);
  const { peek, hasVerse } = cached([verse(112, 1), verse(112, 2), verse(112, 3), verse(112, 4)]);
  const complete = passageWindow(focus, peek, hasVerse);
  assert.deepEqual(complete.map((item) => `${item.surah}:${item.ayah}`), ['112:1', '112:2', '112:3', '112:4']);
  assert.equal(passageLookaheadComplete(complete, focus, hasVerse), true);
});

test('arabic stage hides the translation pane and still loads verse translation text', () => {
  assert.equal(SHOW_TRANSLATION_PANE, false);
  assert.equal(DEBUG_HUD_OVERLAYS_ARABIC, false);
  assert.ok(DEBUG_HUD_STAGE_INSET >= 8 && DEBUG_HUD_STAGE_INSET <= 24);
  assert.ok(FOCUSED_SCROLL_POSITION > 0.3 && FOCUSED_SCROLL_POSITION < 0.55);
  const row = verse(112, 3);
  assert.ok(row.translation.trim());
  const stageHeight = 560;
  const padding = passagePanePadding(stageHeight);
  const fatiha7Lines = 5;
  const arabicLineHeight = 66;
  assert.ok(padding * 2 + fatiha7Lines * arabicLineHeight < stageHeight);
  const verses = JSON.parse(readFileSync('assets/content/quran-display.json', 'utf8')).verses as Record<string, string>;
  const fatiha7 = (verses['1:7'] ?? '').normalize('NFKD').replace(/\p{M}/gu, '');
  assert.match(fatiha7, /مغضوب/);
  assert.match(fatiha7, /ضالين/);
});
