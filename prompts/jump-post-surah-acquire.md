# After a finished short surah, first-lock the next surah’s ayah 1

## Goal

`npm run test:replay -- jump` (Kawthar then Ikhlas concat) must confirm **108:1–3** then **112:1–4** in order. After Kawthar, Ikhlas must first-lock **112:1** and follow **112:2–4**. Do not jump into mid-surah **112:4**.

## Baseline

- Start from latest `main` (`eacf963` or newer).
- FAIL `jump`: `sequence_break_at_3_got_112:4_expected_112:1` (Kawthar locks, then Ikhlas starts at 112:4).
- Standalone `kawthar` and `ikhlas` must stay green.
- Do not undo the Basmala-echo guard (one-word ayah-1 that is only الرحمن must not lock 55:1).

## Inspected

- `AGENTS.md`, `VALIDATION.md`, `prompts/jump-ikhlas-after-kawthar.md`
- `src/core/follower.ts`: `lockFromNextSurahPool` / `scanPoolOpenings` (ayah 1 only), `ayahInSpan` (starts at `match.ayah`, `preferEarliest` off when a close rival exists), follow jump at `atSurahBoundary`, leftover stripping only in same-surah `shouldAdvance`
- `src/core/continuation-gate.ts`: unexpected next-surah is a jump; 112:1 still needs a unique post-Basmala body word
- `src/core/salah-prior.ts`: `remainingAfter(108)` includes 112
- `tests/follower.test.ts`: Kawthar → 112:1 from a clean ayah-1 window; Falaq 113:2 after 1:7 with a close Nas rival must still work
- Replay: `scripts/replay.ts` + `scripts/replay-suites.ts` (`jump` = 108:1–3 then 112:1–4)

## Assumptions

- Root cause is post-surah acquisition, not a need to loosen lock scores.
- After the last ayah, the 1.2 s follow window still holds leftover current-ayah audio; mixed-window `locationScore` can veto 112:1 (`قل هو…`) while a later unique ayah (112:4) is easy to jump-lock.
- Neighborhood mismatch then reacquires up to 4 s. That window can contain several Ikhlas ayahs. With a close `قل` rival, `ayahInSpan` is not prefer-earliest and starts at the engine champion (often 112:4).
- Cold-start mid-surah (Nas 114:4, Baqarah 2:2) must still lock the recited ayah: only prefer surah-start when the previous surah already finished.
- Falaq after 1:7 may still first-lock 113:2 when 113:1 is not lockable (tied with 114:1).

## Files

- `src/core/follower.ts`
- `tests/follower.test.ts`
- `prompts/jump-post-surah-acquire.md`
- `README.md` / `VALIDATION.md` only if the observed replay/unit contract changes

## Architecture / security

- Offline recognition only. No audio persistence, uploads, or analytics.
- Keep the engine adapter narrow. Do not pull Tilawa streaming tracker into the live path.
- Scores remain similarity scores, not calibrated certainty.
- Do not special-case surah IDs 108/112.

## Acceptance

1. After locking the last ayah of a surah, leftover current-ayah tokens plus the next short surah’s opening lock that surah’s first usable ayah (112:1), not a later ayah.
2. A locate champion of 112:4 whose window still contains 112:1 first-locks 112:1 when this is a post-surah acquire.
3. Existing Falaq-after-Fatiha (113:2 with a close 114:1 rival), Basmala-echo 55:1 rejection, cold-start later-ayah, Kawthar→112:1 pool, and standalone Ikhlas/Kawthar unit cases still pass.
4. `npm test`, `npm run typecheck`, `npm run lint` pass.
5. `npm run test:replay -- jump` PASS; `kawthar ikhlas fatiha` still PASS. Other listed regression suites must not regress.

## Checks / device

- `npm test`, `npm run typecheck`, `npm run lint`
- `npm run test:replay -- jump`
- `npm run test:replay -- kawthar ikhlas fatiha`
- Also run if fixtures/model are available: falaq, asr, quraysh, english-negative, basmala-hold, cold-start-mid, stall-after-lock
- Headless ONNX replay only. Not a phone/mosque measurement.
