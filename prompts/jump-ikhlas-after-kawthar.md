# Jump suite: after Kawthar, lock Ikhlas 112:1 (not skip 112:1–3)

## Goal

`npm run test:replay -- jump` (Kawthar then Ikhlas concat) must complete **108:1–3** then **112:1–4** in order. Do not skip Ikhlas openings.

## Baseline (Sim QA night-report-2242 @eacf963)

- 10/14 PASS including standalone kawthar + ikhlas
- FAIL jump: `sequence_break_at_3_got_112:4_expected_112:1` (kawthar OK then skip 112:1–3)
- Preserve standalone kawthar + ikhlas GREEN

## Constraints

- One concern: **post-Kawthar → Ikhlas acquire/follow**. Offline; real ONNX + follower.
- Read replay-jump.json, follower next-surah pool / reacquire after last ayah.
- Do not retune Nas 7:1 or Baqarah 2:1 in this session.
- Keep Basmala-echo 55:1 guard.

## Success criteria

1. test:replay jump → 108:1–3 then 112:1–4
2. kawthar + ikhlas standalone stay GREEN
3. npm test pass; open PR (do not merge)

## Session result (Linux onnxruntime-node, not a phone)

- Cause: leftover last-ayah tokens in the 1.2 s follow window were scored with the next opening, so 112:4 could first-lock after 108:3.
- First fix: leftover next-surah pool scoring + prefer first usable ayah of the newly located surah. No Nas 7:1 / Baqarah 2:1 retune. Basmala-echo 55:1 unit still passes.
- Linux `npm run test:replay -- jump` PASS (112:1@16.75s). That **did not reproduce** on Mac Sim QA of the same fixtures (`112:4@24.75`, no 112:1–3). Standalone ikhlas still PASS on Mac — the concat 1.2 s follow path was the delta.
- Follow-up: after the last ayah, grow like acquire (4 s), do not wipe on last-ayah re-hear, hold `قل`-only later ayahs, reject Basmala-only pool locks.
- PR: do not merge.
