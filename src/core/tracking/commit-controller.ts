import type { QuranVerse } from '@tilawa/core';
import type { VerseRef } from '../types';
import type { CommitDecision, CommitKind, EvidenceSnapshot, PendingHandoff } from './types';
import {
  CROSS_SURAH_ENTER,
  CROSS_SURAH_STAY,
  CROSS_SURAH_MULTI_TOKEN,
  HANDOFF_MARGIN_MIN,
  shortOneWordBody,
  temporalAccumulate,
} from './evidence';

export type CommitControllerState = {
  pendingHandoff: PendingHandoff | null;
  accumulatedEvidence: number;
  lastVoicedMs: number;
  unsupportedVoicedMs: number;
};

export function freshCommitState(): CommitControllerState {
  return {
    pendingHandoff: null,
    accumulatedEvidence: 0,
    lastVoicedMs: 0,
    unsupportedVoicedMs: 0,
  };
}

export type DecideCommitInput = {
  kind: CommitKind;
  from: VerseRef | null;
  verse: QuranVerse;
  bodyWords: string[];
  evidence: EvidenceSnapshot;
  /** Fuzzy location score in 0..1 (same as legacy LOCK/SEQUENTIAL thresholds). */
  matchScore: number;
  uniqueSecond: boolean;
  ayah2Ready: boolean;
  twoContiguous: boolean;
  shortOpeningConfirmed: boolean;
  muqattaatHeard?: boolean;
  openingEntropy?: boolean;
  distinctiveTokenCount?: number;
  bodyHeardCount?: number;
  voicedMs: number;
  hopId: number;
  state: CommitControllerState;
};

export function decideLocationCommit(input: DecideCommitInput): CommitDecision {
  const {
    kind,
    from,
    verse,
    bodyWords,
    evidence,
    matchScore,
    uniqueSecond,
    ayah2Ready,
    twoContiguous,
    shortOpeningConfirmed,
    voicedMs,
    hopId,
    state,
  } = input;

  if (kind === 'sequential_next' || kind === 'same_surah_jump') {
    state.pendingHandoff = null;
    state.accumulatedEvidence = evidence.total;
    state.unsupportedVoicedMs = 0;
    return { allow: true, locationCommit: true, reason: 'sequential' };
  }

  if (kind === 'cold_acquire') {
    state.pendingHandoff = null;
    state.accumulatedEvidence = evidence.total;
    state.unsupportedVoicedMs = 0;
    return { allow: true, locationCommit: true, reason: 'locate' };
  }

  if (kind === 'reacquire') {
    state.pendingHandoff = null;
    state.accumulatedEvidence = evidence.total;
    const strongSupport = Boolean(
      uniqueSecond
      || ayah2Ready
      || twoContiguous
      || input.muqattaatHeard
      || input.openingEntropy,
    );
    const oneWordShort = shortOneWordBody(verse, bodyWords);
    const heardCount = input.bodyHeardCount ?? input.distinctiveTokenCount ?? 0;
    const marginOk = evidence.margin >= HANDOFF_MARGIN_MIN;
    const scoreOk = matchScore >= CROSS_SURAH_ENTER;
    if (verse.ayah === 1 && oneWordShort && !strongSupport && !shortOpeningConfirmed) {
      return { allow: false, locationCommit: false, reason: 'reacquire_short_opening' };
    }
    if (verse.ayah === 1 && heardCount < 2 && !strongSupport && !marginOk && matchScore < CROSS_SURAH_MULTI_TOKEN) {
      return { allow: false, locationCommit: false, reason: 'reacquire_thin' };
    }
    if (verse.ayah > 1) {
      const midAyahStrong = strongSupport
        || (matchScore >= CROSS_SURAH_ENTER && heardCount >= 3 && marginOk);
      if (!midAyahStrong) {
        return { allow: false, locationCommit: false, reason: 'reacquire_mid_ayah' };
      }
    }
    if (!marginOk && !strongSupport && matchScore < CROSS_SURAH_STAY) {
      return { allow: false, locationCommit: false, reason: 'reacquire_margin' };
    }
    if (!scoreOk && !strongSupport && heardCount < 2) {
      return { allow: false, locationCommit: false, reason: 'reacquire_score' };
    }
    state.unsupportedVoicedMs = 0;
    return { allow: true, locationCommit: true, reason: 'reacquire' };
  }

  // cross_surah_handoff
  const crossSurah = Boolean(from && (from.surah !== verse.surah || from.ayah !== verse.ayah));
  if (!crossSurah) {
    return { allow: true, locationCommit: true, reason: 'intra' };
  }
  if (verse.ayah > 2) {
    return { allow: false, locationCommit: false, reason: 'cross_surah_mid_ayah' };
  }

  const voicedDelta = Math.max(0, voicedMs - state.lastVoicedMs);
  state.lastVoicedMs = voicedMs;
  state.accumulatedEvidence = temporalAccumulate(state.accumulatedEvidence, evidence.total, voicedDelta);

  const strongSupport = Boolean(
    uniqueSecond
    || ayah2Ready
    || twoContiguous
    || input.muqattaatHeard
    || input.openingEntropy,
  );
  const oneWordShort = shortOneWordBody(verse, bodyWords);
  const heardCount = input.bodyHeardCount ?? input.distinctiveTokenCount ?? 0;
  const thinCrossSurahAyah1 = verse.ayah === 1 && heardCount < 2 && !strongSupport;
  const marginOk = evidence.margin >= HANDOFF_MARGIN_MIN;
  const scoreOk = matchScore >= CROSS_SURAH_ENTER
    || (state.pendingHandoff && matchScore >= CROSS_SURAH_STAY);

  if (oneWordShort && !strongSupport && !shortOpeningConfirmed) {
    const key = `${verse.surah}:${verse.ayah}`;
    if (state.pendingHandoff?.ref.surah === verse.surah && state.pendingHandoff.ref.ayah === verse.ayah) {
      if (state.pendingHandoff.hopId !== hopId && scoreOk && marginOk) {
        state.pendingHandoff = null;
        return { allow: true, locationCommit: true, reason: 'short_opening_persist' };
      }
    } else {
      state.pendingHandoff = { ref: { surah: verse.surah, ayah: verse.ayah }, score: evidence.total, voicedMsAtStart: voicedMs, hopId };
      return { allow: false, locationCommit: false, reason: 'short_opening_hold' };
    }
    return { allow: false, locationCommit: false, reason: 'short_opening_weak' };
  }

  if (thinCrossSurahAyah1 && !shortOpeningConfirmed) {
    const key = `${verse.surah}:${verse.ayah}`;
    if (state.pendingHandoff?.ref.surah === verse.surah && state.pendingHandoff.ref.ayah === verse.ayah
      && state.pendingHandoff.hopId !== hopId && (scoreOk || shortOpeningConfirmed) && (marginOk || strongSupport)) {
      state.pendingHandoff = null;
      return { allow: true, locationCommit: true, reason: 'thin_handoff_persist' };
    }
    state.pendingHandoff = { ref: { surah: verse.surah, ayah: verse.ayah }, score: evidence.total, voicedMsAtStart: voicedMs, hopId };
    return { allow: false, locationCommit: false, reason: 'thin_handoff' };
  }

  if (shortOpeningConfirmed && scoreOk) {
    state.pendingHandoff = null;
    state.unsupportedVoicedMs = 0;
    return { allow: true, locationCommit: true, reason: 'temporal_handoff' };
  }

  if (heardCount >= 2 && matchScore >= CROSS_SURAH_MULTI_TOKEN && !oneWordShort) {
    state.pendingHandoff = null;
    state.unsupportedVoicedMs = 0;
    return { allow: true, locationCommit: true, reason: 'multi_token_handoff' };
  }

  if (!marginOk && !strongSupport) {
    state.pendingHandoff = { ref: { surah: verse.surah, ayah: verse.ayah }, score: evidence.total, voicedMsAtStart: voicedMs, hopId };
    return { allow: false, locationCommit: false, reason: 'margin' };
  }

  if (!scoreOk && !strongSupport) {
    return { allow: false, locationCommit: false, reason: 'score' };
  }

  state.pendingHandoff = null;
  state.unsupportedVoicedMs = 0;
  return { allow: true, locationCommit: true, reason: 'handoff' };
}

export function noteUnsupportedVoiced(state: CommitControllerState, voicedDeltaMs: number): void {
  state.unsupportedVoicedMs += voicedDeltaMs;
}

export function noteCredibleSupport(state: CommitControllerState): void {
  state.unsupportedVoicedMs = 0;
}
