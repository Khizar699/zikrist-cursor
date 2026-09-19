import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TapeScore } from '../src/core/expected-tape';
import {
  classifyFollowEvidence,
  freshTrackConfidence,
  trackLost,
  updateTrackConfidence,
} from '../src/core/tracking/follow-evidence';

function tape(partial: Partial<TapeScore>): TapeScore {
  return {
    remainderHits: 0,
    remainderTotal: 0,
    remainderLast: -1,
    nextHits: 0,
    nextTotal: 0,
    leftover: [],
    unexplainedDistinctive: [],
    nextHeard: false,
    nextInProgress: false,
    holdsLock: false,
    remainderCoverage: 0,
    nextCoverage: 0,
    phonemeScore: 0,
    ...partial,
  };
}

test('unexplained distinctive tokens are uncertain, not contradicted', () => {
  const result = classifyFollowEvidence({
    tape: tape({ unexplainedDistinctive: ['kafirun'], remainderTotal: 2, remainderHits: 0 }),
    advanced: false,
    sharedPrefixOnly: false,
    neighborhood: 0.2,
    neighborhoodKeep: 0.5,
    recognized: ['kafirun'],
    contradictoryLocalScore: 0,
    contradictoryLocalMargin: 0,
    localContradictionScore: 0.72,
  });
  assert.equal(result.verdict, 'uncertain');
  assert.equal(result.stickyLocation, true);
});

test('unsupported voiced alone does not drop track before grace misses', () => {
  const state = freshTrackConfidence();
  assert.ok(!trackLost(state, 1600, 1500, 3, 1500, null, 0));
  assert.ok(!trackLost(state, 1600, 1500, 3, 1500, Date.now() - 2000, 2));
});

test('unsupported voiced drops track only after grace misses accrue', () => {
  const started = Date.now() - 2000;
  assert.ok(trackLost(freshTrackConfidence(), 1600, 1500, 3, 1500, started, 3));
});
