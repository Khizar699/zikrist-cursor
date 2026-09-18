import { nextSequentialRef, previousSequentialRef } from './sequential';
import { refKey, type DisplayVerse, type VerseRef } from './types';

/** Neighbors are readable context, not the recited row. */
export const CONTEXT_OPACITY = 0.34;
export const PASSAGE_BACK = 1;
/** Same-surah ayahs after the focused row. Short surahs (Fatiha, Ikhlas) fit
 * the rest of the surah on screen; long surahs stay in the cache. */
export const PASSAGE_LOOKAHEAD = 7;

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
