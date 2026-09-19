import { isSequentialSuccessor } from './sequential';
import type { VerseRef } from './types';

/** Move passage focus when a different ayah is confirmed, unless this is only
 * a late match for the ayah that coverage already left. Jump prefetch must not
 * display. A new surah always replaces the held verse immediately. */
export function shouldReplaceHeldVerse(
  displayed: VerseRef | null,
  confirmed: VerseRef,
  options: {
    hasVerse?: (ref: VerseRef) => boolean;
    displayedWasConfirmed?: boolean;
  } = {},
): boolean {
  if (!displayed) return true;
  if (displayed.surah === confirmed.surah && displayed.ayah === confirmed.ayah) return false;
  if (displayed.surah !== confirmed.surah) return true;
  const hasVerse = options.hasVerse ?? (() => true);
  if (options.displayedWasConfirmed === false && isSequentialSuccessor(confirmed, displayed, hasVerse)) {
    return false;
  }
  return true;
}
