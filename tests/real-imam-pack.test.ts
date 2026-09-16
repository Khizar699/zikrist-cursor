import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  MISSING_FIXTURE,
  REAL_IMAM_CLIP_DIR,
  REAL_IMAM_MANIFEST,
  REAL_IMAM_SUITE_NAMES,
  SKIPPED_PENDING,
  loadRealImamStubEntry,
  loadRealImamStubManifest,
  suiteBlueprint,
  suiteSkipsWhenClipMissing,
} from '../scripts/replay-suites';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('real-imam harness reads Prompt Smith stub manifest, not a duplicate pack', () => {
  const manifestPath = path.join(root, REAL_IMAM_MANIFEST);
  assert.equal(fs.existsSync(manifestPath), true);
  const manifest = loadRealImamStubManifest();
  assert.equal(manifest.clip_drop, '~/Desktop/zikrist-imam-clips/');
  assert.equal(manifest.audio_root, REAL_IMAM_CLIP_DIR);
  assert.deepEqual(
    manifest.suites.map((row) => row.suite_id),
    [...REAL_IMAM_SUITE_NAMES],
  );
  assert.equal(loadRealImamStubEntry('imam-mid-surah-cold').status, 'ready');
  assert.equal(
    manifest.suites
      .filter((row) => row.suite_id !== 'imam-mid-surah-cold')
      .every((row) => row.status === 'stub'),
    true,
  );
  assert.equal(fs.existsSync(path.join(root, 'prompts/real-imam/00-OVERNIGHT-QUEUE.md')), true);
  assert.equal(fs.existsSync(path.join(root, 'prompts/real-imam/FIXTURES.md')), true);
});

test('founder labels exist as ground truth; only label-fill 01 flips mid-surah-cold', () => {
  const labelsPath = path.join(root, 'prompts/real-imam/LABELS.md');
  const jsonPath = path.join(root, 'prompts/real-imam/labels.json');
  assert.equal(fs.existsSync(labelsPath), true);
  assert.equal(fs.existsSync(jsonPath), true);
  const labelsMd = fs.readFileSync(labelsPath, 'utf8');
  assert.match(labelsMd, /Khizar/);
  assert.match(labelsMd, /4:129/);
  assert.match(labelsMd, /36:16/);
  const labels = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as {
    verified_by: string;
    verified_at: string;
    suite_candidates: {
      'imam-mid-ayah-pause': unknown[];
      notes: string;
      'imam-mid-surah-cold': Array<{ expected_first_lock: { surah: number; ayah: number } }>;
    };
  };
  assert.equal(labels.verified_by, 'Khizar Javed');
  assert.equal(labels.verified_at, '2026-09-16');
  assert.equal(labels.suite_candidates['imam-mid-ayah-pause'].length, 0);
  assert.match(labels.suite_candidates.notes, /Qunut/);
  const firstLocks = labels.suite_candidates['imam-mid-surah-cold'].map(
    (row) => `${row.expected_first_lock.surah}:${row.expected_first_lock.ayah}`,
  );
  assert.ok(firstLocks.includes('4:129'));
  assert.ok(firstLocks.includes('36:16'));
  assert.equal(loadRealImamStubEntry('imam-mid-surah-cold').status, 'ready');
  assert.equal(
    loadRealImamStubManifest().suites
      .filter((row) => row.suite_id !== 'imam-mid-surah-cold')
      .every((row) => row.status === 'stub'),
    true,
  );
});

test('ready imam-mid-surah-cold maps to founder Subayyal 4:129–130; other suites stay stubs', () => {
  assert.equal(MISSING_FIXTURE, 'missing_fixture');
  assert.equal(SKIPPED_PENDING, 'skipped');
  const entry = loadRealImamStubEntry('imam-mid-surah-cold');
  const blueprint = suiteBlueprint('imam-mid-surah-cold');
  assert.equal(entry.status, 'ready');
  assert.equal(blueprint.readiness, 'ready');
  assert.equal(suiteSkipsWhenClipMissing(blueprint), false);
  assert.equal(entry.clip_path, 'imam-mid-surah-cold__dr-subayyal__004-129-130__raw.wav');
  assert.deepEqual(entry.expected_first_lock, { surah: 4, ayah: 129 });
  assert.deepEqual(entry.expected_sequence, [
    { surah: 4, ayah: 129 },
    { surah: 4, ayah: 130 },
  ]);
  assert.deepEqual(blueprint.expect, entry.expected_sequence);
  assert.deepEqual(blueprint.clips, [
    'imam-mid-surah-cold/qari-a/imam-mid-surah-cold__dr-subayyal__004-129-130__raw.wav',
  ]);
  assert.equal(blueprint.clipDir, REAL_IMAM_CLIP_DIR);
  assert.equal(blueprint.gate, 'ordered-sequence');
  assert.equal(blueprint.expectedLocksPath, REAL_IMAM_MANIFEST);
  assert.match(entry.notes, /4:129-130/);
  assert.equal(entry.license_status, 'unresolved');
  for (const name of REAL_IMAM_SUITE_NAMES) {
    if (name === 'imam-mid-surah-cold') continue;
    const stub = loadRealImamStubEntry(name);
    const stubBlueprint = suiteBlueprint(name);
    assert.equal(stub.status, 'stub');
    assert.equal(stubBlueprint.clipDir, REAL_IMAM_CLIP_DIR);
    assert.equal(stubBlueprint.readiness, 'pending');
    assert.equal(suiteSkipsWhenClipMissing(stubBlueprint), true);
    assert.equal(stubBlueprint.expectedLocksPath, REAL_IMAM_MANIFEST);
    assert.ok(stubBlueprint.clips.length >= 1);
    assert.ok(stubBlueprint.clips.every((clip) => clip.startsWith(`${name}/`)));
    assert.ok(stubBlueprint.clips.every((clip) => clip.endsWith('.wav')));
    assert.deepEqual(stubBlueprint.expect, stub.expected_sequence);
    assert.equal(stubBlueprint.expect.length, 0);
  }
  assert.equal(suiteBlueprint('imam-multi-qari').clipRunMode, 'each-clip');
  assert.equal(suiteBlueprint('imam-multi-qari').clips.length, 2);
  assert.ok(suiteBlueprint('imam-multi-qari').clips[0]?.includes('/qari-a/'));
  assert.ok(suiteBlueprint('imam-multi-qari').clips[1]?.includes('/qari-b/'));
});
