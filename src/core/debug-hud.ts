import type { FollowerPhase, VerseRef } from './types';

export const DEBUG_HUD_THROTTLE_MS = 120;
export const DEBUG_HUD_ASR_MAX = 48;

export type DebugHudSnapshot = {
  partialAsr: string;
  inferenceMs: number;
  matchMs: number;
  lock: VerseRef | null;
  candidate: VerseRef | null;
  matchScore: number | null;
  searchSpace: string;
  phase: FollowerPhase;
};

export function emptyDebugHud(): DebugHudSnapshot {
  return {
    partialAsr: '',
    inferenceMs: 0,
    matchMs: 0,
    lock: null,
    candidate: null,
    matchScore: null,
    searchSpace: 'Global Search',
    phase: 'acquiring',
  };
}

export function formatAyahRef(ref: VerseRef | null | undefined): string {
  if (!ref) return '—';
  return `[${ref.surah}:${ref.ayah}]`;
}

export function formatMatchScore(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return '—';
  return Math.max(0, score).toFixed(2);
}

export function formatSearchSpace(input: {
  phase: FollowerPhase;
  lock: VerseRef | null;
  previousAyah: number | null;
  nextAyah: number | null;
  globalLocate: boolean;
  nextSurahPool: boolean;
}): string {
  if (input.nextSurahPool) return 'Next-surah pool';
  if (input.globalLocate || input.phase !== 'following' || !input.lock) return 'Global Search';
  const start = input.previousAyah ?? input.lock.ayah;
  const end = input.nextAyah ?? input.lock.ayah;
  return `Locked: Ayahs ${start}–${end}`;
}

export function truncateAsr(text: string, max = DEBUG_HUD_ASR_MAX): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, Math.max(1, max - 1))}…`;
}

export function formatDebugHudLines(snapshot: DebugHudSnapshot): string[] {
  return [
    `ASR  ${truncateAsr(snapshot.partialAsr) || '—'}`,
    `Inf  ${Math.round(snapshot.inferenceMs)}ms  Match ${Math.round(snapshot.matchMs)}ms`,
    `Lock ${formatAyahRef(snapshot.lock)}  Cand ${formatAyahRef(snapshot.candidate)}`,
    `Score ${formatMatchScore(snapshot.matchScore)}`,
    `Space ${snapshot.searchSpace}`,
  ];
}

let throttleMs = DEBUG_HUD_THROTTLE_MS;
let latest: DebugHudSnapshot = emptyDebugHud();
let published: DebugHudSnapshot = emptyDebugHud();
let lastEmit = 0;
let pending: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

export function setDebugHudThrottleMs(ms: number): void {
  throttleMs = Math.max(0, ms);
}

export function latestDebugHud(): DebugHudSnapshot {
  return latest;
}

export function snapshotDebugHud(): DebugHudSnapshot {
  return published;
}

export function subscribeDebugHud(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function publishDebugHud(next: DebugHudSnapshot): void {
  latest = next;
  if (throttleMs <= 0 || listeners.size === 0) {
    if (pending) {
      clearTimeout(pending);
      pending = null;
    }
    lastEmit = Date.now();
    published = latest;
    listeners.forEach((listener) => listener());
    return;
  }
  const now = Date.now();
  if (now - lastEmit >= throttleMs) {
    flushDebugHud();
    return;
  }
  if (pending) return;
  pending = setTimeout(() => {
    pending = null;
    flushDebugHud();
  }, throttleMs - (now - lastEmit));
}

export function flushDebugHud(): void {
  if (pending) {
    clearTimeout(pending);
    pending = null;
  }
  lastEmit = Date.now();
  published = latest;
  listeners.forEach((listener) => listener());
}

export function resetDebugHud(): void {
  if (pending) {
    clearTimeout(pending);
    pending = null;
  }
  lastEmit = 0;
  latest = emptyDebugHud();
  published = emptyDebugHud();
  listeners.forEach((listener) => listener());
}
