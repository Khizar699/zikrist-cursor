import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  TIER_A_COLD_STARTS,
  classifyColdStart,
  coverageFindingId,
  parseLedger,
  summarizeFindings,
  verseClipId,
  type FindingRow,
} from '../scripts/lib/findings';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('findings + Tier A coverage helpers', () => {
  it('Tier A sample spans regions and uses SSSAAA clip ids', () => {
    assert.ok(TIER_A_COLD_STARTS.length >= 10);
    assert.ok(TIER_A_COLD_STARTS.length <= 100);
    const regions = new Set(TIER_A_COLD_STARTS.map((row) => row.region));
    assert.ok(regions.has('famous-short'));
    assert.ok(regions.has('early'));
    assert.ok(regions.has('mid'));
    assert.ok(regions.has('late'));
    for (const sample of TIER_A_COLD_STARTS) {
      assert.equal(sample.id, verseClipId(sample.surah, sample.ayah));
      assert.match(coverageFindingId(sample), /^coverage-tier-a-\d{6}$/);
    }
  });

  it('classifies cold-start pass, miss, and false lock', () => {
    const want = { surah: 112, ayah: 1 };
    assert.equal(classifyColdStart(want, [{ surah: 112, ayah: 1 }]).ok, true);
    assert.equal(classifyColdStart(want, []).class, 'cold_miss');
    assert.equal(classifyColdStart(want, [{ surah: 2, ayah: 1 }]).class, 'false_lock');
  });

  it('parses committed ledger and summarizes open classes', () => {
    const text = readFileSync(path.join(root, 'prompts/real-imam/findings/ledger.jsonl'), 'utf8');
    const rows = parseLedger(text);
    assert.ok(rows.length >= 3);
    for (const row of rows) {
      assert.ok(row.finding_id);
      assert.ok(['open', 'closed', 'deferred'].includes(row.status));
      assert.ok(row.class);
      assert.ok(row.owner);
    }
    const summary = summarizeFindings(rows);
    assert.ok(summary.open + summary.deferred + summary.closed === rows.length);
    assert.ok(summary.open >= 1);
    assert.ok(Object.keys(summary.byClass).length >= 1);
  });

  it('rejects inventing closed locks without status closed', () => {
    const row = JSON.parse(textLine()) as FindingRow;
    assert.notEqual(row.status, 'closed');
  });
});

function textLine(): string {
  return readFileSync(path.join(root, 'prompts/real-imam/findings/ledger.jsonl'), 'utf8')
    .split(/\r?\n/)
    .find((line) => line.includes('floor-jump-ikhlas'))!;
}
