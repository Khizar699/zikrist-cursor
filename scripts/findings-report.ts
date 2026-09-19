/**
 * Summarize prompts/real-imam/findings/ledger.jsonl for agents / tip triage.
 *
 *   npm run findings:report
 */
import {
  loadLedger,
  summarizeFindings,
  LEDGER_PATH,
} from './lib/findings';

const rows = loadLedger();
const summary = summarizeFindings(rows);
const open = rows.filter((row) => row.status === 'open');
const deferred = rows.filter((row) => row.status === 'deferred');

console.log(JSON.stringify({
  ledger: LEDGER_PATH,
  totals: summary,
  open_p0_candidates: open.map((row) => ({
    finding_id: row.finding_id,
    class: row.class,
    owner: row.owner,
    suite_or_clip: row.suite_or_clip,
    notes: row.notes,
  })),
  deferred: deferred.map((row) => row.finding_id),
  tip_hint: open[0]
    ? `Tip Open tracks P0 finding_id: ${open[0].finding_id} (or floor restore if floor red)`
    : 'No open findings; keep floor green and grow Tier A.',
}, null, 2));
