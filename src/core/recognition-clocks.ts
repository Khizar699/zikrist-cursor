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

export function recordRecognitionCycle(row: RecognitionCycleTimings): void {
  recent.push(row);
  if (recent.length > MAX_CYCLES) recent.shift();
}

export function lastRecognitionCycle(): RecognitionCycleTimings | undefined {
  return recent.at(-1);
}

export function recentRecognitionCycles(): readonly RecognitionCycleTimings[] {
  return recent;
}

export function resetRecognitionCycles(): void {
  recent.length = 0;
}
