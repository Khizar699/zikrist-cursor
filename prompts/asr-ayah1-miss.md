# Asr must lock 103:1 first (clears back-to-back)

## Goal

`npm run test:replay -- asr` must first-lock **103:1**, then 103:2–3. This also unblocks `back-to-back` (Asr→Quraysh), which currently inherits the 103:1 skip.

## Baseline (night-report-2231-expand @5674f3e)

- asr: sequence_break got 103:2 expected 103:1 (then 103:3) — no longer false-locks 51:53
- back-to-back: FAIL inherits asr 103:1 skip
- Keep fatiha/ikhlas/falaq + edge PASS suites GREEN

## Constraints

- One concern: **Asr ayah-1 miss**. Offline; real ONNX + follower.
- Read replay-asr.json, follower.ts.

## Success criteria

1. test:replay asr → 103:1–3
2. test:replay back-to-back progresses past Asr open (or exact new failureMode)
3. Regression gates GREEN; npm test/typecheck/lint; refresh JSON

## Deliverable

Commands, JSON paths, files changed, next slice.
