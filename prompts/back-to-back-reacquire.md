# Back-to-back reacquire after a finished short surah

## Goal

When one short surah ends and another begins in the same session, acquire the new surah’s ayah 1 promptly and follow the rest. `npm run test:replay -- back-to-back` must confirm **103:1–3 then 106:1–4**. Asr must stay green. Standalone `asr`, `quraysh`, `fatiha`, `kawthar`, `ikhlas`, `falaq` must not regress. Basmala-echo 55:1 stays blocked; distinctive one-word ayah-1 bodies (العصر) still confirm through ContinuationGate.

## Scope

Inspected: `AGENTS.md`, `prompts/back-to-back-quraysh-after-asr.md` (Prompt Smith brief), `prompts/OVERNIGHT-QUEUE.md`, `src/core/{follower,continuation-gate,salah-prior,basmala}.ts`, `tests/{follower,continuation-gate}.test.ts`, `scripts/{replay,replay-suites}.ts`. Rebased onto main after Nas #3 (`802bc66`); do not retune Nas/Baqarah.

Failure: `stall_missing_106:1_after_3_matches` — Asr 103:1–3 locks, then Quraysh 106:1 never acquires.

## Assumptions

- Mushaf-next after 103:3 is 104:1 (Al-Humazah), not 106:1. `shouldAdvance` correctly refuses a cross-surah next. Completing 114:6 (`!next`) already cold-starts; completing any other last ayah stays in follow with `atSurahBoundary`.
- The 1.2 s follow window still holds the 103:3 tail when 106:1 begins. `lockFromNextSurahPool` / `heardDistinct` require the new ayah opening at the start of the **mixed** transcript, so 106:1 is never pooled. `explainScore` of 103:3 stays ≥ 0.5, so mismatches never reacquire and jump never fires.
- `remainingAfterCurrent` also requires the last-ayah **opening** still in the window. Last-ayah openings age out of 1.2 s; leftover extraction uses a **suffix of the completed ayah**, not an interior coincidence (هو in 108:3 and 112:1 must not strip 112:1).
- Last ayah can lock early without 82% coverage (Linux 103:3@9.25; Mac Sim QA 103:3@8.25 of a 12.5 s clip). 106:1 audio starts at ~20 s. Leftover is unexplained tokens in the window, not a 100%-clean suffix: a remaining 103:3 interior word or a tail token after 106:1 in CTC order must not hide Quraysh.
- Prefer leftover-as-query / cold locate after last ayah over weakening `canLock`, ContinuationGate, or the 55:1 Basmala-echo guard.
- Shared Basmala leftover still must not lock mushaf-next or a later short surah.

## Files

- `src/core/follower.ts` — last-ayah leftover is unexplained tokens in the follow window; pool/locate those even before 82% coverage; reacquire onto the 4 s acquire window when leftover cannot lock yet.
- `tests/follower.test.ts` — leftover 106:1 after 103:3; interior mix; 106:1 before a 103:3 tail token; aged-out opening; Basmala leftover does not lock 104:1; leftover that cannot lock yet cold-starts acquire.
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

## Result

Linux/x64 ONNX after leftover-unexplained last-ayah cold-start, rebased onto Nas #3:

- `back-to-back` PASS: 103:1@1s, 103:2@8.75s, 103:3@9.25s, 106:1@23s, 106:2@27s, 106:3@31s, 106:4@40.25s; `failureMode` null; `wrongSurahRate` 0.
- `asr`, `quraysh`, `fatiha`, `nas` PASS (Nas 114:1–6 including 114:6@33.75).
- `npm test` 115/115; typecheck pass. Not a physical-device claim.
