import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  emptyDebugHud,
  formatAyahRef,
  formatDebugHudLines,
  formatDebugHudMode,
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
import { DEBUG_HUD_OVERLAYS_ARABIC, DEBUG_HUD_STAGE_INSET } from '../src/core/passage';

test('debug HUD formats buf, mode, misses, and ASR last without percent certainty', () => {
  const lines = formatDebugHudLines({
    partialAsr: 'الحمد لله رب',
    inferenceMs: 84.4,
    matchMs: 12.2,
    bufferMs: 1200.4,
    lock: { surah: 1, ayah: 3 },
    candidate: { surah: 1, ayah: 4 },
    matchScore: 0.81,
    searchSpace: 'Locked: Ayahs 2–4',
    phase: 'following',
    mode: 'TRACKING',
    misses: 0,
    missThreshold: 3,
  });
  assert.deepEqual(lines, [
    'Inf 84ms  Match 12ms  Buf 1200ms',
    'Lock [1:3]  Cand [1:4]  Mode [TRACKING]',
    'Score 0.81  Misses [0/3]',
    'Space Locked: Ayahs 2–4',
    'ASR: الحمد لله رب',
  ]);
  assert.equal(lines.at(-1)?.startsWith('ASR:'), true);
  assert.equal(formatAyahRef(null), '—');
  assert.equal(formatMatchScore(null), '—');
  assert.equal(truncateAsr('a'.repeat(60)).endsWith('…'), true);
  assert.ok(!formatMatchScore(0.81).includes('%'));
  assert.equal(DEBUG_HUD_OVERLAYS_ARABIC, false);
  assert.ok(DEBUG_HUD_STAGE_INSET >= 8 && DEBUG_HUD_STAGE_INSET <= 24);
});

test('debug HUD mode maps acquire, neighborhood follow, and global search', () => {
  assert.equal(formatDebugHudMode({
    phase: 'acquiring', lock: null, searchSpace: 'Global Search',
  }), 'ACQUIRING');
  assert.equal(formatDebugHudMode({
    phase: 'following', lock: { surah: 1, ayah: 3 }, searchSpace: 'Locked: Ayahs 2–4',
  }), 'TRACKING');
  assert.equal(formatDebugHudMode({
    phase: 'following', lock: { surah: 1, ayah: 3 }, searchSpace: 'Next-surah pool',
  }), 'TRACKING');
  assert.equal(formatDebugHudMode({
    phase: 'following', lock: { surah: 1, ayah: 7 }, searchSpace: 'Global Search',
  }), 'GLOBAL');
  assert.equal(formatDebugHudMode({
    phase: 'reacquiring', lock: null, searchSpace: 'Global Search',
  }), 'GLOBAL');
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
