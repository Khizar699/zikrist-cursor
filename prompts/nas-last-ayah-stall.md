# Nas must complete 114:6 without jumping to 7:1

## Goal

`npm run test:replay -- nas` must lock **114:1–6** in order. After 114:5 do **not** jump to **7:1** (or any other surah). Isolated `114006.wav` already transcribes as `من الجنه والناس`.

## Baseline (HEAD eacf963 / 8f176d4)

- FAIL `sequence_break_at_5_got_7:1_expected_114:6`
- Matches: 114:1–5 then **7:1** (was stall_missing_114:6; now wrong-surah jump)
- Isolated 114:6 clip ~8.2 s; default follow is 1.2 s / 0.4 s hop
- Preserve: ikhlas, falaq, asr, kawthar, quraysh. Do not regress Fatiha (broken on main with first_lock 55:1 / 1:6 — separate agent).
- Do not special-case 114:6 / 7:1 IDs; end-of-surah short-last-ayah + mysterious-letter whole-word guard only.

## Root cause

114:6 is a 3-word last ayah recited slowly (~8 s). After 114:5 locks, 1.2 s follow slices decode as garbage. Locate then names 7:1 from substring/stem hits (`المصدر` / `المدرس` vs `المص`). Live 7:1 is Basmala plus Uthmani `الٓمٓصٓ` (maddahs make `length > 5`), so a display-word length guard never fires. The continuation gate may hide 7:1, but `RecitationFollower.lock` still jumps and 114:6 never follows.

## Algorithm

When mushaf-next is the last ayah of the current surah and has ≤ 4 body words:

1. Grow the follow window to 5 s so the last ayah can accumulate as one utterance.
2. Once the penultimate ayah is acoustically complete, trim to a 0.3 s seed so the penultimate tail does not dominate.
3. Do not reacquire while that window is still filling; locate can still recover a wrong lock.
4. Mysterious-letter `canLock` uses **phoneme body** tokens and requires an exact whole word (`المص`).
5. While waiting for that short last ayah, refuse a cross-surah jump.

## Files

`src/core/follower.ts`, `tests/follower.test.ts`, `prompts/nas-last-ayah-stall.md`, `README.md`, `VALIDATION.md`.

## Architecture / security

- Offline; real ONNX + follower. Predictions, coverage, and elapsed time must not become displayed translations.
- No hardcoded verse IDs.
- Private local capture only.

## Acceptance

1. `npm run test:replay -- nas` → 114:1–6; `failureMode: null`; never 7:1
2. ikhlas, falaq, asr, kawthar, quraysh stay green; do not worsen Fatiha first-lock vs main
3. `npm test`, typecheck, lint
4. Unit: last-ayah window grows; unique last-ayah body token advances; Basmala+`المص` garbage cannot lock 7:1 after 114:5

## Checks and device tests

`npm run typecheck`, `npm run lint`, `npm test`, `npm run test:replay -- nas|ikhlas|falaq|asr|kawthar|quraysh`. Not a physical-device measurement.
