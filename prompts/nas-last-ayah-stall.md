# Nas must complete 114:6 without jumping to 7:1

## Goal

`npm run test:replay -- nas` must lock **114:1–6** in order. After 114:5 do **not** jump to **7:1** (or any other surah).

## Baseline (HEAD eacf963)

- FAIL `sequence_break_at_5_got_7:1_expected_114:6`
- Matches: 114:1–5 then **7:1, 7:2** (was stall_missing_114:6; now wrong-surah jump)
- GREEN gates to preserve: fatiha 1:2–7, ikhlas, falaq, asr 103:1–3, kawthar 108:1–3, quraysh 106:1–4

## Constraints

- One concern: Nas end-of-surah / last-ayah — finish 114:6, block mysterious-letter / Al-A'raf false jump.
- Offline; real ONNX + follower.
- Read replay-nas.json, follower.ts, continuation-gate.ts.

## Success criteria

1. test:replay nas → 114:1–6; failureMode null; never 7:1
2. Listed GREEN gates stay GREEN
3. npm test / typecheck / lint; refresh JSON

## Deliverable

Commands, JSON path, files changed, next slice.
