import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAPTURE_GAP_SEC, LONG_PAUSE_SEC, isCaptureGap, isLongPause, isSpeech } from '../src/core/capture-policy';

test('quiet frames are not treated as recitation', () => {
  assert.equal(isSpeech(0), false);
  assert.equal(isSpeech(0.004), false);
  assert.equal(isSpeech(0.005), true);
});

test('capture gaps ignore sub-second timestamp jitter', () => {
  assert.equal(isCaptureGap(null, 0), false);
  assert.equal(isCaptureGap(1, 1.2), false);
  assert.equal(isCaptureGap(1, 1 + CAPTURE_GAP_SEC), false);
  assert.equal(isCaptureGap(1, 1 + CAPTURE_GAP_SEC + 0.01), true);
});

test('a short pause is not a tracker reset; a long stop is', () => {
  assert.equal(isLongPause(4), false);
  assert.equal(isLongPause(LONG_PAUSE_SEC - 0.1), false);
  assert.equal(isLongPause(LONG_PAUSE_SEC), true);
});
