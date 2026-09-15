import assert from 'node:assert/strict';
import { test } from 'node:test';
import { packsToEvict } from '../src/core/pack-policy';

test('installing a third language evicts the oldest inactive pack, preserving the active one', () => {
  assert.deepEqual(packsToEvict([{ language: 'en', lastUsedAt: 1 }, { language: 'ur', lastUsedAt: 2 }, { language: 'ar', lastUsedAt: 3 }], 'en'), ['ur']);
  assert.deepEqual(packsToEvict([{ language: 'en', lastUsedAt: 1 }, { language: 'ur', lastUsedAt: 2 }], 'ur'), []);
});
