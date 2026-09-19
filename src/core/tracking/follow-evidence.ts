import type { TapeScore } from '../expected-tape';
import type { VerseRef } from '../types';
import { temporalAccumulate, TEMPORAL_DECAY } from './evidence';

export type FollowEvidenceVerdict = 'supported' | 'uncertain' | 'contradicted';

export type FollowEvidenceResult = {
  verdict: FollowEvidenceVerdict;
  /** Sticky location: do not drop lock on this hop. */
  stickyLocation: boolean;
  positiveEvidence: number;
  negativeEvidence: number;
};

export type ClassifyFollowEvidenceInput = {
  tape: TapeScore;
  advanced: boolean;
  sharedPrefixOnly: boolean;
  neighborhood: number;
  neighborhoodKeep: number;
  recognized: string[];
  contradictoryLocalScore: number;
  contradictoryLocalMargin: number;
  /** Local score bar for a competing ayah in the follow window. */
  localContradictionScore: number;
};

/** ASR tokens with no mushaf alignment signal (garbled / empty). */
export function transcriptUnusable(recognized: string[]): boolean {
  if (!recognized.length) return true;
  const usable = recognized.filter((token) => {
    const text = token.replace(/\s+/g, '');
    return text.length >= 3 && /[\u0621-\u064Aa-z]/i.test(text);
  });
  return usable.length === 0;
}

export function classifyFollowEvidence(input: ClassifyFollowEvidenceInput): FollowEvidenceResult {
  const {
    tape,
    advanced,
    sharedPrefixOnly,
    neighborhood,
    neighborhoodKeep,
    recognized,
    contradictoryLocalScore,
    contradictoryLocalMargin,
    localContradictionScore,
  } = input;

  let positive = 0;
  let negative = 0;

  if (tape.nextHeard) positive += 0.45;
  if (tape.nextInProgress) positive += 0.3;
  if (tape.remainderHits > 0) positive += 0.15 * Math.min(1, tape.remainderCoverage);
  if (advanced && !sharedPrefixOnly) positive += 0.35;
  if (neighborhood >= neighborhoodKeep && !sharedPrefixOnly) positive += 0.25;
  if (tape.phonemeScore >= 0.55) positive += 0.15;

  const unexplained = tape.unexplainedDistinctive.length;
  if (unexplained > 0) {
    // Unexplained tokens are weak negative unless they support another location.
    negative += Math.min(0.12, 0.04 * unexplained);
  }
  if (transcriptUnusable(recognized)) {
    negative += 0.08;
  } else if (
    !tape.nextHeard
    && !tape.nextInProgress
    && tape.remainderHits === 0
    && neighborhood < neighborhoodKeep
    && !advanced
  ) {
    negative += 0.1;
  }

  const strongLocalRival = contradictoryLocalScore >= localContradictionScore
    && contradictoryLocalMargin >= 0.08;
  if (strongLocalRival) {
    negative += 0.55;
    positive *= 0.5;
  }

  let verdict: FollowEvidenceVerdict;
  if (strongLocalRival || (negative >= 0.45 && positive < 0.2)) {
    verdict = 'contradicted';
  } else if (positive >= 0.25 && negative < 0.2) {
    verdict = 'supported';
  } else {
    verdict = 'uncertain';
  }

  const stickyLocation = verdict !== 'contradicted';

  return {
    verdict,
    stickyLocation,
    positiveEvidence: positive,
    negativeEvidence: negative,
  };
}

export type TrackConfidenceState = {
  locationConfidence: number;
  trackConfidence: number;
  negativeTrackEvidence: number;
  contradictedHops: number;
};

export function freshTrackConfidence(): TrackConfidenceState {
  return {
    locationConfidence: 0,
    trackConfidence: 0,
    negativeTrackEvidence: 0,
    contradictedHops: 0,
  };
}

export function updateTrackConfidence(
  state: TrackConfidenceState,
  result: FollowEvidenceResult,
  voicedDeltaMs: number,
  hasLocation: boolean,
): void {
  if (hasLocation && state.locationConfidence <= 0) {
    state.locationConfidence = 1;
    state.trackConfidence = 0.85;
  }
  const decay = voicedDeltaMs > 0 ? TEMPORAL_DECAY ** (voicedDeltaMs / 400) : 1;
  if (result.verdict === 'supported') {
    state.trackConfidence = Math.min(1, decay * state.trackConfidence + 0.35 * result.positiveEvidence);
    state.negativeTrackEvidence = decay * state.negativeTrackEvidence;
    state.contradictedHops = 0;
  } else if (result.verdict === 'uncertain') {
    state.trackConfidence = Math.max(0.15, decay * state.trackConfidence - 0.05);
    state.negativeTrackEvidence = temporalAccumulate(state.negativeTrackEvidence, result.negativeEvidence * 0.35, voicedDeltaMs);
  } else {
    state.trackConfidence = Math.max(0, decay * state.trackConfidence - 0.25);
    state.negativeTrackEvidence = temporalAccumulate(state.negativeTrackEvidence, result.negativeEvidence, voicedDeltaMs);
    state.contradictedHops += 1;
  }
  if (hasLocation) {
    state.locationConfidence = Math.max(0.2, Math.min(1, state.locationConfidence));
  }
}

export function trackLost(
  state: TrackConfidenceState,
  unsupportedVoicedMs: number,
  unsupportedVoicedLimit: number,
  weakGraceHops: number,
  weakGraceMs: number,
  mismatchStartedAt: number | null,
  weakHops: number,
): boolean {
  if (weakHops < weakGraceHops && state.contradictedHops < weakGraceHops) return false;
  if (unsupportedVoicedMs >= unsupportedVoicedLimit && weakHops >= weakGraceHops) return true;
  if (mismatchStartedAt == null) return false;
  return Date.now() - mismatchStartedAt >= weakGraceMs;
}

export function formatTrackDebug(state: TrackConfidenceState, from: VerseRef | null): {
  locationConfidence: number;
  trackConfidence: number;
} {
  return {
    locationConfidence: from ? state.locationConfidence : 0,
    trackConfidence: from ? state.trackConfidence : 0,
  };
}
