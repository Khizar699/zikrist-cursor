import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ALL_SUITE_NAMES,
  CORE_SUITE_NAMES,
  COLD_START_TRIM_SECONDS,
  ENGLISH_NEGATIVE_CLIP,
  MISSING_FIXTURE,
  REAL_IMAM_SUITE_NAMES,
  SAMPLE_RATE,
  STALL_TRAILING_SILENCE_SECONDS,
  concatFloat32,
  evaluateFailure,
  insertSilenceAt,
  parseReplayCli,
  parseSuiteSelection,
  prepareSuiteAudio,
  silencePcm,
  suiteBlueprint,
  trimStartPcm,
  uniqueClipsForSuites,
  verseClipIdsFromSuites,
  wrongSurahStats,
} from '../scripts/replay-suites';

const match = (surah: number, ayah: number, audioSeconds = 1) => ({
  surah,
  ayah,
  audioSeconds,
  score: 0.8,
});

test('core suites keep Fatiha 1:2–1:7, Ikhlas 112:1–4, and Nas 114:1–6 gates', () => {
  assert.deepEqual([...CORE_SUITE_NAMES], ['fatiha', 'ikhlas', 'nas']);
  assert.deepEqual(suiteBlueprint('fatiha').expect, [
    { surah: 1, ayah: 2 },
    { surah: 1, ayah: 3 },
    { surah: 1, ayah: 4 },
    { surah: 1, ayah: 5 },
    { surah: 1, ayah: 6 },
    { surah: 1, ayah: 7 },
  ]);
  assert.equal(suiteBlueprint('fatiha').clips[0], '001001.wav');
  assert.deepEqual(suiteBlueprint('ikhlas').expect.map((ref) => `${ref.surah}:${ref.ayah}`), [
    '112:1', '112:2', '112:3', '112:4',
  ]);
  assert.deepEqual(suiteBlueprint('nas').expect.map((ref) => `${ref.surah}:${ref.ayah}`), [
    '114:1', '114:2', '114:3', '114:4', '114:5', '114:6',
  ]);
});

test('named suites use SSSAAA clip names and wire kawthar/falaq/asr/quraysh plus edge cases', () => {
  assert.deepEqual(suiteBlueprint('kawthar').clips, ['108001.wav', '108002.wav', '108003.wav']);
  assert.deepEqual(suiteBlueprint('falaq').clips, ['113001.wav', '113002.wav', '113003.wav', '113004.wav', '113005.wav']);
  assert.deepEqual(suiteBlueprint('asr').clips, ['103001.wav', '103002.wav', '103003.wav']);
  assert.deepEqual(suiteBlueprint('quraysh').clips, ['106001.wav', '106002.wav', '106003.wav', '106004.wav']);
  assert.deepEqual(suiteBlueprint('longer').clips, ['002001.wav', '002002.wav', '002003.wav', '002004.wav', '002005.wav']);
  assert.equal(suiteBlueprint('longer').description.includes('2:1–5'), true);
  assert.deepEqual(suiteBlueprint('jump').expect[0], { surah: 108, ayah: 1 });
  assert.deepEqual(suiteBlueprint('jump').expect.at(-1), { surah: 112, ayah: 4 });
  assert.deepEqual(suiteBlueprint('back-to-back').expect[0], { surah: 103, ayah: 1 });
  assert.deepEqual(suiteBlueprint('back-to-back').expect.at(-1), { surah: 106, ayah: 4 });
  assert.equal(suiteBlueprint('english-negative').clips[0], ENGLISH_NEGATIVE_CLIP);
  assert.equal(suiteBlueprint('english-negative').gate, 'no-verse-locks');
  assert.equal(suiteBlueprint('basmala-hold').clips[0], '001001.wav');
  assert.equal(suiteBlueprint('basmala-hold').gate, 'basmala-hold');
  assert.equal(suiteBlueprint('cold-start-mid').clips[0], '002002.wav');
  assert.equal(suiteBlueprint('cold-start-mid').trimStartSeconds, COLD_START_TRIM_SECONDS);
  assert.equal(suiteBlueprint('stall-after-lock').clips[0], '112002.wav');
  assert.equal(suiteBlueprint('stall-after-lock').trailingSilenceSeconds, STALL_TRAILING_SILENCE_SECONDS);
  assert.deepEqual([...ALL_SUITE_NAMES], [
    'fatiha', 'ikhlas', 'nas', 'kawthar', 'falaq', 'asr', 'quraysh',
    'longer', 'jump', 'english-negative', 'basmala-hold', 'back-to-back',
    'cold-start-mid', 'stall-after-lock',
  ]);
  assert.equal(ALL_SUITE_NAMES.length, 14);
});

test('parseSuiteSelection defaults to all suites and expands core', () => {
  assert.deepEqual(parseSuiteSelection([]), [...ALL_SUITE_NAMES]);
  assert.deepEqual(parseSuiteSelection(['all']), [...ALL_SUITE_NAMES]);
  assert.deepEqual(parseSuiteSelection(['core']), [...CORE_SUITE_NAMES]);
  assert.deepEqual(parseSuiteSelection(['kawthar', 'english-negative']), ['kawthar', 'english-negative']);
  assert.throws(() => parseSuiteSelection(['not-a-suite']), /Unknown suite/);
});

test('real-imam selection is pending-only and stays out of default all', () => {
  assert.deepEqual([...REAL_IMAM_SUITE_NAMES], [
    'imam-mid-surah-cold',
    'imam-mid-ayah-pause',
    'imam-surah-switch',
    'imam-noise-bleed',
    'imam-multi-qari',
  ]);
  assert.equal(parseSuiteSelection(['all']).some((name) => name.startsWith('imam-')), false);
  assert.deepEqual(parseSuiteSelection(['real-imam']), [...REAL_IMAM_SUITE_NAMES]);
  assert.deepEqual(
    parseSuiteSelection(['all'], { includePending: true }),
    [...ALL_SUITE_NAMES, ...REAL_IMAM_SUITE_NAMES],
  );
  assert.deepEqual(
    parseSuiteSelection(['all', 'real-imam']),
    [...ALL_SUITE_NAMES, ...REAL_IMAM_SUITE_NAMES],
  );
  assert.deepEqual(parseSuiteSelection(['imam-mid-surah-cold']), ['imam-mid-surah-cold']);
  assert.equal(suiteBlueprint('imam-mid-surah-cold').readiness, 'pending');
  assert.equal(suiteBlueprint('imam-mid-surah-cold').clipDir, 'fixtures/real-imam/clips');
  assert.equal(suiteBlueprint('imam-multi-qari').clipRunMode, 'each-clip');
  assert.equal(MISSING_FIXTURE, 'missing_fixture');
});

test('parseReplayCli extracts include-pending and list flags', () => {
  assert.deepEqual(parseReplayCli(['--list', 'real-imam']), {
    help: false,
    list: true,
    checkFixtures: false,
    includePending: false,
    wavArgs: [],
    namedArgs: ['real-imam'],
  });
  assert.equal(parseReplayCli(['all', '--include-pending']).includePending, true);
});

test('english-negative is an inverted gate: PASS only when no verse commits', () => {
  const suite = suiteBlueprint('english-negative');
  assert.equal(evaluateFailure([], suite), null);
  assert.equal(evaluateFailure([match(112, 1)], suite), 'verse_lock_112:1');
  assert.equal(evaluateFailure([match(1, 2)], suite), 'verse_lock_1:2');
  assert.deepEqual(wrongSurahStats([match(2, 1)], suite.expect, suite.gate), {
    wrongSurahCount: 1,
    wrongSurahRate: 1,
    firstLockWrongSurah: true,
  });
  assert.deepEqual(wrongSurahStats([], suite.expect, suite.gate), {
    wrongSurahCount: 0,
    wrongSurahRate: 0,
    firstLockWrongSurah: false,
  });
});

test('basmala-hold passes only when 001001 produces no verse locks', () => {
  const suite = suiteBlueprint('basmala-hold');
  assert.equal(evaluateFailure([], suite), null);
  assert.equal(evaluateFailure([match(1, 1)], suite), 'locked_fatiha_1:1');
  assert.equal(evaluateFailure([match(17, 110)], suite), 'locked_17:110');
  assert.equal(wrongSurahStats([match(1, 1)], suite.expect, suite.gate).wrongSurahRate, 1);
});

test('ordered Fatiha still flags Ibrahim first locks and wrong first ayahs', () => {
  const suite = suiteBlueprint('fatiha');
  assert.equal(evaluateFailure([match(14, 40)], suite), 'first_lock_ibrahim_14:40');
  assert.equal(evaluateFailure([match(37, 182)], suite), 'first_lock_37:182_expected_1:2');
  assert.equal(evaluateFailure([
    match(1, 2), match(1, 3), match(1, 4), match(1, 5), match(1, 6), match(1, 7),
  ], suite), null);
  assert.equal(evaluateFailure([match(1, 2), match(1, 4)], suite), 'sequence_break_at_1_got_1:4_expected_1:3');
});

test('stall-after-lock fails if the follower jumps after the first correct lock', () => {
  const suite = suiteBlueprint('stall-after-lock');
  assert.equal(evaluateFailure([match(112, 2)], suite), null);
  assert.equal(evaluateFailure([], suite), 'no_matches');
  assert.equal(evaluateFailure([match(112, 1)], suite), 'first_lock_112:1_expected_112:2');
  assert.equal(evaluateFailure([match(112, 2), match(74, 29)], suite), 'jumped_during_silence_74:29');
});

test('wrongSurahRate counts locks whose surah is outside the expected set', () => {
  const suite = suiteBlueprint('ikhlas');
  const stats = wrongSurahStats([match(17, 110), match(112, 1)], suite.expect, suite.gate);
  assert.equal(stats.wrongSurahCount, 1);
  assert.equal(stats.wrongSurahRate, 0.5);
  assert.equal(stats.firstLockWrongSurah, true);
  assert.equal(wrongSurahStats([match(112, 1)], suite.expect, suite.gate).wrongSurahRate, 0);
});

test('PCM concat, trim, and stall pad stay in the harness helpers', () => {
  const first = new Float32Array([1, 2, 3, 4]);
  const second = new Float32Array([5, 6]);
  assert.deepEqual([...concatFloat32([first, second])], [1, 2, 3, 4, 5, 6]);
  assert.equal(silencePcm(2, SAMPLE_RATE).length, SAMPLE_RATE * 2);
  const trimmed = trimStartPcm(new Float32Array(SAMPLE_RATE * 2), 0.75);
  assert.equal(trimmed.length, SAMPLE_RATE * 1.25);
  assert.throws(() => trimStartPcm(new Float32Array(10), 1, 16), /trim_exhausted/);
  const prepared = prepareSuiteAudio([new Float32Array(SAMPLE_RATE)], {
    trimStartSeconds: 0.25,
    trailingSilenceSeconds: 4,
  });
  assert.equal(prepared.audio.length, SAMPLE_RATE * 0.75);
  assert.equal(prepared.trailingSilenceSeconds, 4);
  const withGap = insertSilenceAt(new Float32Array([1, 2, 3, 4]), 2 / SAMPLE_RATE, 3 / SAMPLE_RATE, SAMPLE_RATE);
  assert.equal(withGap.length, 7);
  assert.deepEqual([...withGap], [1, 2, 0, 0, 0, 3, 4]);
  const skippedNullGap = prepareSuiteAudio([new Float32Array(4)], {
    insertSilence: [{ atAudioSeconds: null, durationSeconds: 1 }],
  });
  assert.equal(skippedNullGap.audio.length, 4);
});

test('verse clip ids stay SSSAAA and include every downloaded surah', () => {
  const ids = verseClipIdsFromSuites();
  assert.ok(ids.includes('001001'));
  assert.ok(ids.includes('002005'));
  assert.ok(ids.includes('108001'));
  assert.ok(ids.includes('103001'));
  assert.ok(ids.includes('106004'));
  assert.ok(ids.includes('113005'));
  assert.ok(ids.includes('112002'));
  assert.equal(ids.some((id) => id.startsWith('english')), false);
  assert.deepEqual(uniqueClipsForSuites(['basmala-hold', 'english-negative']), [
    '001001.wav',
    ENGLISH_NEGATIVE_CLIP,
  ]);
  assert.equal(ids.some((id) => id.includes('imam-')), false);
});
