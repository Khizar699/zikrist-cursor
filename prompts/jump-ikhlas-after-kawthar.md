# Jump suite: after Kawthar, lock Ikhlas 112:1 (not skip 112:1–3)

## Goal

`npm run test:replay -- jump` (Kawthar then Ikhlas concat) must complete **108:1–3** then **112:1–4** in order. Do not skip Ikhlas openings.

## Baseline (Sim QA night-report-2242 @eacf963)

- 10/14 PASS including standalone kawthar + ikhlas
- FAIL jump: skips Ikhlas 112:1–3 after Kawthar (surah-transition / acquire after finished short surah)
- Preserve standalone kawthar + ikhlas GREEN

## Constraints

- One concern: **post-Kawthar → Ikhlas acquire/follow**. Offline; real ONNX + follower.
- Read replay-jump.json, follower next-surah pool / reacquire after last ayah.
- Do not retune Nas 7:1 or Baqarah 2:1 in this session.

## Success criteria

1. test:replay jump → 108:1–3 then 112:1–4
2. kawthar + ikhlas standalone stay GREEN
3. npm test/typecheck/lint; refresh JSON

## Deliverable

Commands, JSON path, files changed, next slice.
