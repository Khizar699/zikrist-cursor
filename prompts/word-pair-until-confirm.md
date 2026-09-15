# Pair heard words until the ayah is unique

## Goal

A shared opening such as `قُلْ` must not display a full wrong ayah (e.g. 10:16 for recited 112:1). Show the canonical Arabic words that have actually been heard, without a translation or verse claim. When unique evidence confirms the ayah, snap to the full Arabic verse and its approved translation.

## Scope

Inspected: live screenshot of 10:16 after spoken Ikhlas, `AGENTS.md`, `src/core/follower.ts`, `src/core/continuation-gate.ts`, `src/services/listening.ts`, `src/ui/SyncedVersePanes.tsx`, `tests/follower.test.ts`, `tests/continuation-gate.test.ts`.

Root causes:

1. Lock evidence used LOOKAHEAD word alignment, so `قُلْ … ٱللَّهُ` could skip `لَّوْ شَاءَ` and treat 10:16 as uniquely heard.
2. `ContinuationGate` shows the first voiced non-Basmala `verse_match` immediately, so a false champion becomes a full translation.
3. The UI has no unconfirmed word surface; acquire is blank until a full ayah commit.

## Files

`src/core/{follower,continuation-gate,types,timeline}.ts`, `src/services/listening.ts`, `src/ui/SyncedVersePanes.tsx`, `src/App.tsx`, `tests/{follower,continuation-gate,timeline}.test.ts`, `README.md`, `VALIDATION.md`.

## Architecture / security

- Predictions are not translations or history. `heard_words` is a display prefix only.
- Confirm only from a contiguous opening through the first unique body word. Do not skip distinctive words to a later shared `الله`.
- Do not gloss English/Urdu word-by-word; translation appears with the confirmed ayah.
- Offline, no uploads. Scores stay similarity scores.

## Acceptance

- Ikhlas audio whose engine champion is 10:16 does not emit `10:16`; it locks `112:1` once `هو` is heard.
- Shared `قل` emits heard Arabic words and no `verse_match`.
- Confirmed ayah still shows the full verse plus translation.
- Existing Fatiha / Ibrahim / sequential / jump tests keep passing.
- Typecheck, lint, tests. No physical-device accuracy claim.

## Checks and device tests

`npm run typecheck`, `npm run lint`, `npm test`. Manual: say `qul huwa Allahu ahad` and expect growing `قُلْ` / `قُلْ هُوَ` then full 112:1 with translation, never 10:16.
