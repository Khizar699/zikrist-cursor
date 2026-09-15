# Nas must complete 114:6 (post-1fdb13e)

## Goal

`npm run test:replay -- nas` must lock **114:1–6** in order — no stall after 114:5.

## Baseline (HEAD 1fdb13e)

- FAIL `stall_missing_114:6_after_5_matches`
- Matches: 114:1–5; audio long enough (~40s) for 114:6
- Keep fatiha + ikhlas GREEN

## Constraints

- One concern: Nas last-ayah advance / end-of-surah follow.
- Offline; real ONNX + follower. Check unique next-ayah tokens for 114:6, follow window, reacquire edge.
- Read replay-nas.json, follower.ts.

## Success criteria

1. test:replay nas → 114:1–6; failureMode null
2. fatiha + ikhlas GREEN; npm test/typecheck/lint; refresh replay-nas.json

## Deliverable

Commands, JSON path, files changed, next slice.
