import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  TRACKING_COMPLETION_COVERAGE, VISUAL_ADVANCE_COVERAGE,
  approachingSurahEnd, ayahsRemainingInSurah,
  isSequentialSuccessor, neighborhoodSurahs, nextSequentialRef, previousSequentialRef, shouldRevealSequentialNext,
} from '../src/core/sequential';
import type { VerseRef } from '../src/core/types';

const keys = new Set(['2:285', '2:286', '3:1', '112:1', '112:2', '112:3', '112:4', '113:1', '114:1', '114:6']);
const hasVerse = (ref: VerseRef) => keys.has(`${ref.surah}:${ref.ayah}`);

test('the next ayah in the same surah is the sequential successor', () => {
  assert.deepEqual(nextSequentialRef({ surah: 112, ayah: 1 }, hasVerse), { surah: 112, ayah: 2 });
  assert.equal(isSequentialSuccessor({ surah: 112, ayah: 3 }, { surah: 112, ayah: 4 }, hasVerse), true);
});

test('the last ayah of a surah continues into ayah 1 of the next surah', () => {
  assert.deepEqual(nextSequentialRef({ surah: 112, ayah: 4 }, hasVerse), { surah: 113, ayah: 1 });
  assert.deepEqual(nextSequentialRef({ surah: 2, ayah: 286 }, hasVerse), { surah: 3, ayah: 1 });
});

test('An-Nas has no following surah, and Al-Fatihah has no previous surah', () => {
  assert.equal(nextSequentialRef({ surah: 114, ayah: 6 }, hasVerse), null);
  assert.equal(previousSequentialRef({ surah: 1, ayah: 1 }, hasVerse), null);
  assert.deepEqual(previousSequentialRef({ surah: 3, ayah: 1 }, hasVerse), { surah: 2, ayah: 286 });
  assert.deepEqual(previousSequentialRef({ surah: 112, ayah: 2 }, hasVerse), { surah: 112, ayah: 1 });
  assert.deepEqual(neighborhoodSurahs(114), [114]);
  assert.deepEqual(neighborhoodSurahs(112), [112]);
  assert.equal(ayahsRemainingInSurah({ surah: 112, ayah: 3 }, hasVerse), 1);
  assert.equal(ayahsRemainingInSurah({ surah: 112, ayah: 4 }, hasVerse), 0);
  assert.equal(approachingSurahEnd({ surah: 112, ayah: 3 }, hasVerse), true);
  assert.equal(approachingSurahEnd({ surah: 112, ayah: 1 }, hasVerse), false);
});

test('same-surah coverage may focus the sequential next ayah without writing history', () => {
  const displayed = { surah: 112, ayah: 1 };
  const prepared = { surah: 112, ayah: 2 };
  assert.equal(VISUAL_ADVANCE_COVERAGE, TRACKING_COMPLETION_COVERAGE);
  assert.equal(shouldRevealSequentialNext({ displayed, prepared, wordIndex: 4, totalWords: 10, hasVerse }), false);
  assert.equal(shouldRevealSequentialNext({ displayed, prepared, wordIndex: 8, totalWords: 10, hasVerse }), false);
  assert.equal(shouldRevealSequentialNext({ displayed, prepared, wordIndex: 9, totalWords: 10, hasVerse }), true);
  assert.equal(shouldRevealSequentialNext({ displayed, prepared, wordIndex: 3, totalWords: 3, hasVerse }), true);
});

test('a jump or a skip ahead is not treated as sequential display', () => {
  const displayed = { surah: 2, ayah: 2 };
  assert.equal(shouldRevealSequentialNext({
    displayed, prepared: { surah: 112, ayah: 2 }, wordIndex: 10, totalWords: 10, hasVerse,
  }), false);
  assert.equal(shouldRevealSequentialNext({
    displayed: { surah: 112, ayah: 1 }, prepared: { surah: 112, ayah: 3 }, wordIndex: 10, totalWords: 10, hasVerse,
  }), false);
});

test('finishing the last ayah does not reveal the next surah', () => {
  assert.equal(shouldRevealSequentialNext({
    displayed: { surah: 112, ayah: 4 },
    prepared: { surah: 113, ayah: 1 },
    wordIndex: 5,
    totalWords: 5,
    hasVerse,
  }), false);
});
