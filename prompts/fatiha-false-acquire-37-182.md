# Fatiha first lock must be 1:2 not 37:182

## Goal

`npm run test:replay -- fatiha` must first-lock **1:2**, never **37:182** (or other distant ayahs). Then follow 1:3…1:7 in order.

## Last Sim QA (commit 9e55c92 / night-report-2152)

- FAIL `first_lock_37:182_expected_1:2` @ firstLockSeconds=8.75 score 0.81
- Only match: 37:182@8.75s — stall (no 1:2–1:7)
- Ikhlas + Falaq GREEN on same commit — do not regress those

## Constraints

- Offline; real ONNX + RecitationFollower. One concern: **Fatiha false first acquire**.
- Keep Ibrahim 14:39/14:40 guards, Ikhlas 112:1–4, Falaq 113:1–5.
- Prefer unique-word / shared-prefix hold / reject thin-window distant champions over wider follow windows.
- Read AGENTS.md, VALIDATION.md, src/core/follower.ts, scripts/replay.ts, artifacts/qa-runs/replay-fatiha.json.

## Success criteria

1. `npm run test:replay -- fatiha` → first lock 1:2; never 37:182; then 1:3–1:7 ordered (or exact failureMode).
2. `npm run test:replay -- ikhlas` and `-- falaq` stay GREEN.
3. npm test, typecheck, lint pass; refresh replay-fatiha.json + VALIDATION.md note.

## Deliverable

Commands, JSON path, files changed, next slice.
