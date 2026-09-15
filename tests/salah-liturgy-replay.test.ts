import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  DEFAULT_CLIP_DIR,
  LITURGY_CLIP_DIR,
  LITURGY_MANIFEST,
  LITURGY_SUITE_NAMES,
  MISSING_FIXTURE,
  SKIPPED_PENDING,
  evaluateFailure,
  loadSalahLiturgyStubEntry,
  loadSalahLiturgyStubManifest,
  parseSuiteSelection,
  suiteBlueprint,
  suiteClipRefs,
  suiteSkipsWhenClipMissing,
} from '../scripts/replay-suites';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const match = (surah: number, ayah: number, audioSeconds = 1) => ({
  surah,
  ayah,
  audioSeconds,
  score: 0.8,
});

const phrase = (phraseId: string, audioSeconds = 1, confidence = 0.9) => ({
  phraseId,
  audioSeconds,
  confidence,
});

const fatihaMatches = [
  match(1, 2, 9),
  match(1, 3, 12),
  match(1, 4, 17),
  match(1, 5, 21),
  match(1, 6, 28),
  match(1, 7, 35),
];

test('salah liturgy harness reads the committed stub manifest, not a duplicate pack', () => {
  const manifestPath = path.join(root, LITURGY_MANIFEST);
  assert.equal(fs.existsSync(manifestPath), true);
  const manifest = loadSalahLiturgyStubManifest();
  assert.equal(manifest.kind, 'salah_liturgy_replay');
  assert.equal(manifest.audio_root, LITURGY_CLIP_DIR);
  assert.deepEqual(
    manifest.suites.map((row) => row.suite_id),
    [...LITURGY_SUITE_NAMES],
  );
  assert.equal(loadSalahLiturgyStubEntry('liturgy-takbeer').status, 'ready');
  assert.equal(
    manifest.suites.filter((row) => row.suite_id !== 'liturgy-takbeer').every((row) => row.status === 'stub'),
    true,
  );
  assert.equal(fs.existsSync(path.join(root, 'prompts/salah-liturgy/04-replay-suites.md')), true);
});

test('sample skip JSON is skipped/missing_fixture, not PASS', () => {
  const sample = JSON.parse(
    fs.readFileSync(path.join(root, 'fixtures/salah-liturgy/sample-skip.json'), 'utf8'),
  ) as { suite: string; status: string; failureMode: string; phraseId: string | null; missingClips: string[] };
  assert.equal(sample.status, SKIPPED_PENDING);
  assert.equal(sample.failureMode, MISSING_FIXTURE);
  assert.equal(sample.phraseId, null);
  assert.equal(sample.suite, 'liturgy-thana');
  assert.deepEqual(sample.missingClips, suiteBlueprint('liturgy-thana').clips);
});

test('ready liturgy-takbeer maps to a real clip_path; remaining suites stay stubs', () => {
  assert.equal(MISSING_FIXTURE, 'missing_fixture');
  assert.equal(SKIPPED_PENDING, 'skipped');
  const takbeer = loadSalahLiturgyStubEntry('liturgy-takbeer');
  const takbeerSuite = suiteBlueprint('liturgy-takbeer');
  assert.equal(takbeer.status, 'ready');
  assert.equal(takbeerSuite.readiness, 'ready');
  assert.equal(suiteSkipsWhenClipMissing(takbeerSuite), false);
  assert.equal(takbeerSuite.gate, 'liturgy-phrase');
  assert.deepEqual(takbeer.expect_phrase_ids, ['takbeer']);
  assert.deepEqual(takbeer.expect_quran, []);
  assert.deepEqual(takbeerSuite.expectPhraseIds, ['takbeer']);
  assert.deepEqual(takbeerSuite.expect, []);
  assert.equal(takbeer.clip_path, 'liturgy-takbeer/liturgy-takbeer__edge-tts__ar-SA-HamedNeural.wav');
  assert.deepEqual(takbeerSuite.clips, ['liturgy-takbeer/liturgy-takbeer__edge-tts__ar-SA-HamedNeural.wav']);
  assert.equal(takbeerSuite.clipDir, LITURGY_CLIP_DIR);
  assert.equal(takbeerSuite.scoreLiturgy, true);
  assert.match(takbeer.notes, /edge-tts/);
  assert.match(takbeer.notes, /-25%/);
  assert.equal(takbeer.license_status, 'unresolved');
  for (const name of LITURGY_SUITE_NAMES) {
    if (name === 'liturgy-takbeer') continue;
    const entry = loadSalahLiturgyStubEntry(name);
    const blueprint = suiteBlueprint(name);
    assert.equal(entry.status, 'stub');
    assert.equal(blueprint.readiness, 'pending');
    assert.equal(suiteSkipsWhenClipMissing(blueprint), true);
    assert.equal(blueprint.expectedLocksPath, LITURGY_MANIFEST);
    assert.equal(blueprint.scoreLiturgy, true);
    assert.ok(blueprint.clips.length >= 1);
    assert.ok(blueprint.clips.every((clip) => clip.startsWith(`${name}/`)));
    assert.ok(blueprint.clips.every((clip) => clip.endsWith('.wav')));
    assert.deepEqual(blueprint.expectPhraseIds, entry.expect_phrase_ids);
    assert.deepEqual(blueprint.expect, entry.expect_quran);
    const stubPath = path.join(root, LITURGY_CLIP_DIR, blueprint.clips[0]!);
    assert.equal(fs.existsSync(stubPath), false);
  }
  assert.equal(suiteBlueprint('liturgy-tashahhud').allowPartialLiturgy, true);
  assert.equal(suiteBlueprint('liturgy-english-negative').gate, 'no-quran-no-liturgy');
});

test('mixed liturgy suites reuse EveryAyah Fatiha clips only for the Quran half', () => {
  const thenFatiha = suiteBlueprint('liturgy-then-fatiha');
  const afterTakbeer = suiteBlueprint('fatiha-then-takbeer');
  assert.deepEqual(thenFatiha.quranClips, [
    '001001.wav', '001002.wav', '001003.wav', '001004.wav',
    '001005.wav', '001006.wav', '001007.wav',
  ]);
  assert.equal(thenFatiha.quranClipDir, DEFAULT_CLIP_DIR);
  assert.equal(thenFatiha.quranClipPlacement, 'after');
  assert.equal(afterTakbeer.quranClipPlacement, 'before');
  assert.equal(thenFatiha.readiness, 'pending');
  const thenRefs = suiteClipRefs(thenFatiha);
  assert.equal(thenRefs[0]?.role, 'liturgy');
  assert.equal(thenRefs.at(-1)?.role, 'quran');
  const afterRefs = suiteClipRefs(afterTakbeer);
  assert.equal(afterRefs[0]?.role, 'quran');
  assert.equal(afterRefs.at(-1)?.role, 'liturgy');
  assert.equal(parseSuiteSelection(['all']).includes('liturgy-then-fatiha'), false);
});

test('liturgy-phrase fails on Quran verse_match and missing phrase locks', () => {
  const suite = suiteBlueprint('liturgy-takbeer');
  assert.equal(evaluateFailure([], suite, [phrase('takbeer')]), null);
  assert.equal(evaluateFailure([match(1, 2)], suite, [phrase('takbeer')]), 'verse_lock_1:2');
  assert.equal(evaluateFailure([], suite, []), 'no_liturgy_lock');
  assert.equal(
    evaluateFailure([], suite, [phrase('thana')]),
    'phrase_break_at_0_got_thana_expected_takbeer',
  );
});

test('tashahhud allows extra multi-window locks as long as tashahhud appears', () => {
  const suite = suiteBlueprint('liturgy-tashahhud');
  assert.equal(evaluateFailure([], suite, [phrase('tashahhud', 4)]), null);
  assert.equal(
    evaluateFailure([], suite, [phrase('takbeer', 1), phrase('tashahhud', 4)]),
    null,
  );
  assert.equal(evaluateFailure([], suite, [phrase('takbeer')]), 'missing_phrase_tashahhud');
});

test('liturgy-then-fatiha requires phrase locks before 1:2–7', () => {
  const suite = suiteBlueprint('liturgy-then-fatiha');
  const phrases = [phrase('takbeer', 1), phrase('thana', 3)];
  assert.equal(evaluateFailure(fatihaMatches, suite, phrases), null);
  assert.equal(evaluateFailure(fatihaMatches, suite, []), 'no_liturgy_lock');
  assert.equal(
    evaluateFailure([match(1, 2, 0.5), ...fatihaMatches.slice(1)], suite, phrases),
    'quran_before_liturgy_1:2',
  );
});

test('fatiha-then-takbeer treats a verse after 1:7 as a wrong ayah, not a liturgy lock', () => {
  const suite = suiteBlueprint('fatiha-then-takbeer');
  assert.equal(evaluateFailure(fatihaMatches, suite, [phrase('takbeer', 36)]), null);
  assert.equal(
    evaluateFailure([...fatihaMatches, match(2, 1, 36)], suite, [phrase('takbeer', 37)]),
    'verse_after_quran_2:1',
  );
  assert.equal(evaluateFailure(fatihaMatches, suite, []), 'no_liturgy_lock');
});

test('liturgy-english-negative PASSes only with neither Quran nor liturgy locks', () => {
  const suite = suiteBlueprint('liturgy-english-negative');
  assert.equal(evaluateFailure([], suite, []), null);
  assert.equal(evaluateFailure([match(112, 1)], suite, []), 'verse_lock_112:1');
  assert.equal(evaluateFailure([], suite, [phrase('takbeer')]), 'liturgy_lock_takbeer');
});
