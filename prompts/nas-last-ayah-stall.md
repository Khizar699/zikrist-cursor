# Nas must advance through 114:6 (no stall after 114:5)

## Goal

`npm run test:replay -- nas` must lock 114:1–6 in order without stalling after 114:5.

## Last Sim QA (9e55c92 / night-report-2152)

- FAIL `stall_missing_114:6_after_5_matches`
- firstLockSeconds=4; matches 114:1@4, 2@6.5, 3@7, 4@19.75, 5@25.75 — **missing 114:6**
- inputSeconds≈40.56 — audio long enough that 114:6 should appear

## Constraints

- One concern: **Nas last-ayah advance / stall**. Do not retune Fatiha or other suites except to avoid regressions.
- Offline; real ONNX + follower. Check follow window, unique next-ayah tokens for 114:6, end-of-surah / reacquire edge.
- Read replay-nas.json, follower.ts, VALIDATION.md.

## Success criteria

1. test:replay nas → 114:1–6 ordered; failureMode null
2. ikhlas + falaq stay GREEN; npm test/typecheck/lint pass; refresh replay-nas.json

## Deliverable

Commands, JSON path, files changed, next slice.
