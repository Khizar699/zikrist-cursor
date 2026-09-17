/**
 * Findings ledger helpers + Tier A stratified cold-start sample.
 * No ONNX here — coverage runner imports this for list/classify/append.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type VerseRef = { surah: number; ayah: number };
export type FindingOwner = 'locate' | 'follow' | 'gate' | 'fixture' | 'infra';
export type FindingClass =
  | 'cold_miss'
  | 'false_lock'
  | 'stall'
  | 'wrong_handoff'
  | 'soft_after_expect'
  | 'missing_fixture'
  | 'missing_onnx';

export type FindingSource =
  | 'floor'
  | 'coverage_tier_a'
  | 'coverage_tier_b'
  | 'product_bar'
  | 'manual';

export type FindingStatus = 'open' | 'closed' | 'deferred';

export type FindingRow = {
  finding_id: string;
  status: FindingStatus;
  class: FindingClass;
  owner: FindingOwner;
  want: VerseRef[];
  got: Array<VerseRef & { at_seconds?: number | null }>;
  source: FindingSource;
  suite_or_clip: string;
  clip_class: string | null;
  created_at: string;
  notes: string;
  closed_by: string | null;
  environment: string | null;
};

export type CoverageSample = {
  id: string;
  surah: number;
  ayah: number;
  region: 'famous-short' | 'early' | 'mid' | 'late' | 'shared-opening';
  clip_class: 'famous-short' | 'non-famous-cold' | 'synthetic';
  notes: string;
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const FINDINGS_DIR = path.join(root, 'prompts/real-imam/findings');
export const LEDGER_PATH = path.join(FINDINGS_DIR, 'ledger.jsonl');

/** Tier A starter set (~18 openings). Expand later; report honest M/N. */
export const TIER_A_COLD_STARTS: CoverageSample[] = [
  { id: '001002', surah: 1, ayah: 2, region: 'famous-short', clip_class: 'famous-short', notes: 'Fatiha Alhamdulillah' },
  { id: '112001', surah: 112, ayah: 1, region: 'famous-short', clip_class: 'famous-short', notes: 'Ikhlas' },
  { id: '114001', surah: 114, ayah: 1, region: 'famous-short', clip_class: 'famous-short', notes: 'An-Nas' },
  { id: '113001', surah: 113, ayah: 1, region: 'famous-short', clip_class: 'famous-short', notes: 'Al-Falaq' },
  { id: '108001', surah: 108, ayah: 1, region: 'famous-short', clip_class: 'famous-short', notes: 'Kawthar' },
  { id: '103001', surah: 103, ayah: 1, region: 'famous-short', clip_class: 'famous-short', notes: 'Asr' },
  { id: '109001', surah: 109, ayah: 1, region: 'shared-opening', clip_class: 'famous-short', notes: 'Kafirun' },
  { id: '002001', surah: 2, ayah: 1, region: 'early', clip_class: 'non-famous-cold', notes: 'Baqarah muqattaat' },
  { id: '003001', surah: 3, ayah: 1, region: 'early', clip_class: 'non-famous-cold', notes: 'Imran' },
  { id: '004001', surah: 4, ayah: 1, region: 'early', clip_class: 'non-famous-cold', notes: 'Nisa' },
  { id: '018001', surah: 18, ayah: 1, region: 'mid', clip_class: 'non-famous-cold', notes: 'Kahf' },
  { id: '019001', surah: 19, ayah: 1, region: 'mid', clip_class: 'non-famous-cold', notes: 'Maryam' },
  { id: '036001', surah: 36, ayah: 1, region: 'mid', clip_class: 'non-famous-cold', notes: 'Yasin' },
  { id: '055001', surah: 55, ayah: 1, region: 'late', clip_class: 'non-famous-cold', notes: 'Rahman' },
  { id: '067001', surah: 67, ayah: 1, region: 'late', clip_class: 'non-famous-cold', notes: 'Mulk' },
  { id: '078001', surah: 78, ayah: 1, region: 'late', clip_class: 'non-famous-cold', notes: 'Naba' },
  { id: '056001', surah: 56, ayah: 1, region: 'late', clip_class: 'non-famous-cold', notes: 'Waqiah' },
  { id: '105001', surah: 105, ayah: 1, region: 'famous-short', clip_class: 'famous-short', notes: 'Fil' },
];

export function verseClipId(surah: number, ayah: number): string {
  return `${String(surah).padStart(3, '0')}${String(ayah).padStart(3, '0')}`;
}

export function classifyColdStart(want: VerseRef, matches: VerseRef[]): {
  class: FindingClass;
  owner: FindingOwner;
  ok: boolean;
} {
  if (!matches.length) {
    return { class: 'cold_miss', owner: 'locate', ok: false };
  }
  const first = matches[0]!;
  if (first.surah === want.surah && first.ayah === want.ayah) {
    return { class: 'cold_miss', owner: 'locate', ok: true };
  }
  return { class: 'false_lock', owner: 'locate', ok: false };
}

export function parseLedger(text: string): FindingRow[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as FindingRow);
}

export function loadLedger(filePath = LEDGER_PATH): FindingRow[] {
  if (!fs.existsSync(filePath)) return [];
  return parseLedger(fs.readFileSync(filePath, 'utf8'));
}

export function appendFinding(row: FindingRow, filePath = LEDGER_PATH): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const existing = loadLedger(filePath);
  const without = existing.filter((item) => item.finding_id !== row.finding_id);
  const lines = [...without, row].map((item) => JSON.stringify(item));
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`);
}

export function summarizeFindings(rows: FindingRow[]): {
  open: number;
  closed: number;
  deferred: number;
  byClass: Record<string, number>;
} {
  const byClass: Record<string, number> = {};
  let open = 0;
  let closed = 0;
  let deferred = 0;
  for (const row of rows) {
    if (row.status === 'open') open += 1;
    else if (row.status === 'closed') closed += 1;
    else deferred += 1;
    if (row.status === 'open' || row.status === 'deferred') {
      byClass[row.class] = (byClass[row.class] ?? 0) + 1;
    }
  }
  return { open, closed, deferred, byClass };
}

export function coverageFindingId(sample: CoverageSample): string {
  return `coverage-tier-a-${sample.id}`;
}
