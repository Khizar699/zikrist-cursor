import type { QuranVerse } from '@tilawa/core';
import type { VerseRef } from '../types';
import type { EvidenceSnapshot, HandoffCandidate, TrackingMode } from './types';
import type { TokenDocumentStats } from './token-stats';

const EPS = 1e-4;

export const HANDOFF_MARGIN_MIN = 0.12;
export const CROSS_SURAH_ENTER = 0.72;
export const CROSS_SURAH_STAY = 0.62;
export const CROSS_SURAH_MULTI_TOKEN = 0.65;
export const TEMPORAL_DECAY = 0.85;

function compact(text: string): string {
  return text.replace(/\s+/g, '');
}

export function logScore(score: number): number {
  return Math.log(Math.max(EPS, score));
}

export function sequencePriorLog(
  from: VerseRef | null,
  to: VerseRef,
  mode: TrackingMode,
): number {
  if (!from) return 0;
  if (from.surah === to.surah && to.ayah === from.ayah + 1) return 1.2;
  if (from.surah === to.surah && to.ayah > from.ayah && to.ayah <= from.ayah + 2) return 0.6;
  if (from.surah === to.surah) return 0.2;
  if (mode === 'following' && to.ayah === 1) return -0.15;
  if (to.ayah === 1) return 0;
  return -0.4;
}

export function weightedTokenEvidence(recognized: string[], stats: TokenDocumentStats): number {
  if (!recognized.length) return 0;
  let sum = 0;
  let wSum = 0;
  for (const token of recognized) {
    const w = stats.idfNorm(token);
    if (w <= 0) continue;
    sum += w;
    wSum += 1;
  }
  return wSum > 0 ? sum / wSum : 0;
}

export function scoreCandidate(
  lexicalScore: number,
  recognized: string[],
  stats: TokenDocumentStats,
  from: VerseRef | null,
  to: VerseRef,
  mode: TrackingMode,
): EvidenceSnapshot {
  const lexical = logScore(lexicalScore);
  const idf = weightedTokenEvidence(recognized, stats);
  const weightedLexical = lexical * (0.55 + 0.45 * idf);
  const sequencePrior = sequencePriorLog(from, to, mode);
  const total = weightedLexical + sequencePrior;
  return {
    lexical,
    weightedLexical,
    sequencePrior,
    total,
    margin: 0,
    orderedTokenHits: recognized.filter((t) => stats.idfNorm(t) > 0.35).length,
  };
}

export function applyMargin(
  best: EvidenceSnapshot,
  runnerUpTotal: number,
): EvidenceSnapshot {
  return { ...best, margin: best.total - runnerUpTotal };
}

export function rankHandoffCandidates(
  rows: HandoffCandidate[],
  lexicalFor: (ref: VerseRef) => number,
  recognized: string[],
  stats: TokenDocumentStats,
  from: VerseRef | null,
  mode: TrackingMode,
): { best: HandoffCandidate; evidence: EvidenceSnapshot; runnerUp: number } | null {
  if (!rows.length) return null;
  const scored = rows.map((row) => {
    const ev = scoreCandidate(
      lexicalFor(row.ref) + row.bonus,
      recognized,
      stats,
      from,
      row.ref,
      mode,
    );
    return { row, ev };
  });
  scored.sort((a, b) => b.ev.total - a.ev.total);
  const top = scored[0]!;
  const second = scored[1]?.ev.total ?? -Infinity;
  return {
    best: top.row,
    evidence: applyMargin(top.ev, second),
    runnerUp: second,
  };
}

/** Short one-word ayah-1 bodies carry less identifying evidence unless supported. */
export function shortOneWordBody(verse: QuranVerse, bodyWords: string[]): boolean {
  if (bodyWords.length !== 1) return false;
  const body = compact(bodyWords[0]!);
  return body.length >= 2 && body.length <= 5;
}

export function temporalAccumulate(
  previous: number,
  current: number,
  voicedDeltaMs: number,
): number {
  const decay = voicedDeltaMs > 0 ? TEMPORAL_DECAY ** (voicedDeltaMs / 400) : 1;
  return decay * previous + current;
}
