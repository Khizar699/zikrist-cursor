# Follow the locked surah without stalling

## Goal

After a correct first lock, the next same-surah ayah must commit as soon as it is heard. Locate can stay fast. Follow must not freeze on a shared tail (`الناس`, `صرط`, `الله`) while the reciter continues.

## Scope

Inspected: founder live report (Nas stuck on 114:2, Fatiha stuck after 1:6/1:7, Ikhlas 112:1 located but not followed), `src/core/follower.ts`, real `quran.data` phonemes (`114:3` is `اله` not latin `ilahi`).

Root cause: follow is a 1.2 s window that keeps 1.0 s of the previous ayah, with `locate=false`. Shared suffix tokens keep `currentScore` high so mismatches never reacquire. Live CTC also emits `الله` for `إله`, which did not count as 114:3. Latin unit fixtures hid this because they used `ilahi` (5 letters).

Out: Hafiz Usama 27:15, english-negative, karaoke.

## Files

`src/core/follower.ts`, `tests/follower.test.ts`, `prompts/follow-after-lock.md`, `HANDOFF.md`, `VALIDATION.md`.

## Architecture / security

- After lock, same-surah next is the prior. Do not re-search the mushaf on every hop.
- Shared suffix alone must not advance (114:2 `الناس` is not 114:3).
- Cross-surah jump still needs unique leftover; keep showing the current surah until that confirms.
- Predictions are not translations or history. Offline, no uploads.

## Acceptance

- Live Arabic 114:2 → 114:3 from a window that starts with `الناس` then `اله` or ASR `الله الناس`.
- Shared `الناس` alone does not advance.
- 1:6 → 1:7 from a window that still has `المستقيم` then `صرط الذين`.
- 112:1 → 112:2 from a window that still has `احد` then `الله الصمد`.
- Missed 114:3, heard 114:4/114:5, still leaves 114:2.
- Typecheck, lint, `npm test`. Mac replay honest N/14.

## Checks and device tests

`npm test`, `npm run typecheck`, `npm run lint`. When fixtures exist: `npm run test:replay -- nas fatiha ikhlas jump`. Manual: Nas 114:1–6, Fatiha then Ikhlas — highlight must move with the reciter.
