import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { VerseMatchMessage, WordProgressMessage } from '@tilawa/core';
import { ContinuationGate } from '../src/core/continuation-gate';

const match = (surah: number, ayah: number): VerseMatchMessage => ({ type: 'verse_match', surah, ayah, confidence: 0.9, verse_text: '', surah_name: '', surrounding_verses: [] });
const progress = (surah: number, ayah: number, matched = [0, 1], total = 4): WordProgressMessage => ({ type: 'word_progress', surah, ayah, word_index: matched.at(-1)! + 1, matched_indices: matched, total_words: total });
const make = () => new ContinuationGate((ref) => ({ surah: ref.surah, ayah: ref.ayah + 1 }));

test('a unique first match displays immediately and expected next verses stay on the fast path', () => {
  const gate = make();
  assert.deepEqual(gate.accept([match(112, 2)], 1000, true), [match(112, 2)]);
  assert.deepEqual(gate.accept([match(112, 3)], 2200, true), [match(112, 3)]);
});

test('Al-Fatihah 1:1 is not shown from Basmala alone; 1:2 confirms the opening', () => {
  const gate = make();
  assert.deepEqual(gate.accept([match(1, 1)], 1000, true), []);
  assert.ok(gate.isAmbiguousOpening);
  assert.deepEqual(gate.accept([progress(1, 1, [0, 1, 2, 3], 4)], 1800, true), []);
  assert.deepEqual(gate.accept([match(1, 2)], 2500, true), [match(1, 1), match(1, 2)]);
  assert.equal(gate.isAmbiguousOpening, false);
});

test('Ikhlas 112:1 waits for a unique word after Basmala, not Qul alone', () => {
  const gate = make();
  assert.deepEqual(gate.accept([match(112, 1)], 1000, true), []);
  assert.deepEqual(gate.accept([progress(112, 1, [0, 1, 2, 3], 8)], 1500, true), []);
  assert.deepEqual(gate.accept([progress(112, 1, [4], 8)], 1600, true), []);
  const unique = progress(112, 1, [4, 5], 8);
  assert.deepEqual(gate.accept([unique], 1800, true), [match(112, 1), unique]);
});

test('Basmala then Ikhlas does not keep Al-Fatihah', () => {
  const gate = make();
  gate.accept([match(1, 1)], 1000, true);
  gate.accept([match(112, 1)], 2000, true);
  const unique = progress(112, 1, [4, 5], 8);
  assert.deepEqual(gate.accept([unique], 2500, true), [match(112, 1), unique]);
});

test('a silence-flush first match cannot display until later voiced progress', () => {
  const gate = make();
  assert.deepEqual(gate.accept([match(112, 2)], 1000, false), []);
  assert.deepEqual(gate.accept([progress(112, 2)], 1000, false), []);
  assert.ok(gate.isCheckingJump);
  assert.deepEqual(gate.accept([progress(112, 2)], 1600, true), [match(112, 2), progress(112, 2)]);
});

test('silence and old word progress cannot confirm an unrelated verse', () => {
  const gate = make();
  gate.accept([match(112, 4)], 9000, true);
  assert.deepEqual(gate.accept([match(74, 29)], 10500, false), []);
  assert.deepEqual(gate.accept([progress(74, 29)], 10500, false), []);
  assert.ok(gate.isCheckingJump);
});

test('a real jump can recover after new voiced evidence and matching progress', () => {
  const gate = make();
  gate.accept([match(2, 2)], 2000, true);
  assert.deepEqual(gate.accept([match(112, 2)], 3000, true), [match(112, 2)]);
  assert.equal(gate.isCheckingJump, false);
});

test('a capture reset clears pending evidence before acquisition restarts', () => {
  const gate = make();
  gate.accept([match(2, 2)], 2000, true);
  gate.accept([match(112, 2)], 3000, true);
  gate.reset();
  assert.equal(gate.isCheckingJump, false);
  assert.deepEqual(gate.accept([match(112, 2)], 500, true), [match(112, 2)]);
});

test('dropping pending jump evidence keeps the last accepted verse', () => {
  const gate = make();
  gate.accept([match(112, 2)], 2000, true);
  gate.accept([match(74, 29)], 3000, true);
  assert.equal(gate.isCheckingJump, true);
  gate.dropPending();
  assert.equal(gate.isCheckingJump, false);
  assert.deepEqual(gate.accept([match(112, 3)], 4000, true), [match(112, 3)]);
});

test('a jump from the last ayah can confirm with voiced unique words', () => {
  const gate = new ContinuationGate((ref) => (
    ref.surah === 114 && ref.ayah === 6 ? undefined : { surah: ref.surah, ayah: ref.ayah + 1 }
  ));
  gate.accept([match(114, 6)], 2000, true);
  assert.deepEqual(gate.accept([match(1, 2)], 3000, true), [match(1, 2)]);
  assert.equal(gate.isCheckingJump, false);
});

test('last ayah of a short surah paints the next surah immediately', () => {
  const gate = new ContinuationGate((ref) => (
    ref.surah === 109 && ref.ayah === 6 ? { surah: 110, ayah: 1 } : { surah: ref.surah, ayah: ref.ayah + 1 }
  ));
  gate.accept([match(109, 6)], 2000, true);
  // Salah-prior ayah 1 (Fil / Kawthar) must paint from verse_match alone.
  assert.deepEqual(gate.accept([match(105, 1)], 3000, true), [match(105, 1)]);
  assert.equal(gate.isCheckingJump, false);
  assert.deepEqual(gate.accept([match(108, 1)], 4000, true), [match(108, 1)]);
});

test('two matched words cannot confirm a long unrelated jump', () => {
  const gate = make();
  gate.accept([match(114, 3)], 2000, true);
  assert.deepEqual(gate.accept([match(2, 109)], 3000, true), []);
  assert.deepEqual(gate.accept([progress(2, 109, [0, 1], 33)], 3600, true), []);
  assert.ok(gate.isCheckingJump);
  const enough = progress(2, 109, [0, 1, 2, 3, 4], 33);
  assert.deepEqual(gate.accept([enough], 3600, true), [match(2, 109), enough]);
});

test('a long jump cannot confirm from mid-verse word hits without the opening', () => {
  const gate = make();
  gate.accept([match(114, 3)], 2000, true);
  gate.accept([match(2, 109)], 3000, true);
  assert.deepEqual(gate.accept([progress(2, 109, [8, 9, 10, 11, 12], 33)], 3600, true), []);
  assert.ok(gate.isCheckingJump);
});

test('mushaf-next salah-prior ayah 1 paints immediately without word_progress', () => {
  const gate = new ContinuationGate((ref) => (
    ref.surah === 112 && ref.ayah === 4 ? { surah: 113, ayah: 1 } : { surah: ref.surah, ayah: ref.ayah + 1 }
  ));
  gate.accept([match(112, 4)], 2000, true);
  assert.deepEqual(gate.accept([match(113, 1)], 3000, true), [match(113, 1)]);
  assert.equal(gate.isCheckingJump, false);
});

test('mushaf-next Baqarah after Fatiha still waits for words after the shared Basmala', () => {
  const gate = new ContinuationGate((ref) => (
    ref.surah === 1 && ref.ayah === 7 ? { surah: 2, ayah: 1 } : { surah: ref.surah, ayah: ref.ayah + 1 }
  ));
  gate.accept([match(1, 7)], 2000, true);
  assert.deepEqual(gate.accept([match(2, 1)], 3000, true), []);
  assert.ok(gate.isCheckingJump);
  const unique = progress(2, 1, [4], 5);
  assert.deepEqual(gate.accept([unique], 3600, true), [match(2, 1), unique]);
});

test('heard words still surface while a first ayah-1 match is held', () => {
  const gate = make();
  const draft = { type: 'heard_words' as const, words: ['qul'] };
  assert.deepEqual(gate.accept([draft, match(112, 1)], 1000, true), [draft]);
  assert.ok(gate.isAmbiguousOpening);
});

test('an initial speculative match and old-window progress cannot display a verse', () => {
  const gate = make();
  assert.deepEqual(gate.accept([match(68, 11), progress(68, 11)], 2000, false), []);
  assert.deepEqual(gate.accept([progress(68, 11)], 2000, false), []);
  gate.reset();
  assert.equal(gate.isCheckingJump, false);
});

test('a one-word ayah-1 body after Basmala confirms on that unique word', () => {
  const gate = make();
  assert.deepEqual(gate.accept([match(103, 1)], 1000, true), []);
  const body = progress(103, 1, [4], 5);
  assert.deepEqual(gate.accept([body], 1100, true), [match(103, 1), body]);
});

test('a longer ayah-1 body still waits past the first post-Basmala word', () => {
  const gate = make();
  assert.deepEqual(gate.accept([match(106, 1)], 1000, true), []);
  assert.deepEqual(gate.accept([progress(106, 1, [4], 6)], 1100, true), []);
  const unique = progress(106, 1, [4, 5], 6);
  assert.deepEqual(gate.accept([unique], 1200, true), [match(106, 1), unique]);
});

test('ayah-1 with only a post-Basmala body word confirms on that word', () => {
  const gate = make();
  assert.deepEqual(gate.accept([match(2, 1)], 1000, true), []);
  const unique = progress(2, 1, [4], 5);
  assert.deepEqual(gate.accept([unique], 1200, true), [match(2, 1), unique]);
});

test('pending ayah-1 then same-surah ayah-2 displays both in order', () => {
  const gate = make();
  assert.deepEqual(gate.accept([match(2, 1)], 1000, true), []);
  assert.deepEqual(gate.accept([match(2, 2)], 2500, true), [match(2, 1), match(2, 2)]);
});

test('Fatiha last ayah paints An-Nas ayah-1 immediately even without word_progress', () => {
  const gate = new ContinuationGate((ref) => (
    ref.surah === 1 && ref.ayah === 7 ? { surah: 2, ayah: 1 } : { surah: ref.surah, ayah: ref.ayah + 1 }
  ));
  gate.accept([match(1, 7)], 2000, true);
  assert.deepEqual(gate.accept([match(114, 1)], 3000, false), [match(114, 1)]);
  assert.equal(gate.isCheckingJump, false);
});

test('Ikhlas cold-start ayah-1 still waits for a unique word after Basmala', () => {
  const gate = make();
  assert.deepEqual(gate.accept([match(112, 1)], 1000, true), []);
  assert.ok(gate.isCheckingJump);
});
