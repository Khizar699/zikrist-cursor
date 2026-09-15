# Restore Falaq follow through 113:4–5 (post-1fdb13e)

## Goal

`npm run test:replay -- falaq` must complete **113:1–5**. Do not stall after 113:3.

## Baseline (HEAD 1fdb13e)

- FAIL `stall_missing_113:4_after_3_matches`
- Matches: 113:1–3 only (was full GREEN on 9e55c92; regressed since 52f4cb4)
- Regression gates: fatiha 1:2–7 + ikhlas 112:1–4 must stay GREEN

## Constraints

- One concern: Falaq mid-follow stall after 113:3.
- Offline; real ONNX + RecitationFollower. Fix without undoing ContinuationGate ayah-1 / Fatiha wins on 1fdb13e.
- Read follower.ts, continuation-gate.ts, replay-falaq.json, VALIDATION.md.

## Success criteria

1. test:replay falaq → 113:1–5; failureMode null
2. fatiha + ikhlas GREEN; npm test/typecheck/lint; refresh replay-falaq.json

## Deliverable

Commands, JSON path, files changed, next slice.
