import type { VerseRef } from '../types';

export type TrackingMode = 'locating' | 'following' | 'reacquiring';

/** How a proposed Mushaf location was reached. */
export type CommitKind =
  | 'cold_acquire'
  | 'sequential_next'
  | 'same_surah_jump'
  | 'cross_surah_handoff'
  | 'reacquire';

export type EvidenceSnapshot = {
  lexical: number;
  weightedLexical: number;
  sequencePrior: number;
  total: number;
  margin: number;
  orderedTokenHits: number;
};

export type HandoffCandidate = {
  ref: VerseRef;
  score: number;
  bonus: number;
  uniqueSecond: boolean;
  ayah2Ready: boolean;
  twoContiguous: boolean;
};

export type CommitDecision = {
  allow: boolean;
  locationCommit: boolean;
  reason: string;
};

export type PendingHandoff = {
  ref: VerseRef;
  score: number;
  voicedMsAtStart: number;
  hopId: number;
};
