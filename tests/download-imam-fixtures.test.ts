import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_IMAM_RELEASE_TAG,
  IMAM_RELEASE_ASSET,
  findSuiteWav,
  imamFixturesAlreadyPresent,
  imamFixturesReleaseUrl,
  imamFixturesReleasesPageUrl,
  missingImamReleaseError,
  parseImamFixturesArgs,
  resolveImamPayloadRoot,
  resolveImamReleaseTag,
} from '../scripts/download-imam-fixtures';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('imam release URL uses public GitHub download path and configurable tag', () => {
  assert.equal(
    imamFixturesReleaseUrl({ tag: 'imam-fixtures-v1' }),
    `https://github.com/Khizar699/zikrist-cursor/releases/download/imam-fixtures-v1/${IMAM_RELEASE_ASSET}`,
  );
  assert.equal(
    imamFixturesReleaseUrl({ tag: 'imam-fixtures-v2' }),
    `https://github.com/Khizar699/zikrist-cursor/releases/download/imam-fixtures-v2/${IMAM_RELEASE_ASSET}`,
  );
  assert.equal(resolveImamReleaseTag({}), DEFAULT_IMAM_RELEASE_TAG);
  assert.equal(resolveImamReleaseTag({ ZIKRIST_IMAM_RELEASE_TAG: '  custom-tag  ' }), 'custom-tag');
  assert.equal(imamFixturesReleaseUrl({ env: { ZIKRIST_IMAM_RELEASE_TAG: 'nightly' } }).includes('/nightly/'), true);
  assert.equal(imamFixturesReleasesPageUrl(), 'https://github.com/Khizar699/zikrist-cursor/releases');
});

test('imam fixture CLI parses --force and rejects unknown flags', () => {
  assert.deepEqual(parseImamFixturesArgs([]), { force: false, help: false });
  assert.deepEqual(parseImamFixturesArgs(['--force']), { force: true, help: false });
  assert.deepEqual(parseImamFixturesArgs(['-f', '-h']), { force: true, help: true });
  assert.throws(() => parseImamFixturesArgs(['--ready']), /Unknown argument/);
});

test('skip helper requires LABELS.md and a real suite wav', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zikrist-imam-present-'));
  try {
    assert.equal(imamFixturesAlreadyPresent(dir), false);
    fs.writeFileSync(path.join(dir, 'LABELS.md'), 'ground truth\n');
    assert.equal(imamFixturesAlreadyPresent(dir), false);
    const wavDir = path.join(dir, 'imam-mid-surah-cold', 'qari-a');
    fs.mkdirSync(wavDir, { recursive: true });
    fs.writeFileSync(path.join(wavDir, 'tiny.wav'), 'short');
    assert.equal(imamFixturesAlreadyPresent(dir), false);
    const wav = path.join(wavDir, 'imam-mid-surah-cold__dr-subayyal__004-129-130__raw.wav');
    fs.writeFileSync(wav, Buffer.alloc(1500, 1));
    assert.equal(findSuiteWav(dir), wav);
    assert.equal(imamFixturesAlreadyPresent(dir), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('payload root accepts zip layouts with LABELS.md at root or nested imam dir', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zikrist-imam-payload-'));
  try {
    fs.writeFileSync(path.join(dir, 'LABELS.md'), 'ok\n');
    assert.equal(resolveImamPayloadRoot(dir), dir);
    const nested = fs.mkdtempSync(path.join(os.tmpdir(), 'zikrist-imam-nested-'));
    try {
      const imam = path.join(nested, 'bundle', 'artifacts/recitation/imam');
      fs.mkdirSync(imam, { recursive: true });
      fs.mkdirSync(path.join(imam, '_inbox'));
      assert.equal(resolveImamPayloadRoot(nested), imam);
    } finally {
      fs.rmSync(nested, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('missing-release error names the Releases page and expected zip', () => {
  const url = imamFixturesReleaseUrl({ tag: DEFAULT_IMAM_RELEASE_TAG });
  const message = missingImamReleaseError(url).message;
  assert.match(message, /HTTP 404/);
  assert.match(message, /imam-fixtures-v1/);
  assert.match(message, /zikrist-imam-fixtures-v1\.zip/);
  assert.match(message, /github.com\/Khizar699\/zikrist-cursor\/releases/);
  assert.match(message, /git LFS/);
});
