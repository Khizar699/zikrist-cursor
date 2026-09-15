import { nextSequentialRef, previousSequentialRef } from './sequential';
import { refKey, type DisplayVerse, type VerseRef } from './types';

export const CONTEXT_OPACITY = 0.1;
export const PASSAGE_RADIUS = 1;

/** On-screen rows: previous, current, next. Full surahs stay in the cache. */
export function passageWindow(
  focus: DisplayVerse,
  peek: (ref: VerseRef) => DisplayVerse | undefined,
  hasVerse: (ref: VerseRef) => boolean,
  radius = PASSAGE_RADIUS,
): DisplayVerse[] {
  const before: DisplayVerse[] = [];
  let cursor: VerseRef = focus;
  for (let step = 0; step < radius; step++) {
    const previous = previousSequentialRef(cursor, hasVerse);
    if (!previous) break;
    const verse = peek(previous);
    if (!verse) break;
    before.push(verse);
    cursor = previous;
  }
  const after: DisplayVerse[] = [];
  cursor = focus;
  for (let step = 0; step < radius; step++) {
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
