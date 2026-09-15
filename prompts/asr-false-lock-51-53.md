# Asr must not false-lock 51:53; finish short-surah tails

## Goal

1. `npm run test:replay -- asr` first-locks **103:1** (never **51:53**), then 103:2–3.
2. Finish short-surah tails already improved on 1fdb13e: kawthar **108:3**, quraysh **106:3–4**.

Split into a follow-up session if Asr fix and tail stalls fight each other — prefer Asr wrong-surah first.

## Baseline (Sim QA night-report-2210-wrap @1fdb13e)

- asr: FAIL first lock 51:53 expected 103:1
- kawthar: 108:1→2; stall missing 108:3
- quraysh: 106:1→2; stall missing 106:3
- Gates: fatiha + ikhlas GREEN

## Constraints

- One primary concern: **Asr wrong-surah acquire**; then short tails if clean.
- Offline; real ONNX + follower. No mega-prompt with Falaq/Nas.
- Read replay-{asr,kawthar,quraysh}.json, follower.ts.

## Success criteria

1. asr → 103:1–3; never 51:53
2. kawthar → 108:1–3; quraysh → 106:1–4 (or exact failureMode)
3. fatiha + ikhlas GREEN; npm test/typecheck/lint; refresh JSON

## Deliverable

Commands, JSON paths, files changed, next slice.
