import type { RecognitionCycleTimings } from './recognition-clocks';
import type { FollowSkip } from './timeline';
import type { VerseRef } from './types';

/** Shipping TranscribeFn. Phase C measures others; it does not swap this. */
export const BAKEOFF_DEFAULT_ENGINE = 'tilawa';

/** Same-clip bakeoff set from `prompts/model-bakeoff.md`. */
export const BAKEOFF_SUITE_NAMES = [
  'nas',
  'fatiha',
  'ikhlas',
  'jump',
  'imam-mid-surah-cold',
  'imam-mid-surah-cold-qiyam',
] as const;

export type BakeoffCandidateRole =
  | 'control'
  | 'follow-eval'
  | 'locate-eval'
  | 'cloud-ceiling'
  | 'reference';

export type BakeoffCandidate = {
  id: string;
  role: BakeoffCandidateRole;
  /** May become the app default after a follow win + commercial license. */
  defaultEligible: boolean;
  /** Drop-in TranscribeFn exists in this repo today. */
  runnable: boolean;
  license: string;
  blocker: string | null;
};

export const BAKEOFF_CANDIDATES: readonly BakeoffCandidate[] = [
  {
    id: 'tilawa',
    role: 'control',
    defaultEligible: true,
    runnable: true,
    license: 'Tilawa MIT code; NVIDIA-derived FastConformer export CC BY 4.0 (see THIRD_PARTY_NOTICES.md)',
    blocker: null,
  },
  {
    id: 'cache-aware-fastconformer',
    role: 'follow-eval',
    defaultEligible: false,
    runnable: false,
    license: 'NVIDIA NeMo streaming FastConformer is typically CC BY 4.0; a Quran-token head is still required',
    blocker: 'Need a rights-cleared Quran-token ONNX with cache I/O, not English/BPE ASR. Not a drop-in for Tilawa logprobs [1,T,1025].',
  },
  {
    id: 'muno459-streaming',
    role: 'follow-eval',
    defaultEligible: false,
    runnable: false,
    license: 'Quran-Lab No-Profit License NPL-1.1 (Hugging Face Muno459/fastconformer-quran-streaming, reviewed 2026-09-18)',
    blocker: 'NPL-1.1 forbids profit, ads, subscriptions, and use inside a revenue-generating product. AGENTS.md requires commercially compatible dependencies.',
  },
  {
    id: 'tarteel-production-streaming',
    role: 'cloud-ceiling',
    defaultEligible: false,
    runnable: false,
    license: 'Tarteel production terms; network service',
    blocker: 'Cloud A/B only. Offline MVP cannot default to a network recognizer.',
  },
  {
    id: 'tarteel-whisper-base-ar-quran',
    role: 'locate-eval',
    defaultEligible: false,
    runnable: false,
    license: 'Model card Apache 2.0; training-data details incomplete',
    blocker: 'Locate bakeoff only. Whisper is not a tracker and is heavy on mid-range phones.',
  },
  {
    id: 'tilavet-whisperkit',
    role: 'reference',
    defaultEligible: false,
    runnable: false,
    license: 'Apple-only stack; do not port',
    blocker: 'Architecture reference only. Different stack; do not port.',
  },
];

export type BakeoffEngineResolution =
  | { status: 'ok'; engineId: typeof BAKEOFF_DEFAULT_ENGINE; candidate: BakeoffCandidate }
  | { status: 'blocked'; engineId: string; candidate: BakeoffCandidate | null; reason: string };

export function bakeoffCandidate(id: string): BakeoffCandidate | undefined {
  return BAKEOFF_CANDIDATES.find((row) => row.id === id);
}

/** Only a runnable, commercially eligible engine may run. Today that is Tilawa. */
export function resolveBakeoffEngine(requested?: string | null): BakeoffEngineResolution {
  const id = (requested ?? BAKEOFF_DEFAULT_ENGINE).trim() || BAKEOFF_DEFAULT_ENGINE;
  const candidate = bakeoffCandidate(id);
  if (!candidate) {
    return { status: 'blocked', engineId: id, candidate: null, reason: `unknown_engine:${id}` };
  }
  if (candidate.runnable && candidate.defaultEligible && candidate.id === BAKEOFF_DEFAULT_ENGINE) {
    return { status: 'ok', engineId: BAKEOFF_DEFAULT_ENGINE, candidate };
  }
  return {
    status: 'blocked',
    engineId: id,
    candidate,
    reason: candidate.blocker ?? `engine_not_runnable:${id}`,
  };
}

export type BakeoffClocks = {
  engineId: string;
  coldReadyMs: number;
  firstLockAudioSeconds: number | null;
  evidenceDelayAudioSeconds: number | null;
  trackingP50Ms: number | null;
  trackingP95Ms: number | null;
  trackingCycleCount: number;
  displayMs: number;
  displayPath: 'headless_sync_gate';
  expectedHops: number;
  skipCount: number;
  missedAyahs: number;
  skipRate: number;
};

export function percentile(values: readonly number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.min(sorted.length, Math.max(1, Math.ceil((p / 100) * sorted.length)));
  return sorted[rank - 1]!;
}

export function expectedSequentialHops(expect: readonly VerseRef[]): number {
  let hops = 0;
  for (let index = 1; index < expect.length; index++) {
    const prev = expect[index - 1]!;
    const next = expect[index]!;
    if (prev.surah === next.surah && next.ayah === prev.ayah + 1) hops += 1;
  }
  return hops;
}

export function summarizeSkipRate(
  skips: readonly FollowSkip[],
  expect: readonly VerseRef[],
): { expectedHops: number; skipCount: number; missedAyahs: number; skipRate: number } {
  const expectedHops = expectedSequentialHops(expect);
  const skipCount = skips.length;
  const missedAyahs = skips.reduce((sum, row) => sum + row.missed, 0);
  return {
    expectedHops,
    skipCount,
    missedAyahs,
    skipRate: expectedHops === 0 ? 0 : missedAyahs / expectedHops,
  };
}

function trackingMs(row: RecognitionCycleTimings): number {
  return row.onnxMs + row.decodeMs;
}

export function summarizeBakeoffClocks(input: {
  engineId?: string;
  loadMs: number;
  firstLockAudioSeconds: number | null;
  cycles: readonly RecognitionCycleTimings[];
  skips: readonly FollowSkip[];
  expect: readonly VerseRef[];
}): BakeoffClocks {
  const follow = input.cycles
    .filter((row) => row.phase === 'following')
    .map(trackingMs);
  const skips = summarizeSkipRate(input.skips, input.expect);
  return {
    engineId: input.engineId ?? BAKEOFF_DEFAULT_ENGINE,
    coldReadyMs: input.loadMs,
    firstLockAudioSeconds: input.firstLockAudioSeconds,
    evidenceDelayAudioSeconds: input.firstLockAudioSeconds,
    trackingP50Ms: percentile(follow, 50),
    trackingP95Ms: percentile(follow, 95),
    trackingCycleCount: follow.length,
    displayMs: 0,
    displayPath: 'headless_sync_gate',
    ...skips,
  };
}

/** Streaming wins follow only if tracking p95 drops and skip rate does not rise. */
export function streamingWinsFollow(
  control: Pick<BakeoffClocks, 'trackingP95Ms' | 'skipRate'>,
  candidate: Pick<BakeoffClocks, 'trackingP95Ms' | 'skipRate'>,
): boolean {
  if (control.trackingP95Ms == null || candidate.trackingP95Ms == null) return false;
  if (candidate.trackingP95Ms >= control.trackingP95Ms) return false;
  if (candidate.skipRate > control.skipRate) return false;
  return true;
}

export function canBecomeDefault(candidate: BakeoffCandidate): boolean {
  return candidate.defaultEligible && candidate.runnable && candidate.blocker === null;
}
