# Al-Baqarah 2:1 must lock from ayah-1 body evidence

## Goal

`npm run test:replay -- longer` (Al-Baqarah 2:1–5) must first-lock **2:1**, then 2:2–2:5 in order with `failureMode: null`. Basmala-only audio must still lock nothing. Do not hardcode Al-Baqarah unless a well-tested last resort.

## Baseline (main `5674f3e`, Sim QA `night-report-2231-expand.json`)

- `longer`: `sequence_break_at_0_got_2:2_expected_2:1` (2:2→2:5).
- `basmala-hold` GREEN: `001001` alone must not lock 1:1 or another ayah.
- `cold-start-mid` GREEN: trimmed `002002` still locates 2:2 (no 2:1 body in the window).
- Linux ONNX on this workspace also first-locked **18:46** (`المال`) from 2:1 `الم` via `relatedStem` prefix, then stuck. Same slice: ayah-1 body is not a license to name a longer lookalike.

Mandatory regression gates: fatiha, ikhlas, falaq, english-negative, basmala-hold, cold-start-mid, stall-after-lock. Nas 114:6 and Asr/Kawthar/Quraysh belong to other agents.

## Inspected

`AGENTS.md`, `VALIDATION.md`, `scripts/replay.ts`, `scripts/replay-suites.ts`, `src/core/follower.ts`, `src/core/continuation-gate.ts`, live `quran.json` 2:1 phonemes `بسم الله الرحمن الرحيم الم` (5 words). EveryAyah `002001` is 7.6 s Basmala+`الم`.

## Cause

1. `relatedStem` treats `الم` as a prefix of `المال`, so acquire can commit 18:46.
2. `ayahInSpan` starts at the engine champion (`2:2` / `18:46`) and never looks back to ayah 1 even when `الم` is still in the window.
3. `ContinuationGate` requires `matched_indices > 4` after Basmala. 2:1’s only body word is index 4, so a real 2:1 commit stays pending and 2:2 (ayah ≠ 1) displays as the first unique match.

## Principle

Ayah-1 **body** after the shared Basmala is lock evidence. Basmala is not. A longer word that only starts with that short body token is not another ayah. When ayah-1 body and a later same-surah ayah are both in the window, lock ayah 1 first. Identical muqattaʿāt still prefer the earlier surah (existing duplicate helper). Cold-start audio without ayah-1 body still locks the heard later ayah.

## Area to touch

- `src/core/follower.ts` — stem tightness; span prefers evidenced ayah 1
- `src/core/continuation-gate.ts` — confirm ayah-1 when the only body word was heard; pending ayah-1 + ayah-2 of the same surah
- `tests/follower.test.ts`, `tests/continuation-gate.test.ts`
- `VALIDATION.md` — honest replay note

## Out of scope

Nas last-ayah, Asr/Kawthar/Quraysh, UI, model retune, Baqarah-only special case.

## Acceptance

1. `npm run test:replay -- longer` → 2:1–5, `failureMode` null; never 18:46 first lock.
2. `basmala-hold` still no locks; `cold-start-mid` still 2:2.
3. The 7 named regression gates stay green.
4. `npm test`, typecheck, lint pass.
5. Unit tests encode 2:1 body vs `المال`, mixed 2:1+2:2 preferring 2:1, 2:2-only cold start, Basmala-only not locking 2:1, gate confirm on index 4 of 5, Ikhlas still needing a word after `قل`.
