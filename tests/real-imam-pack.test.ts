import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  REAL_IMAM_CLIP_DIR,
  REAL_IMAM_SUITE_NAMES,
  loadRealImamSuiteSpec,
  suiteBlueprint,
} from '../scripts/replay-suites';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packDir = path.join(root, 'fixtures/real-imam');
const schemaPath = path.join(packDir, 'expected-locks.schema.json');
const manifestPath = path.join(packDir, 'manifest.json');

const REQUIRED_SPEC_KEYS = [
  'suite',
  'clipId',
  'status',
  'title',
  'description',
  'clips',
  'expect',
  'expected_first_lock',
  'gate',
  'notes',
  'license_status',
] as const;

test('real-imam pack ships schema, manifest, and five pending suite JSON files', () => {
  assert.equal(fs.existsSync(schemaPath), true);
  assert.equal(fs.existsSync(path.join(packDir, 'README.md')), true);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    suites: { suite_id: string; status: string; clip_path: string | string[] }[];
  };
  assert.deepEqual(
    manifest.suites.map((row) => row.suite_id),
    [...REAL_IMAM_SUITE_NAMES],
  );
  assert.equal(manifest.suites.every((row) => row.status === 'pending'), true);
});

test('each real-imam suite JSON matches the schema required keys and registry', () => {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as {
    required: string[];
    properties: Record<string, unknown>;
  };
  assert.deepEqual(schema.required, [...REQUIRED_SPEC_KEYS]);

  for (const name of REAL_IMAM_SUITE_NAMES) {
    const spec = loadRealImamSuiteSpec(name);
    for (const key of REQUIRED_SPEC_KEYS) {
      assert.notEqual(spec[key], undefined, `${name} missing ${key}`);
    }
    assert.equal(spec.suite, name);
    assert.equal(spec.status, 'pending');
    assert.match(spec.clipId, /^imam-[a-z0-9-]+__/);
    assert.ok(spec.clips.length >= 1);
    assert.ok(spec.clips.every((clip) => clip.endsWith('.wav')));
    assert.ok(spec.clips.every((clip) => clip.includes(`${name}__`)));
    if (spec.expected_first_lock && spec.expect[0]) {
      assert.deepEqual(spec.expected_first_lock, spec.expect[0]);
    }
    const blueprint = suiteBlueprint(name);
    assert.deepEqual(blueprint.clips, spec.clips);
    assert.equal(blueprint.clipDir, REAL_IMAM_CLIP_DIR);
    assert.equal(blueprint.readiness, 'pending');
    assert.equal(blueprint.expectedLocksPath, `fixtures/real-imam/suites/${name}.json`);
  }

  assert.equal(suiteBlueprint('imam-multi-qari').clips.length, 2);
  assert.equal(suiteBlueprint('imam-multi-qari').clipRunMode, 'each-clip');
});

test('real-imam clip directories contain no committed audio', () => {
  const clipRoot = path.join(root, REAL_IMAM_CLIP_DIR);
  const audio = fs.readdirSync(clipRoot, { recursive: true, encoding: 'utf8' })
    .filter((entry) => /\.(wav|mp3|m4a|mp4|aac|flac)$/i.test(String(entry)));
  assert.deepEqual(audio, []);
});
