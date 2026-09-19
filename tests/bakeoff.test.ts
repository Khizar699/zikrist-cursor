import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  BAKEOFF_CANDIDATES,
  BAKEOFF_DEFAULT_ENGINE,
  BAKEOFF_SUITE_NAMES,
  canBecomeDefault,
  percentile,
  resolveBakeoffEngine,
  streamingWinsFollow,
  summarizeBakeoffClocks,
  summarizeSkipRate,
} from '../src/core/bakeoff';
import {
  beginRecognitionCapture,
  recordRecognitionCycle,
  resetRecognitionCycles,
  takeRecognitionCapture,
} from '../src/core/recognition-clocks';
import type { FollowSkip } from '../src/core/timeline';

test('live model loader still pins Tilawa FastConformer', () => {
  const src = readFileSync(new URL('../src/services/model.ts', import.meta.url), 'utf8');
  assert.match(src, /fastconformer_full_mixed\.onnx/);
  assert.doesNotMatch(src, /muno459|whisperkit|sherpa-onnx/i);
});

test('Tilawa stays the only default-eligible runnable bakeoff engine', () => {
  assert.equal(BAKEOFF_DEFAULT_ENGINE, 'tilawa');
  const tilawa = BAKEOFF_CANDIDATES.find((row) => row.id === 'tilawa');
  assert.ok(tilawa);
  assert.equal(canBecomeDefault(tilawa!), true);
  assert.equal(resolveBakeoffEngine(undefined).status, 'ok');
  assert.equal(resolveBakeoffEngine('tilawa').status, 'ok');
  for (const row of BAKEOFF_CANDIDATES) {
    if (row.id === 'tilawa') continue;
    assert.equal(row.defaultEligible, false, row.id);
    assert.equal(row.runnable, false, row.id);
    assert.equal(canBecomeDefault(row), false, row.id);
    const blocked = resolveBakeoffEngine(row.id);
    assert.equal(blocked.status, 'blocked');
    if (blocked.status === 'blocked') assert.ok(blocked.reason.length > 0);
  }
  const unknown = resolveBakeoffEngine('english-asr');
  assert.equal(unknown.status, 'blocked');
  if (unknown.status === 'blocked') assert.equal(unknown.reason, 'unknown_engine:english-asr');
});

test('Muno459 streaming cannot be the shipping TranscribeFn under NPL-1.1', () => {
  const muno = BAKEOFF_CANDIDATES.find((row) => row.id === 'muno459-streaming');
  assert.ok(muno);
  assert.match(muno!.license, /NPL-1\.1/);
  assert.match(muno!.blocker ?? '', /profit|revenue/i);
  const blocked = resolveBakeoffEngine('muno459-streaming');
  assert.equal(blocked.status, 'blocked');
});

test('bakeoff suites are the Phase C clip set, not the 14-suite floor', () => {
  assert.deepEqual([...BAKEOFF_SUITE_NAMES], [
    'nas', 'fatiha', 'ikhlas', 'jump',
    'imam-mid-surah-cold', 'imam-mid-surah-cold-qiyam',
  ]);
});

test('percentile uses nearest rank and skip rate is missed same-surah hops over expected hops', () => {
  assert.equal(percentile([], 95), null);
  assert.equal(percentile([10], 95), 10);
  assert.equal(percentile([1, 2, 3, 4], 50), 2);
  assert.equal(percentile([1, 2, 3, 4], 95), 4);
  const skips: FollowSkip[] = [{
    from: { surah: 114, ayah: 2 },
    to: { surah: 114, ayah: 4 },
    missed: 1,
    segment: 0,
  }];
  const nas = [1, 2, 3, 4, 5, 6].map((ayah) => ({ surah: 114, ayah }));
  assert.deepEqual(summarizeSkipRate(skips, nas), {
    expectedHops: 5,
    skipCount: 1,
    missedAyahs: 1,
    skipRate: 0.2,
  });
  assert.deepEqual(summarizeSkipRate([], nas), {
    expectedHops: 5,
    skipCount: 0,
    missedAyahs: 0,
    skipRate: 0,
  });
  assert.equal(summarizeSkipRate(skips, []).skipRate, 0);
});

test('five clocks stay separate and a streaming candidate wins follow only on p95 plus skip rate', () => {
  const clocks = summarizeBakeoffClocks({
    engineId: 'tilawa',
    loadMs: 800,
    firstLockAudioSeconds: 4,
    cycles: [
      { windowSec: 1, onnxMs: 90, decodeMs: 10, locateMs: 20, queueWaitMs: 0, stallMs: 0, phase: 'acquiring' },
      { windowSec: 1.2, onnxMs: 40, decodeMs: 5, locateMs: 0, queueWaitMs: 0, stallMs: 0, phase: 'following' },
      { windowSec: 1.2, onnxMs: 80, decodeMs: 5, locateMs: 0, queueWaitMs: 0, stallMs: 0, phase: 'following' },
    ],
    skips: [],
    expect: [{ surah: 112, ayah: 1 }, { surah: 112, ayah: 2 }],
  });
  assert.equal(clocks.coldReadyMs, 800);
  assert.equal(clocks.firstLockAudioSeconds, 4);
  assert.equal(clocks.evidenceDelayAudioSeconds, 4);
  assert.equal(clocks.trackingCycleCount, 2);
  assert.equal(clocks.trackingP50Ms, 45);
  assert.equal(clocks.trackingP95Ms, 85);
  assert.equal(clocks.displayMs, 0);
  assert.equal(clocks.displayPath, 'headless_sync_gate');
  assert.equal(clocks.skipRate, 0);
  const control = { trackingP95Ms: 85, skipRate: 0 };
  assert.equal(streamingWinsFollow(control, { trackingP95Ms: 40, skipRate: 0 }), true);
  assert.equal(streamingWinsFollow(control, { trackingP95Ms: 40, skipRate: 0.2 }), false);
  assert.equal(streamingWinsFollow(control, { trackingP95Ms: 90, skipRate: 0 }), false);
  assert.equal(streamingWinsFollow(control, { trackingP95Ms: null, skipRate: 0 }), false);
});

test('bakeoff capture keeps more than the live 32-cycle ring', () => {
  resetRecognitionCycles();
  beginRecognitionCapture();
  for (let index = 0; index < 40; index++) {
    recordRecognitionCycle({
      windowSec: 1.2,
      onnxMs: index,
      decodeMs: 0,
      locateMs: 0,
      queueWaitMs: 0,
      stallMs: 0,
      phase: 'following',
    });
  }
  const rows = takeRecognitionCapture();
  assert.equal(rows.length, 40);
  resetRecognitionCycles();
});
