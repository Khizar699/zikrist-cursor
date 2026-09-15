# Kawthar must complete 108:3 (ayah-1 already fixed)

## Goal

`npm run test:replay -- kawthar` must lock **108:1–3** in order. Ayah-1 skip is fixed on 1fdb13e; finish the surah.

## Baseline (HEAD 1fdb13e)

- IMPROVED: 108:1@7.5 → 108:2@9 (no longer skip-to-2)
- FAIL `stall_missing_108:3_after_2_matches`
- Keep fatiha + ikhlas GREEN; do not re-break ayah-1

## Constraints

- One concern: **Kawthar last-ayah stall** (108:3).
- Offline; real ONNX + follower. Likely same class as Nas/Falaq last/mid stalls — fix narrowly for 108 follow.
- Read replay-kawthar.json, follower.ts, ContinuationGate.

## Success criteria

1. test:replay kawthar → 108:1–3; failureMode null
2. fatiha + ikhlas GREEN; npm test/typecheck/lint; refresh replay-kawthar.json

## Deliverable

Commands, JSON path, files changed, next slice.
