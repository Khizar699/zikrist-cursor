import type { VerseRef } from './types';

/** Acoustic completion of the current ayah. Display still waits for a match. */
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

export function neighborhoodSurahs(surah: number): number[] {
  if (surah < 1 || surah > 114) return [];
  return surah < 114 ? [surah, surah + 1] : [surah];
}

export function isSequentialSuccessor(from: VerseRef, to: VerseRef, hasVerse: (ref: VerseRef) => boolean): boolean {
  const next = nextSequentialRef(from, hasVerse);
  return next !== null && next.surah === to.surah && next.ayah === to.ayah;
}

/** Focused translation follows an accepted verse_match only. Coverage, elapsed
 * time, and a preloaded neighbor must not preview the next ayah. */
export function shouldRevealSequentialNext(_options: {
  displayed: VerseRef;
  prepared: VerseRef | null;
  wordIndex: number;
  totalWords: number;
  hasVerse: (ref: VerseRef) => boolean;
  coverage?: number;
}): boolean {
  return false;
}
