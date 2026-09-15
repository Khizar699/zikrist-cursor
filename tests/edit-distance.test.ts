import assert from 'node:assert/strict';
import { test } from 'node:test';
// The app patches the SDK's private scoring kernel; compare to an independent
// ordinary DP oracle, including the 32-bit boundaries and successive calls.
import { distance, semiGlobalDistance, ratio } from '../node_modules/@tilawa/core/dist/levenshtein.js';
function oracle(a: string, b: string, fragment: boolean): number {
  let previous = Array.from({ length: a.length + 1 }, (_, i) => i);
  let best = a.length;
  for (let j = 0; j < b.length; j++) {
    const current = [fragment ? 0 : j + 1];
    for (let i = 1; i <= a.length; i++) current[i] = Math.min(previous[i]! + 1, current[i - 1]! + 1, previous[i - 1]! + (a[i - 1] === b[j] ? 0 : 1));
    best = Math.min(best, current[a.length]!);
    previous = current;
  }
  return fragment ? best : previous[a.length]!;
}
test('bit-vector scoring preserves global and substring edit distance across word boundaries', () => {
  let seed = 3271;
  const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  const alphabet = 'abciH |\u0627\uFFFF';
  const text = (n: number) => Array.from({ length: n }, () => alphabet[next() % alphabet.length]).join('');
  const lengths = [0, 1, 2, 15, 31, 32, 33, 63, 64, 65, 95, 96, 97, 128, 200];
  for (let i = 0; i < 3000; i++) {
    const a = text(lengths[next() % lengths.length]!);
    const b = text(lengths[next() % lengths.length]!);
    assert.equal(distance(a, b), oracle(a, b, false), `global ${a.length}/${b.length}`);
    assert.equal(semiGlobalDistance(a, b), oracle(a, b, true), `fragment ${a.length}/${b.length}`);
  }
  assert.equal(semiGlobalDistance('bismi allahi', 'noise bismi allahi more'), 0);
  assert.equal(semiGlobalDistance('abc', 'zzabXzz'), 1);
  assert.equal(ratio('abc', 'abX'), 5 / 6);
});
