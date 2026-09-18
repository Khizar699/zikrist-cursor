import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  emptyDebugHud,
  formatAyahRef,
  formatDebugHudLines,
  formatMatchScore,
  formatSearchSpace,
  latestDebugHud,
  publishDebugHud,
  resetDebugHud,
  setDebugHudThrottleMs,
  snapshotDebugHud,
  subscribeDebugHud,
  truncateAsr,
} from '../src/core/debug-hud';

test('debug HUD formats lock vs candidate, scores, and search space without percent certainty', () => {
  const lines = formatDebugHudLines({
    partialAsr: 'الحمد لله رب',
    inferenceMs: 84.4,
    matchMs: 12.2,
    lock: { surah: 1, ayah: 3 },
    candidate: { surah: 1, ayah: 4 },
    matchScore: 0.81,
    searchSpace: 'Locked: Ayahs 2–4',
    phase: 'following',
  });
  assert.deepEqual(lines, [
    'ASR  الحمد لله رب',
    'Inf  84ms  Match 12ms',
    'Lock [1:3]  Cand [1:4]',
    'Score 0.81',
    'Space Locked: Ayahs 2–4',
  ]);
  assert.equal(formatAyahRef(null), '—');
  assert.equal(formatMatchScore(null), '—');
  assert.equal(truncateAsr('a'.repeat(60)).endsWith('…'), true);
  assert.ok(!formatMatchScore(0.81).includes('%'));
});

test('search space is global until a follow neighborhood exists', () => {
  assert.equal(formatSearchSpace({
    phase: 'acquiring', lock: null, previousAyah: null, nextAyah: null, globalLocate: false, nextSurahPool: false,
  }), 'Global Search');
  assert.equal(formatSearchSpace({
    phase: 'following',
    lock: { surah: 1, ayah: 3 },
    previousAyah: 2,
    nextAyah: 4,
    globalLocate: false,
    nextSurahPool: false,
  }), 'Locked: Ayahs 2–4');
  assert.equal(formatSearchSpace({
    phase: 'following',
    lock: { surah: 112, ayah: 4 },
    previousAyah: 3,
    nextAyah: null,
    globalLocate: false,
    nextSurahPool: true,
  }), 'Next-surah pool');
});

test('debug HUD throttle keeps the latest hop while published UI state lags', () => {
  resetDebugHud();
  setDebugHudThrottleMs(10_000);
  const seen: string[] = [];
  const stop = subscribeDebugHud(() => { seen.push(snapshotDebugHud().partialAsr); });
  const row = (text: string) => ({ ...emptyDebugHud(), partialAsr: text });
  publishDebugHud(row('first'));
  assert.equal(snapshotDebugHud().partialAsr, 'first');
  publishDebugHud(row('second'));
  assert.equal(latestDebugHud().partialAsr, 'second');
  assert.equal(snapshotDebugHud().partialAsr, 'first');
  stop();
  resetDebugHud();
  setDebugHudThrottleMs(120);
});
