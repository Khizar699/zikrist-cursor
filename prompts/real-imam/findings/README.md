# Findings ledger

Machine-readable Mac misses and coverage rows for multi-agent continuity.  
**Audio stays gitignored.** This folder (schema + ledger JSONL) is committed.

## Files

| File | Role |
|---|---|
| [schema.json](./schema.json) | JSON Schema for one finding row |
| [ledger.jsonl](./ledger.jsonl) | Append-only open/closed findings (one JSON object per line) |
| [COVERAGE.md](../algo/COVERAGE.md) | Classes, tiers, commands |

## Agent rules

1. **Append** new honest Mac misses; do not invent ayah labels.
2. Tip **Open tracks** names at most **one** P0 `finding_id` (or floor restore).
3. Closing a finding requires a **ratchet lock** (unit and/or ready expect) in the same PR; then set `"status": "closed"` and `closed_by` (PR/SHA note).
4. Finder bots may only add findings + tip suggestions — not silent matcher retunes.

## Commands

```bash
npm run test:coverage -- --list
npm run test:coverage -- --dry-run
npm run test:coverage                 # Mac + ONNX: append open misses, print M/N
npm run findings:report
```
