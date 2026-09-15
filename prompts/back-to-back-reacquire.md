# Back-to-back reacquire after a finished short surah

## Goal

When one short surah ends and another begins in the same session, acquire the new surah’s ayah 1 promptly and follow the rest. `npm run test:replay -- back-to-back` must confirm **103:1–3 then 106:1–4**. Asr must stay green. Standalone `asr`, `quraysh`, `fatiha`, `kawthar`, `ikhlas`, `falaq` must not regress. Basmala-echo 55:1 stays blocked; distinctive one-word ayah-1 bodies (العصر) still confirm through ContinuationGate.

## Scope

Inspected: `AGENTS.md`, `prompts/back-to-back-quraysh-after-asr.md`, `prompts/OVERNIGHT-QUEUE.md`, `src/core/{follower,continuation-gate,salah-prior,basmala}.ts`, `tests/{follower,continuation-gate}.test.ts`, `scripts/{replay,replay-suites}.ts`.

Failure: `stall_missing_106:1_after_3_matches` — Asr 103:1–3 locks, then Quraysh 106:1 never acquires.

## Assumptions

- Mushaf-next after 103:3 is 104:1 (Al-Humazah), not 106:1. `shouldAdvance` correctly refuses a cross-surah next. Completing 114:6 (`!next`) already cold-starts; completing any other last ayah stays in follow with `atSurahBoundary`.
- The 1.2 s follow window still holds the 103:3 tail when 106:1 begins. `lockFromNextSurahPool` / `heardDistinct` require the new ayah opening at the start of the **mixed** transcript, so 106:1 is never pooled. `explainScore` of 103:3 stays ≥ 0.5, so mismatches never reacquire and jump never fires.
- `remainingAfterCurrent` also requires the last-ayah **opening** still in the window. Last-ayah openings age out of 1.2 s; leftover extraction uses a **suffix of the completed ayah**, not an interior coincidence (هو in 108:3 and 112:1 must not strip 112:1).
- Prefer leftover-as-query / cold locate after surah complete over weakening `canLock`, ContinuationGate, or the 55:1 Basmala-echo guard.
- Shared Basmala leftover still must not lock mushaf-next or a later short surah.

## Files

- `src/core/follower.ts` — leftover after a last-ayah suffix; next-surah pool and cold locate on that leftover; do not keep a finished last ayah’s neighborhood when leftover is a new recitation.
- `tests/follower.test.ts` — Asr last ayah + leftover 106:1; Basmala leftover does not lock 104:1.
- `README.md`, `VALIDATION.md`, this prompt.

## Architecture / security

- Acquire / follow / reacquire unchanged as phases. Tilawa remains transcribe + index only.
- Predictions still do not display or enter history. Offline only. No uploads, analytics, or lock-bar retunes.

## Acceptance

1. `npm run test:replay -- back-to-back` → 103:1–3 then 106:1–4, `failureMode` null.
2. `npm run test:replay -- asr quraysh fatiha` PASS.
3. No regression of kawthar / ikhlas / falaq / edge gates / 55:1 guard (unit coverage + those replays when fixtures exist).
4. `npm test` / typecheck / lint pass.

## Checks / device

Headless ONNX replay and unit tests. Not a physical-device, mosque, or battery claim.
