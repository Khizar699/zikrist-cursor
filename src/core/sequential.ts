import type { VerseRef } from './types';

/** Acoustic completion of the current ayah. Sequential focus may move; history still waits for a match. */
export const TRACKING_COMPLETION_COVERAGE = 0.82;
export const VISUAL_ADVANCE_COVERAGE = TRACKING_COMPLETION_COVERAGE;
export const MAX_AYAH = 286;

export function nextSequentialRef(ref: VerseRef, hasVerse: (ref: VerseRef) => boolean): VerseRef | null {
  const nextAyah = { surah: ref.surah, ayah: ref.ayah + 1 };
  if (hasVerse(nextAyah)) return nextAyah;
  if (ref.surah >= 114) return null;
  const nextSurah = { surah: ref.surah + 1, ayah: 1 };
  return hasVerse(nextSurah) ? nextSurah : null;
}

export function previousSequentialRef(ref: VerseRef, hasVerse: (ref: VerseRef) => boolean): VerseRef | null {
  if (ref.ayah > 1) {
    const previous = { surah: ref.surah, ayah: ref.ayah - 1 };
    return hasVerse(previous) ? previous : null;
  }
  if (ref.surah <= 1) return null;
  const surah = ref.surah - 1;
  for (let ayah = MAX_AYAH; ayah >= 1; ayah--) {
    const previous = { surah, ayah };
    if (hasVerse(previous)) return previous;
  }
  return null;
}

/** Cache the recited surah in full. Mushaf-next is not preloaded here — handoff
 * openings are a separate, smaller fetch so Fatiha does not dump Al-Baqarah. */
export function neighborhoodSurahs(surah: number): number[] {
  if (surah < 1 || surah > 114) return [];
  return [surah];
}

/** 0 = last ayah of this surah, 1 = second-last. Caps at `limit` so callers
 * can arm a handoff pool near the end without walking the whole mushaf. */
export function ayahsRemainingInSurah(
  ref: VerseRef,
  hasVerse: (next: VerseRef) => boolean,
  limit = 3,
): number {
  let count = 0;
  let cursor = ref;
  while (count < limit) {
    const next = nextSequentialRef(cursor, hasVerse);
    if (!next || next.surah !== ref.surah) return count;
    count += 1;
    cursor = next;
  }
  return count;
}

export function approachingSurahEnd(
  ref: VerseRef,
  hasVerse: (next: VerseRef) => boolean,
  within = 2,
): boolean {
  return ayahsRemainingInSurah(ref, hasVerse, within) < within;
}

export function isSequentialSuccessor(from: VerseRef, to: VerseRef, hasVerse: (ref: VerseRef) => boolean): boolean {
  const next = nextSequentialRef(from, hasVerse);
  return next !== null && next.surah === to.surah && next.ayah === to.ayah;
}

/** Same-surah sequential focus when the displayed ayah is acoustically
 * complete. History still waits for verse_match. Next-surah, jumps, and
 * skipped-ahead neighbors are not previews. */
export function shouldRevealSequentialNext(options: {
  displayed: VerseRef;
  prepared: VerseRef | null;
  wordIndex: number;
  totalWords: number;
  hasVerse: (ref: VerseRef) => boolean;
  coverage?: number;
}): boolean {
  const prepared = options.prepared;
  if (!prepared) return false;
  if (prepared.surah !== options.displayed.surah) return false;
  if (!isSequentialSuccessor(options.displayed, prepared, options.hasVerse)) return false;
  if (options.totalWords <= 0 || options.wordIndex <= 0) return false;
  const coverage = options.coverage ?? VISUAL_ADVANCE_COVERAGE;
  return options.wordIndex / options.totalWords >= coverage;
}
