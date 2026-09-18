import { nextSequentialRef, previousSequentialRef } from './sequential';
import { refKey, type DisplayVerse, type VerseRef } from './types';

/** Neighbors are readable context, not the recited row. */
export const CONTEXT_OPACITY = 0.34;
export const PASSAGE_BACK = 1;
/** Same-surah ayahs after the focused row. Short surahs (Fatiha, Ikhlas) fit
 * the rest of the surah on screen; long surahs stay in the cache. */
export const PASSAGE_LOOKAHEAD = 7;
/** Keep the focused ayah near the top of each pane so a long row (1:7) can
 * use the rest of the half-screen. 0.5 plus 38% padding clipped Fatiha 1:7. */
export const FOCUSED_SCROLL_POSITION = 0.18;

/** Vertical list padding. Large centered padding left only ~24% of the pane
 * for the focused ayah and clipped 1:7 Arabic+English. */
export function passagePanePadding(paneHeight: number): number {
  if (paneHeight <= 0) return 12;
  return Math.max(8, Math.min(36, Math.round(paneHeight * 0.08)));
}

/** On-screen rows: one previous ayah, the focused ayah, then upcoming ayahs of
 * the same surah. Full surahs stay in the cache. */
export function passageWindow(
  focus: DisplayVerse,
  peek: (ref: VerseRef) => DisplayVerse | undefined,
  hasVerse: (ref: VerseRef) => boolean,
  options: { back?: number; lookahead?: number } = {},
): DisplayVerse[] {
  const back = options.back ?? PASSAGE_BACK;
  const lookahead = options.lookahead ?? PASSAGE_LOOKAHEAD;
  const before: DisplayVerse[] = [];
  let cursor: VerseRef = focus;
  for (let step = 0; step < back; step++) {
    const previous = previousSequentialRef(cursor, hasVerse);
    if (!previous) break;
    const verse = peek(previous);
    if (!verse) break;
    before.push(verse);
    cursor = previous;
  }
  const after: DisplayVerse[] = [];
  cursor = focus;
  for (let step = 0; step < lookahead; step++) {
    const next = nextSequentialRef(cursor, hasVerse);
    if (!next || next.surah !== cursor.surah) break;
    const verse = peek(next);
    if (!verse) break;
    after.push(verse);
    cursor = next;
  }
  return [...before.reverse(), focus, ...after];
}

export function samePassage(left: DisplayVerse[], right: DisplayVerse[]): boolean {
  return left.length === right.length && left.every((verse, index) => refKey(verse) === refKey(right[index]!));
}

export function passageIndex(verses: DisplayVerse[], focus: VerseRef | null): number {
  if (!focus) return -1;
  return verses.findIndex((verse) => verse.surah === focus.surah && verse.ayah === focus.ayah);
}

/** False while same-surah lookahead still exists in the mushaf but is missing
 * from the painted window (display cache race on first Ikhlas lock). */
export function passageLookaheadComplete(
  window: DisplayVerse[],
  focus: VerseRef,
  hasVerse: (ref: VerseRef) => boolean,
): boolean {
  let cursor: VerseRef = focus;
  for (let step = 0; step < PASSAGE_LOOKAHEAD; step++) {
    const next = nextSequentialRef(cursor, hasVerse);
    if (!next || next.surah !== cursor.surah) return true;
    if (!window.some((verse) => verse.surah === next.surah && verse.ayah === next.ayah)) return false;
    cursor = next;
  }
  return true;
}
