import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { VerseMatchMessage } from '@tilawa/core';
import { Timeline } from '../src/core/timeline';

const match = (surah: number, ayah: number): VerseMatchMessage => ({
  type: 'verse_match', surah, ayah, verse_text: '', surah_name: '', confidence: 0.9, surrounding_verses: [],
});

test('confirmed matches keep recitation order and repetitions, without duplicate UI commits', () => {
  const timeline = new Timeline();
  for (const [index, ref] of [[1, 1], [1, 1], [1, 2], [1, 1]].entries()) timeline.accept(match(ref[0]!, ref[1]!), index * 1000);
  assert.deepEqual(timeline.occurrences.map((item) => item.ayah), [1, 2, 1]);
  timeline.breakSegment(); timeline.accept(match(1, 1), 5000);
  assert.equal(timeline.occurrences.length, 4, 'A new recitation of the same verse must remain a separate occurrence');
});

test('candidates, heard words, and retrospective final paths cannot invent a displayed verse', () => {
  const timeline = new Timeline();
  timeline.accept({ type: 'verse_candidate', stable: true, final_flush: false, candidates: [{ surah: 1, ayah: 1, confidence: 0.99, source: 'discovery', rank: 0 }] }, 100);
  timeline.accept({ type: 'heard_words', words: ['qul'] }, 150);
  timeline.accept({ type: 'final_sequence', confidence: 0.99, verses: [{ surah: 1, ayah: 1, confidence: 0.99 }] }, 200);
  assert.equal(timeline.occurrences.length, 0);
});

test('word coverage applies only to the current occurrence and never exceeds unique matches', () => {
  const timeline = new Timeline(); timeline.accept(match(1, 1), 100);
  timeline.accept({ type: 'word_progress', surah: 1, ayah: 1, matched_indices: [0, 0, 1], total_words: 4, word_index: 1 }, 200);
  timeline.accept({ type: 'word_progress', surah: 1, ayah: 2, matched_indices: [0, 1, 2], total_words: 4, word_index: 2 }, 300);
  assert.equal(timeline.occurrences[0]!.matchedWords, 2);
});

test('a same-surah hop that skips an ayah is recorded without inventing that ayah', () => {
  const timeline = new Timeline();
  timeline.accept(match(114, 2), 100);
  timeline.accept(match(114, 4), 400);
  assert.deepEqual(timeline.occurrences.map((item) => item.ayah), [2, 4]);
  assert.equal(timeline.skips.length, 1);
  assert.deepEqual(timeline.skips[0], {
    from: { surah: 114, ayah: 2 },
    to: { surah: 114, ayah: 4 },
    missed: 1,
    segment: 0,
  });
});

test('ordered next ayah and a jump to another surah are not skips', () => {
  const timeline = new Timeline();
  timeline.accept(match(112, 1), 100);
  timeline.accept(match(112, 2), 200);
  timeline.accept(match(108, 1), 300);
  assert.equal(timeline.skips.length, 0);
});
