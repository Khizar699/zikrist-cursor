# Restore Falaq follow through 113:4–5 (no stall after 113:3)

## Goal

`npm run test:replay -- falaq` must complete **113:1–5** in order. Do not stall after 113:3.

## Last Sim QA (52f4cb4)

- REGRESSION: `stall_missing_113:4_after_3_matches` (was full GREEN on 9e55c92)
- Matches: 113:1@3, 113:2@3.5, 113:3@10 — missing 113:4–5
- Keep Fatiha 1:2–1:7 and Ikhlas 112:1–4 GREEN

## Constraints

- One concern: **Falaq mid-follow stall** after 113:3.
- Offline; real ONNX + RecitationFollower. Likely side-effect of 52f4cb4 follow/acquire harden — find and fix without undoing Fatiha/Ikhlas wins.
- Read follower.ts, replay-falaq.json, VALIDATION.md, diff vs 9e55c92 behavior.

## Success criteria

1. test:replay falaq → 113:1–5 ordered; failureMode null
2. fatiha + ikhlas stay GREEN
3. npm test / typecheck / lint pass; refresh replay-falaq.json

## Deliverable

Commands, JSON path, files changed, next slice.
