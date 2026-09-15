# Short-surah body-start and last-ayah tail

## Goal

One coherent acquire/follow change so short-surah replays lock the opening body (not ayah 2+) and finish the last ayah, without verse-ID special cases.

1. `npm run test:replay -- asr` first-locks **103:1** then 103:2–3 (`failureMode: null`). Never 51:53.
2. `npm run test:replay -- kawthar` locks **108:1–3**.
3. `npm run test:replay -- quraysh` locks **106:1–4**.
4. Regression gates stay green: Fatiha 1:2→1:7, Ikhlas 112:1→4, Falaq 113:1→5.
5. Nas 114:6 is owned elsewhere — do not change Nas-specific last-ayah behavior.

## Baseline (main `d1ba1c9` / prompt `74a48dd`)

- PASS: Fatiha, Ikhlas, Falaq.
- Asr: no longer false-locks 51:53; skips 103:1 and confirms 103:2→103:3.
- Kawthar: 108:1@7.5 → 108:2@9, then `stall_missing_108:3`.
- Quraysh: 106:1@2 → 106:2@7.25, then `stall_missing_106:3`.

## Inspected

- `AGENTS.md`, `VALIDATION.md`
- `prompts/asr-false-lock-51-53.md`, `prompts/kawthar-last-ayah-stall-108-3.md`, `prompts/short-surah-ayah1-miss.md`
- `src/core/follower.ts` (`canLock` ayah>1 rival gate, `ayahInSpan` from champion.ayah, `shouldAdvance`, `alignForCommit`)
- `src/core/continuation-gate.ts` (`skip > 0` requires `index > skip`, so a one-word ayah-1 body after Basmala can never confirm)
- Replay path: `scripts/replay.ts` (ONNX + `RecitationFollower` + `ContinuationGate`)

## Assumptions

- Asr skip is structural: 103:1 body is a single distinctive word after Basmala; the gate / `canLock` / span start from ayah 2 discard it.
- Kawthar/Quraysh tails are the same class: leftover in a 1.2 s follow window after a completed short ayah, opening ASR-garbled, distinctive body tokens still present.
- Shared openings (`قل`, `إن`, `الحمد`, `رب`) must still not lock or advance alone.
- No hardcoded 103/108/106 IDs.

## Architecture / security

- Offline recognition only. No audio persistence, uploads, or analytics.
- Keep the engine adapter narrow; do not pull Tilawa streaming tracker into the live path.

## Acceptance

1. Replay asr / kawthar / quraysh: ordered complete sequences, `failureMode: null`.
2. Fatiha, Ikhlas, Falaq remain green.
3. Unit tests cover: short ayah-1 body confirm; earliest evidenced body-start in a mixed window; last/short next-ayah leftover tokens; cross-surah lookalike (51:53-class) still rejected.
4. `npm test`, `typecheck`, `lint` pass.

## Checks / device

- `npm run test:replay -- asr kawthar quraysh fatiha ikhlas falaq`
- Headless ONNX replay only. Not a phone/mosque measurement.
