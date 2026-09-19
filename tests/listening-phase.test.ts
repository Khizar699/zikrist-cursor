import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  resolveListeningPhase,
  shouldClearListeningDisplayOnReacquire,
} from '../src/core/listening-phase';

test('reacquire keeps searching phase without clearing display policy', () => {
  assert.equal(
    resolveListeningPhase({
      followerPhase: 'reacquiring',
      hasDisplayedVerse: true,
      isAmbiguousOpening: false,
    }),
    'searching',
  );
  assert.equal(shouldClearListeningDisplayOnReacquire(), false);
});

test('ambiguous opening and reacquire both map to searching while content is held elsewhere', () => {
  assert.equal(
    resolveListeningPhase({
      followerPhase: 'following',
      hasDisplayedVerse: true,
      isAmbiguousOpening: true,
    }),
    'searching',
  );
});

test('following with a displayed verse maps to following phase', () => {
  assert.equal(
    resolveListeningPhase({
      followerPhase: 'following',
      hasDisplayedVerse: true,
      isAmbiguousOpening: false,
    }),
    'following',
  );
});
