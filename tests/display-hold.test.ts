import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldReplaceHeldVerse } from '../src/core/display-hold';

test('the first confirmed ayah may appear, and the same ayah stays held', () => {
  assert.equal(shouldReplaceHeldVerse(null, { surah: 112, ayah: 1 }), true);
  assert.equal(shouldReplaceHeldVerse({ surah: 112, ayah: 1 }, { surah: 112, ayah: 1 }), false);
});

test('the sequential next ayah may replace the screen when that ayah is confirmed', () => {
  assert.equal(shouldReplaceHeldVerse({ surah: 112, ayah: 1 }, { surah: 112, ayah: 2 }), true);
});

test('a confirmed jump can replace a held verse after evidence, without showing prefetch early', () => {
  assert.equal(shouldReplaceHeldVerse({ surah: 2, ayah: 2 }, { surah: 112, ayah: 2 }), true);
});

test('a new surah always replaces the held verse, including last-ayah handoff', () => {
  assert.equal(shouldReplaceHeldVerse({ surah: 109, ayah: 6 }, { surah: 105, ayah: 1 }), true);
  assert.equal(shouldReplaceHeldVerse({ surah: 109, ayah: 6 }, { surah: 105, ayah: 5 }), true);
  assert.equal(shouldReplaceHeldVerse({ surah: 105, ayah: 1 }, { surah: 108, ayah: 1 }, {
    displayedWasConfirmed: true,
  }), true);
});

test('a late match for the ayah already left visually does not pull the passage back', () => {
  assert.equal(shouldReplaceHeldVerse({ surah: 112, ayah: 2 }, { surah: 112, ayah: 1 }, {
    displayedWasConfirmed: false,
  }), false);
});

test('a confirmed repeat of an earlier ayah can move the passage back', () => {
  assert.equal(shouldReplaceHeldVerse({ surah: 112, ayah: 2 }, { surah: 112, ayah: 1 }, {
    displayedWasConfirmed: true,
  }), true);
});
