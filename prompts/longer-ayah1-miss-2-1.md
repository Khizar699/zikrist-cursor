# Longer suite: lock Baqarah 2:1 before 2:2+

## Goal

`npm run test:replay -- longer` must first-lock **2:1**, then 2:2–5 in order (Al-Baqarah clips 002001–002005).

## Baseline (Sim QA night-report-2231-expand @5674f3e)

- FAIL: longer skips 2:1 (sequence break at ayah 1)
- Edge suites english-negative / basmala-hold / cold-start-mid / stall-after-lock PASS — do not regress
- Gates: fatiha + ikhlas + falaq GREEN

## Constraints

- One concern: **longer / Baqarah 2:1 acquire miss** (mysterious letters / muqatta'at class likely).
- Offline; real ONNX + follower. No fixture/harness retune.
- Read replay-longer.json if present, follower.ts, VALIDATION.md.

## Success criteria

1. test:replay longer → 2:1–5 ordered; failureMode null
2. fatiha, ikhlas, falaq, english-negative, basmala-hold, stall-after-lock stay GREEN
3. npm test / typecheck / lint; refresh JSON

## Deliverable

Commands, JSON path, files changed, next slice.
