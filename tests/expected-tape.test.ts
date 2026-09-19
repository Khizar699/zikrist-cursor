import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  currentRemainder,
  expectedPhonemeScore,
  openingCousin,
  scoreExpectedTape,
} from '../src/core/expected-tape';

test('remainder after the last consumed word is empty', () => {
  assert.deepEqual(currentRemainder(['head', 'tail'], -1), ['head', 'tail']);
  assert.deepEqual(currentRemainder(['head', 'tail'], 0), ['tail']);
  assert.deepEqual(currentRemainder(['head', 'tail'], 1), []);
});

test('shared tail alone does not hear mushaf-next', () => {
  const tape = scoreExpectedTape(
    ['tail'],
    [],
    ['unique', 'tail'],
    ['head', 'tail'],
  );
  assert.equal(tape.nextHeard, false);
  assert.equal(tape.holdsLock, true);
  assert.deepEqual(tape.unexplainedDistinctive, []);
});

test('short next is heard from its own tokens after the current ayah is complete', () => {
  const tape = scoreExpectedTape(
    ['nextone', 'nexttwo'],
    [],
    ['nextone', 'nexttwo'],
    ['head', 'tail'],
  );
  assert.equal(tape.nextHeard, true);
  assert.equal(tape.nextHits, 2);
  assert.equal(tape.holdsLock, true);
});

test('joined tokens consume remainder then hear mushaf-next in one stream', () => {
  const tape = scoreExpectedTape(
    ['last', 'nextone', 'nexttwo'],
    ['last'],
    ['nextone', 'nexttwo'],
    ['head', 'last'],
  );
  assert.equal(tape.remainderHits, 1);
  assert.equal(tape.remainderLast, 0);
  assert.equal(tape.nextHeard, true);
  assert.equal(tape.nextHits, 2);
});

test('fully aligned short mushaf-next counts as nextHeard even when formula-only', () => {
  const tape = scoreExpectedTape(
    ['alrahman', 'alrahim'],
    [],
    ['alrahman', 'alrahim'],
    ['alhamdu', 'lillahi', 'rabbi', 'alalamin'],
  );
  assert.equal(tape.nextHeard, true);
  assert.equal(tape.nextHits, 2);
});

test('a formula next opening still needs a unique later token', () => {
  const shared = scoreExpectedTape(['allahu'], [], ['allahu', 'alsamad'], ['ahad', 'allahu']);
  assert.equal(shared.nextHeard, false);
  const unique = scoreExpectedTape(['allahu', 'alsamad'], [], ['allahu', 'alsamad'], ['ahad', 'allahu']);
  assert.equal(unique.nextHeard, true);
});

test('a partial prefix of the next opening counts as nextInProgress', () => {
  const tape = scoreExpectedTape(
    ['الرح'],
    [],
    ['الرحمن', 'الرحيم'],
    ['الحمد', 'لله', 'رب', 'العلمين'],
  );
  assert.equal(tape.nextInProgress, true);
  assert.equal(tape.nextHeard, false);
  assert.equal(tape.holdsLock, true);
  assert.equal(tape.nextHits, 1);
});

test('a short CTC cousin of the next opening still hears next', () => {
  assert.equal(openingCousin('الله', 'اله'), true);
  assert.equal(openingCousin('لم', 'لام'), true);
  const tape = scoreExpectedTape(
    ['tail', 'الله', 'tail'],
    [],
    ['اله', 'tail'],
    ['head', 'tail'],
  );
  assert.equal(tape.nextHeard, true);
});

test('Ikhlas 112:3 leftover is heard after 112:2 is complete', () => {
  const arabic = scoreExpectedTape(
    ['الصمد', 'لم', 'يلد'],
    [],
    ['لم', 'يلد', 'ولم', 'يولد'],
    ['الله', 'الصمد'],
  );
  assert.equal(arabic.nextHeard, true);
  const romanized = scoreExpectedTape(
    ['alsamad', 'lam', 'yalid'],
    [],
    ['lam', 'yalid', 'walam', 'yulad'],
    ['allahu', 'alsamad'],
  );
  assert.equal(romanized.nextHeard, true);
});

test('a next opening that is only a stem of the current body does not hear next', () => {
  const tape = scoreExpectedTape(
    ['sirat'],
    [],
    ['sirat', 'who'],
    ['guide', 'alsirat', 'straight'],
  );
  assert.equal(tape.nextHeard, false);
  assert.equal(tape.holdsLock, true);
});

test('CTC madd runs on the current ayah are not unexplained leftover', () => {
  const tape = scoreExpectedTape(
    ['الله', 'الصماااد'],
    [],
    ['لم', 'يلد'],
    ['الله', 'الصمد'],
  );
  assert.equal(tape.holdsLock, true);
  assert.deepEqual(tape.unexplainedDistinctive, []);
});

test('repeated CTC letters collapse before leftover is judged unexplained', () => {
  const tape = scoreExpectedTape(
    ['الصمد', 'يييلد'],
    [],
    ['لم', 'يلد', 'ولم', 'يولد'],
    ['الله', 'الصمد'],
  );
  assert.equal(tape.holdsLock, true);
  assert.ok(!tape.unexplainedDistinctive.includes('يييلد'));
});

test('a prefix/suffix cousin of the current ayah still holds the lock', () => {
  const tape = scoreExpectedTape(
    ['الصمدا'],
    [],
    ['لم', 'يلد'],
    ['الله', 'الصمد'],
  );
  assert.equal(tape.holdsLock, true);
  assert.deepEqual(tape.unexplainedDistinctive, []);
});

test('expected phonemes score remainder plus next, not a distant blob host', () => {
  const joined = 'last nextone nexttwo';
  const tape = expectedPhonemeScore(joined, ['last'], ['nextone', 'nexttwo']);
  const distant = expectedPhonemeScore(joined, [], ['long', 'unrelated', 'host', 'that', 'happens', 'to', 'contain', 'next']);
  assert.ok(tape > 0.8, `joined tape score too weak: ${tape}`);
  assert.ok(tape > distant, `distant host beat the expected tape: ${tape} vs ${distant}`);
});
