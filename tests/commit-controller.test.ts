import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QuranDB, type QuranVerse } from '@tilawa/core';
import { decideLocationCommit, freshCommitState } from '../src/core/tracking/commit-controller';
import { applyMargin, scoreCandidate } from '../src/core/tracking/evidence';
import { TokenDocumentStats } from '../src/core/tracking/token-stats';

function verse(surah: number, ayah: number, words: string[]): QuranVerse {
  const phonemes_joined = words.join(' ');
  return {
    surah,
    ayah,
    text_uthmani: phonemes_joined,
    surah_name: 'Test',
    surah_name_en: 'Test',
    phonemes: phonemes_joined,
    phonemes_joined,
    phoneme_words: words,
  };
}

function dbFrom(rows: QuranVerse[]): QuranDB {
  return new QuranDB(rows.map((item) => ({ ...item, phoneme_words: [...item.phoneme_words] })));
}

test('reacquire rejects thin candidates when margin is zero', () => {
  const state = freshCommitState();
  const v = verse(114, 1, ['qul', 'audhu', 'birabbi', 'alnnas']);
  const bodyWords = v.phoneme_words;
  const stats = new TokenDocumentStats(dbFrom([v]));
  const evidence = scoreCandidate(0.61, ['qul', 'audhu'], stats, null, { surah: 114, ayah: 1 }, 'reacquiring');
  const decision = decideLocationCommit({
    kind: 'reacquire',
    from: null,
    verse: v,
    bodyWords,
    evidence,
    matchScore: 0.61,
    uniqueSecond: false,
    ayah2Ready: false,
    twoContiguous: false,
    voicedMs: 1000,
    hopId: 1,
    state,
    bodyHeardCount: 2,
    shortOpeningConfirmed: false,
  });
  assert.equal(decision.allow, false);
  assert.equal(decision.reason, 'reacquire_margin');
});

test('reacquire allows when runner-up margin clears the handoff bar', () => {
  const state = freshCommitState();
  const nas = verse(114, 1, ['qul', 'audhu', 'birabbi', 'alnnas']);
  const fil = verse(105, 1, ['alam', 'tara', 'kayfa', 'faAAala', 'rabbuka', 'bi', 'ashabi', 'alfil']);
  const stats = new TokenDocumentStats(dbFrom([nas, fil]));
  const recognized = ['qul', 'audhu', 'birabbi', 'alnnas'];
  const best = scoreCandidate(0.78, recognized, stats, null, { surah: 114, ayah: 1 }, 'reacquiring');
  const runnerUp = scoreCandidate(0.42, recognized, stats, null, { surah: 105, ayah: 1 }, 'reacquiring').total;
  const evidence = applyMargin(best, runnerUp);
  assert.ok(evidence.margin >= 0.12);
  const decision = decideLocationCommit({
    kind: 'reacquire',
    from: null,
    verse: nas,
    bodyWords: nas.phoneme_words,
    evidence,
    matchScore: 0.78,
    uniqueSecond: false,
    ayah2Ready: false,
    twoContiguous: true,
    voicedMs: 1200,
    hopId: 2,
    state,
    bodyHeardCount: 4,
    shortOpeningConfirmed: false,
  });
  assert.equal(decision.allow, true);
  assert.equal(decision.locationCommit, true);
});

test('cross-surah handoff rejects ayah 3 and beyond', () => {
  const state = freshCommitState();
  const fatiha7 = verse(1, 7, ['sirata', 'alladhina', 'anamta']);
  const maun3 = verse(107, 3, ['wala', 'yahud', 'ila', 'taam', 'almiskin']);
  const stats = new TokenDocumentStats(dbFrom([fatiha7, maun3]));
  const evidence = scoreCandidate(0.9, ['wala', 'yahud', 'ila'], stats, { surah: 1, ayah: 7 }, { surah: 107, ayah: 3 }, 'following');
  const decision = decideLocationCommit({
    kind: 'cross_surah_handoff',
    from: { surah: 1, ayah: 7 },
    verse: maun3,
    bodyWords: maun3.phoneme_words,
    evidence,
    matchScore: 0.9,
    uniqueSecond: true,
    ayah2Ready: false,
    twoContiguous: true,
    voicedMs: 2000,
    hopId: 3,
    state,
    bodyHeardCount: 2,
    shortOpeningConfirmed: false,
  });
  assert.equal(decision.allow, false);
  assert.equal(decision.reason, 'cross_surah_mid_ayah');
});

test('reacquire rejects mid-surah ayah with thin tokens and moderate score', () => {
  const state = freshCommitState();
  const yunus = verse(10, 2, ['akana', 'lilnnasi', 'ajaban', 'an', 'yakunuu', 'lana', 'waladun']);
  const nas = verse(114, 1, ['qul', 'audhu', 'birabbi', 'alnnas']);
  const stats = new TokenDocumentStats(dbFrom([yunus, nas]));
  const recognized = ['lilnnasi', 'akana'];
  const best = scoreCandidate(0.63, recognized, stats, null, { surah: 10, ayah: 2 }, 'reacquiring');
  const runnerUp = scoreCandidate(0.35, recognized, stats, null, { surah: 114, ayah: 1 }, 'reacquiring').total;
  const evidence = applyMargin(best, runnerUp);
  const decision = decideLocationCommit({
    kind: 'reacquire',
    from: null,
    verse: yunus,
    bodyWords: yunus.phoneme_words,
    evidence,
    matchScore: 0.63,
    uniqueSecond: false,
    ayah2Ready: false,
    twoContiguous: false,
    voicedMs: 900,
    hopId: 3,
    state,
    bodyHeardCount: 2,
    shortOpeningConfirmed: false,
  });
  assert.equal(decision.allow, false);
  assert.equal(decision.reason, 'reacquire_mid_ayah');
});
