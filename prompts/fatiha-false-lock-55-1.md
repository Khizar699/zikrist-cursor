# Restore Fatiha first lock 1:2 (reject 55:1 Basmala echo)

## Goal

`npm run test:replay -- fatiha` must first-lock **1:2**, never **55:1** (Ar-Rahman). Keep short-surah wins (asr 103:1, kawthar 108:1–3, quraysh 106:1–4) if already green on 4db4536.

## Baseline (main 4db4536 after PR #2)

- REGRESSION: fatiha `first_lock_55:1_expected_1:2`
- Cause class: one-word post-Basmala ayah-1 confirm treated shared Basmala token الرحمن as 55:1
- Local report: asr / kawthar / quraysh / ikhlas / falaq GREEN — do not undo those

## Constraints

- One concern: **Fatiha ≠55:1** / Basmala-echo refuse while distinctive one-word openings (e.g. والعصر) still confirm.
- Offline; real ONNX + follower. No suite-ID special cases if a general Basmala-echo rule works.
- Read follower.ts, continuation-gate.ts, PR #2 diff, replay-fatiha.json.

## Success criteria

1. test:replay fatiha → 1:2–7; never 55:1
2. asr, kawthar, quraysh, ikhlas, falaq stay GREEN
3. npm test / typecheck / lint; refresh JSON

## Deliverable

Commands, JSON path, files changed, next slice.
