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
  assert.equal(manifest.suites.every((row) => row.status === 'stub'), true);
  assert.equal(fs.existsSync(path.join(root, 'prompts/real-imam/00-OVERNIGHT-QUEUE.md')), true);
  assert.equal(fs.existsSync(path.join(root, 'prompts/real-imam/FIXTURES.md')), true);
});

test('stub suites map to artifacts/recitation/imam paths and skip, not PASS', () => {
  assert.equal(MISSING_FIXTURE, 'missing_fixture');
  assert.equal(SKIPPED_PENDING, 'skipped');
  for (const name of REAL_IMAM_SUITE_NAMES) {
    const entry = loadRealImamStubEntry(name);
    const blueprint = suiteBlueprint(name);
    assert.equal(blueprint.clipDir, REAL_IMAM_CLIP_DIR);
    assert.equal(blueprint.readiness, 'pending');
    assert.equal(blueprint.expectedLocksPath, REAL_IMAM_MANIFEST);
    assert.ok(blueprint.clips.length >= 1);
    assert.ok(blueprint.clips.every((clip) => clip.startsWith(`${name}/`)));
    assert.ok(blueprint.clips.every((clip) => clip.endsWith('.wav')));
    assert.deepEqual(blueprint.expect, entry.expected_sequence);
    assert.equal(blueprint.expect.length, 0);
  }
  assert.equal(suiteBlueprint('imam-multi-qari').clipRunMode, 'each-clip');
  assert.equal(suiteBlueprint('imam-multi-qari').clips.length, 2);
  assert.ok(suiteBlueprint('imam-multi-qari').clips[0]?.includes('/qari-a/'));
  assert.ok(suiteBlueprint('imam-multi-qari').clips[1]?.includes('/qari-b/'));
});
