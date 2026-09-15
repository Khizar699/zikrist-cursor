# Back-to-back: after Asr, start Quraysh 106:1

## Goal

`npm run test:replay -- back-to-back` (Asr then Quraysh concat) must complete **103:1–3** then **106:1–4**. Standalone asr + quraysh are GREEN — this is the **surah transition** after Asr ends.

## Baseline (night-report-2242 @eacf963)

- FAIL back-to-back: `stall_missing_106:1_after_3_matches` (asr OK, no Quraysh)
- Preserve standalone asr + quraysh GREEN

## Constraints

- One concern: **Asr→Quraysh transition** (bounded next-surah pool / fresh locate after last ayah).
- Offline; real ONNX + follower.
- Read replay-back-to-back.json, follower.ts end-of-surah path.
- Keep Basmala-echo 55:1 guard; do not retune Nas/Baqarah in this session.

## Success criteria

1. test:replay back-to-back → 103:1–3 then 106:1–4
2. asr + quraysh standalone stay GREEN
3. npm test pass; open PR (do not merge)

## Inspected (after Nas #3 on main)

- `src/core/follower.ts` last-ayah path: `shortLastAyahFollow` / 5 s accumulate apply while **waiting for** a short last ayah of the current surah (114:5→114:6). They do not fire on 103:3, whose mushaf-next is 104:1.
- 103:3 can lock before 82% coverage. Linux: 103:3@9.25 s of a 12.5 s clip. Mac Sim QA: 103:1@1, 103:2@5.75, 103:3@8.25, then `stall_missing_106:1_after_3_matches`. 106:1 audio starts at ~19.96 s. A Linux-only leftover pass is not enough.
- Requiring leftover to be 100% unexplained fails when the 1.2 s window still has any 103:3 token (interior word, or a tail token after 106:1 in CTC order). Filter unexplained tokens and pool/locate those.
- Mushaf-next after 103:3 is 104:1, not 106:1. Shared Basmala leftover must not lock Humazah. Keep Fatiha, Basmala-echo 55:1, and short-surah greens.

## Files

- `src/core/follower.ts` — last-ayah leftover is unexplained tokens in the follow window (not a 100%-clean suffix); pool/locate those even before 82% coverage; keep-window reacquire onto the 4 s acquire window when leftover cannot lock yet. Nas last-ayah window and jump guard left intact.
- `tests/follower.test.ts` — leftover 106:1 after 103:3; interior 103:3 token mixed with 106:1; 106:1 tokens before a 103:3 tail token; aged-out opening; Basmala leftover does not lock 104:1; leftover that cannot lock yet cold-starts acquire.
- `README.md`, `VALIDATION.md`, this prompt.

## Architecture / security

- Acquire / follow / reacquire unchanged as phases. Tilawa remains transcribe + index only.
- Predictions still do not display or enter history. Offline only. No uploads, analytics, or lock-bar retunes.

## Checks / device

Headless ONNX replay and unit tests. Not a physical-device, mosque, or battery claim.

## Mac gate (required)

Linux PASS is **not** enough. Mac Sim QA on the leftover path still needs:

1. Apple Silicon: `npm run test:replay -- back-to-back` → 103:1–3 then 106:1–4 (`failureMode` null)
2. Also Mac: `asr`, `quraysh`, `fatiha`, `nas` GREEN (Nas 114:6 must not regress)
3. Do not claim green from Linux-only ONNX

## Result

Rebased onto current `main` `82d4f28` (includes merged Nas 114:6 `802bc66` plus the Baqarah Mac-gate prompt note). Leftover crumb/mix path unchanged. Post-rebase Linux/x64 re-run:

- `npm test` 118/118; `npm run typecheck` pass. Lint still reports the pre-existing unused `openingScore` warning.
- `back-to-back` PASS: 103:1@1s, 103:2@8.75s, 103:3@9.25s, 106:1@21.75s, 106:2@27.25s, 106:3@31.25s, 106:4@40.5s; `failureMode` null; `wrongSurahRate` 0. Asr does not re-lock 103:1 after 103:3.
- Standalone `asr`, `quraysh`, `fatiha`, `nas` (114:1–6 including 114:6@33.75s), `kawthar`, `ikhlas`, `falaq`, `basmala-hold` PASS. Not a physical-device or Mac-local claim. Mac `npm run test:replay -- back-to-back` remains the merge gate.
