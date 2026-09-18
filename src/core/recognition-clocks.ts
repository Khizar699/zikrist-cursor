import type { FollowerPhase } from './types';

/** One inference cycle. No audio, transcripts, tokens, or verse ids. */
export type RecognitionCycleTimings = {
  windowSec: number;
  onnxMs: number;
  decodeMs: number;
  locateMs: number;
  queueWaitMs: number;
  stallMs: number;
  phase: FollowerPhase;
};

const MAX_CYCLES = 32;
const recent: RecognitionCycleTimings[] = [];
let capturing = false;
const captured: RecognitionCycleTimings[] = [];

export function recordRecognitionCycle(row: RecognitionCycleTimings): void {
  recent.push(row);
  if (recent.length > MAX_CYCLES) recent.shift();
  if (capturing) captured.push(row);
}

export function lastRecognitionCycle(): RecognitionCycleTimings | undefined {
  return recent.at(-1);
}

export function recentRecognitionCycles(): readonly RecognitionCycleTimings[] {
  return recent;
}

/** Unbounded capture for bakeoff p95. Live UI still uses the 32-cycle ring. */
export function beginRecognitionCapture(): void {
  capturing = true;
  captured.length = 0;
}

export function takeRecognitionCapture(): RecognitionCycleTimings[] {
  capturing = false;
  const rows = captured.slice();
  captured.length = 0;
  return rows;
}

export function resetRecognitionCycles(): void {
  recent.length = 0;
  captured.length = 0;
  capturing = false;
}
