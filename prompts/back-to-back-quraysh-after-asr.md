# Back-to-back: after Asr, start Quraysh 106:1

## Goal

`npm run test:replay -- back-to-back` (Asr then Quraysh concat) must complete **103:1–3** then **106:1–4**. Standalone asr + quraysh are GREEN — this is the **surah transition** after Asr ends.

## Baseline (night-report-2242 @eacf963)

- FAIL back-to-back: doesn’t start Quraysh after Asr
- Standalone asr 103:1–3 and quraysh 106:1–4 PASS — preserve those

## Constraints

- One concern: **Asr→Quraysh transition** (bounded next-surah pool / fresh locate after last ayah).
- Offline; real ONNX + follower.
- Read replay-back-to-back.json, follower.ts end-of-surah path.

## Success criteria

1. test:replay back-to-back → 103:1–3 then 106:1–4
2. asr + quraysh standalone stay GREEN
3. npm test/typecheck/lint; refresh JSON

## Deliverable

Commands, JSON path, files changed, next slice.
