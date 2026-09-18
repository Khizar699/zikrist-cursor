/** Map acoustic word progress onto canonical Arabic display words.
 * Display word count is not always the phoneme-word count. */

export function highlightHeardWordCount(
  displayWords: number,
  wordIndex: number,
  totalWords: number,
): number {
  if (displayWords <= 0 || totalWords <= 0 || wordIndex <= 0) return 0;
  const spoken = Math.min(1, wordIndex / totalWords);
  return Math.min(displayWords, Math.max(0, Math.round(spoken * displayWords)));
}

export function splitDisplayWords(arabic: string): string[] {
  return arabic.trim().split(/\s+/).filter(Boolean);
}
