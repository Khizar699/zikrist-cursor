import type { QuranChampionMatch } from '@tilawa/core';
import data from '../../assets/recognition/salah-prior.json';

export type SalahPrior = typeof data;

export const TIE_BREAK_MARGIN = data.tieBreakMax;

function addUnique(out: number[], seen: Set<number>, surah: number): void {
  if (surah < 1 || surah > 114 || seen.has(surah)) return;
  seen.add(surah);
  out.push(surah);
}

/** Later short surahs after `surah`, then the rest of those bands, plus Al-Fatihah and famous openings. Repeats stay allowed. */
export function remainingAfter(surah: number): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  addUnique(out, seen, data.fatiha);
  for (const band of [data.last10, data.last20, data.juz30]) {
    for (const next of band) if (next > surah) addUnique(out, seen, next);
    addUnique(out, seen, surah);
    for (const previous of band) if (previous < surah) addUnique(out, seen, previous);
  }
  for (const famous of data.famous) addUnique(out, seen, famous);
  return out;
}

/** Handoff shortlist: salah bands plus mushaf-next as a scored candidate, never a default display. */
export function handoffCandidateSurahs(fromSurah: number, mushafNext: number | null): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const surah of remainingAfter(fromSurah)) addUnique(out, seen, surah);
  if (mushafNext != null && mushafNext !== fromSurah) addUnique(out, seen, mushafNext);
  return out;
}

export function isFamousHandoffSurah(surah: number): boolean {
  return data.famous.includes(surah);
}

export function surahBonus(surah: number, fromSurah: number | null = null): number {
  let bonus = 0;
  if (surah === data.fatiha) bonus = Math.max(bonus, data.bonuses.fatiha);
  if (data.last10.includes(surah)) bonus = Math.max(bonus, data.bonuses.last10);
  if (data.last20.includes(surah)) bonus = Math.max(bonus, data.bonuses.last20);
  if (data.famous.includes(surah)) bonus = Math.max(bonus, data.bonuses.famous);
  if (data.juz30.includes(surah)) bonus = Math.max(bonus, data.bonuses.juz30);
  if (fromSurah !== null && surah > fromSurah && remainingAfter(fromSurah).includes(surah)) {
    bonus = Math.max(bonus, data.bonuses.remainingAfter);
  }
  return bonus;
}

/** Highest acoustic row, ignoring the salah prior. */
export function acousticChampion(match: QuranChampionMatch): QuranChampionMatch {
  const rows = acousticRows(match);
  const best = rows.reduce((winner, row) => row.score > winner.score ? row : winner);
  if (best.surah === match.surah && best.ayah === match.ayah) return match;
  return {
    ...match,
    surah: best.surah,
    ayah: best.ayah,
    ayah_end: null,
    score: best.score,
    raw_score: best.raw_score,
    bonus: best.bonus,
    phonemes_joined: best.phonemes_joined,
  };
}

function acousticRows(match: QuranChampionMatch): {
  surah: number;
  ayah: number;
  score: number;
  raw_score: number;
  bonus: number;
  phonemes_joined: string;
}[] {
  return [
    {
      surah: match.surah,
      ayah: match.ayah,
      score: match.score,
      raw_score: match.raw_score,
      bonus: match.bonus,
      phonemes_joined: match.phonemes_joined,
    },
    ...(match.runners_up ?? []),
  ];
}

/** Reorder a shortlist with the salah prior. Acoustic scores are unchanged; the prior only breaks ties within `margin`. */
export function rerankChampion(
  match: QuranChampionMatch,
  fromSurah: number | null = null,
  margin = TIE_BREAK_MARGIN,
): QuranChampionMatch {
  const rows = acousticRows(match);
  if (rows.length < 2) return match;
  const ranked = [...rows].sort((left, right) => {
    const gap = right.score - left.score;
    if (Math.abs(gap) + 1e-9 >= margin) return gap;
    const prior = surahBonus(right.surah, fromSurah) - surahBonus(left.surah, fromSurah);
    if (prior !== 0) return prior;
    return gap;
  });
  const winner = ranked[0]!;
  const sameChampion = winner.surah === match.surah && winner.ayah === match.ayah;
  return {
    ...match,
    surah: winner.surah,
    ayah: winner.ayah,
    ayah_end: sameChampion ? match.ayah_end : null,
    score: winner.score,
    raw_score: winner.raw_score,
    bonus: winner.bonus,
    phonemes_joined: winner.phonemes_joined,
    runners_up: ranked.slice(1),
  };
}

export const salahPrior: SalahPrior = data;
