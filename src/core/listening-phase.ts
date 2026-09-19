/** UI phase when the follower tick completes; never clears mushaf content. */
export type ListeningUiPhase = 'searching' | 'following';

export function resolveListeningPhase(input: {
  followerPhase: 'following' | 'reacquiring' | 'acquiring';
  hasDisplayedVerse: boolean;
  isAmbiguousOpening: boolean;
}): ListeningUiPhase | null {
  const { followerPhase, hasDisplayedVerse, isAmbiguousOpening } = input;
  if (isAmbiguousOpening || (followerPhase === 'reacquiring' && hasDisplayedVerse)) {
    return 'searching';
  }
  if (followerPhase === 'following' && hasDisplayedVerse) {
    return 'following';
  }
  return null;
}

/** Engine lock may drop during reacquire; the painted passage stays until a confirmed hop. */
export function shouldClearListeningDisplayOnReacquire(): boolean {
  return false;
}
