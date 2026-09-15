# After a finished short surah, first-lock the next surah’s ayah 1

## Goal

`npm run test:replay -- jump` (Kawthar then Ikhlas concat) must confirm **108:1–3** then **112:1–4** in order. After Kawthar, Ikhlas must first-lock **112:1** and follow **112:2–4**. Do not jump into mid-surah **112:4**.

## Baseline

- Start from latest `main` (`eacf963` or newer).
- FAIL `jump`: `sequence_break_at_3_got_112:4_expected_112:1` (Kawthar locks, then Ikhlas starts at 112:4).
- Standalone `kawthar` and `ikhlas` must stay green.
- Do not undo the Basmala-echo guard (one-word ayah-1 that is only الرحمن must not lock 55:1).

## HOLD (Mac Sim QA vs Linux leftover path)

PR #6 leftover-strip + prefer-ayah-1 passed Linux (`112:1@16.75s`) and **failed** Mac Alafasy chunk replay on the same fixtures:

- Locks: `108:1@7.5`, `108:2@8.5`, `108:3@9.5`, then **`112:4@24.75`** (no 112:1–3).
- Standalone `kawthar` / `ikhlas` / `fatiha` / `asr` / `quraysh` / `falaq` PASS on Mac; units 108/108.
- Concat jump is the delta: after 108:3 the live path stays in a **1.2 s follow** window. Standalone Ikhlas locates with a **0.9–4 s acquire** window. Linux ASR of ~1.2 s of 112:1 was enough; Mac ONNX of the same 1.2 s was not, so tracking sat on 108:3 (`هو` neighborhood) until distinctive 112:4.

Do not treat leftover-in-1.2s as sufficient. After the last ayah:

1. Grow the locate window like acquire (up to 4 s), not follow (1.2 s).
2. Do not re-commit / wipe the last ayah (that resets the 4 s buffer during leftover 108:3).
3. Do not count next-surah wait as mismatch reacquire.
4. Hold a later ayah when the new surah’s opening shares only one body token (`قل` → do not first-lock 112:4). Allow 113:2 when the shared opening is two-plus (`قل أعوذ برب`).
5. Basmala-only windows must not pool-lock the next surah.

## Inspected

- `AGENTS.md`, `VALIDATION.md`, `prompts/jump-ikhlas-after-kawthar.md`
- `src/core/follower.ts`: `lockFromNextSurahPool` / `scanPoolOpenings`, `ayahInSpan`, follow jump at `atSurahBoundary`, leftover stripping, `FOLLOW_WINDOW_SEC` vs `ACQUIRE_MAX_SEC`
- `src/core/continuation-gate.ts`: unexpected next-surah is a jump; 112:1 still needs a unique post-Basmala body word
- `src/core/salah-prior.ts`: `remainingAfter(108)` includes 112
- Replay: `scripts/replay.ts` + `scripts/replay-suites.ts` (`jump` = 108:1–3 then 112:1–4)

## Assumptions

- Root cause is post-surah **window policy** (follow 1.2 s vs acquire 4 s), not a need to loosen lock scores or retune Nas 7:1 / Baqarah 2:1.
- Cold-start mid-surah must still lock the recited ayah: only prefer surah-start when the previous surah already finished.
- Falaq after 1:7 may still first-lock 113:2 when 113:1 is not lockable (tied with 114:1). Do not key that on surah length — test corpora often omit later ayahs.

## Files

- `src/core/follower.ts`
- `tests/follower.test.ts`
- `tests/continuation-gate.test.ts`
- `prompts/jump-post-surah-acquire.md`
- `README.md` / `VALIDATION.md` for the observed contract

## Architecture / security

- Offline recognition only. No audio persistence, uploads, or analytics.
- Keep the engine adapter narrow. Do not pull Tilawa streaming tracker into the live path.
- Scores remain similarity scores, not calibrated certainty.
- Do not special-case surah IDs 108/112.

## Acceptance

1. After locking the last ayah of a surah, the next short surah’s opening locks that surah’s first usable ayah (112:1), not a later ayah.
2. A locate champion of 112:4 whose window still contains 112:1 first-locks 112:1 when this is a post-surah acquire. 112:4-only audio does not first-lock.
3. Unique 112:1 body tokens (`هو الله أحد`) without `قل` still lock 112:1 after Kawthar.
4. Existing Falaq-after-Fatiha (113:2 with a close 114:1 rival), Basmala-echo 55:1 rejection, Basmala after Ikhlas not locking Falaq, cold-start later-ayah, Kawthar→112:1 pool, and standalone Ikhlas/Kawthar unit cases still pass.
5. `npm test`, `npm run typecheck`, `npm run lint` pass.
6. `npm run test:replay -- jump` PASS on the real Alafasy chunk harness; `kawthar ikhlas fatiha` still PASS. Other listed regression suites must not regress.

## Checks / device

- `npm test`, `npm run typecheck`, `npm run lint`
- `npm run test:replay -- jump`
- `npm run test:replay -- kawthar ikhlas fatiha`
- Also run if fixtures/model are available: falaq, asr, quraysh, english-negative, basmala-hold, cold-start-mid, stall-after-lock
- Headless ONNX replay only. Not a phone/mosque measurement. Linux leftover@16.75s is not evidence that Mac 1.2 s follow will lock 112:1.
