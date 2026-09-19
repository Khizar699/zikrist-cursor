import assert from 'node:assert/strict';
import { test } from 'node:test';
import { highlightHeardWordCount, splitDisplayWords } from '../src/core/word-highlight';

test('display words split on whitespace and ignore empties', () => {
  assert.deepEqual(splitDisplayWords('  قُلْ هُوَ ٱللَّهُ أَحَدٌ  '), ['قُلْ', 'هُوَ', 'ٱللَّهُ', 'أَحَدٌ']);
});

test('highlight count follows spoken coverage when display and phoneme counts differ', () => {
  assert.equal(highlightHeardWordCount(4, 0, 4), 0);
  assert.equal(highlightHeardWordCount(4, 2, 4), 2);
  assert.equal(highlightHeardWordCount(4, 4, 4), 4);
  assert.equal(highlightHeardWordCount(6, 3, 4), 5);
  assert.equal(highlightHeardWordCount(4, 9, 10), 4);
});
