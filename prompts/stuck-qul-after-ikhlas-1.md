# Leave a stuck Ikhlas 1 for the next recited short surah

## Goal

Live recitation that locks Al-Ikhlas **112:1** must still follow **112:2–4**, and must jump to another last-10 opening when those unique words are heard (An-Nas **114:1**, Al-Kafirun **109:1**). Do not stay on `قل هو الله أحد` for the rest of the session.

## Scope

Inspected: founder live report (Fatiha then Ikhlas 1 stuck, then Nas / Kafirun still showing 112:1), `AGENTS.md`, `src/core/follower.ts`, `tests/follower.test.ts`.

Root cause: after 112:1 the next-surah pool only arms at second-last (`remainingInSurah <= 1`). Shared `قل` leftover is stripped, locate stays on champion 112:1, and mid-surah cross-surah jump needs 0.92. Unique `الناس` / `الكافرون` / `لم يلد` never commit.

Out: Kawthar→Ikhlas floor `jump` (different last-ayah concat), Hafiz Usama 27:15, english-negative, karaoke, passage lookahead.

## Files

`src/core/follower.ts`, `tests/follower.test.ts`, `prompts/stuck-qul-after-ikhlas-1.md`, `HANDOFF.md`, `VALIDATION.md`.

## Architecture / security

- Predictions are not translations or history. Unique leftover of another short surah may commit; shared `قل` / Basmala alone must not.
- Garbage windows must still refuse 7:1.
- Offline, no uploads.

## Acceptance

- After 112:1, Nas 114:1 unique words commit 114:1 even when the engine champion is still 112:1.
- After 112:1, Kafirun 109:1 unique words commit 109:1 the same way.
- After 112:1, 112:3 still commits if 112:2 was missed.
- 112:1→112:2 still advances from mixed-window leftover. 7:1 garbage jump stays refused.
- Typecheck, lint, `npm test`. Mac replay honest N/14. No physical-device claim.

## Checks and device tests

`npm test`, `npm run typecheck`, `npm run lint`. When fixtures exist: `npm run test:replay -- ikhlas jump fatiha nas`. Manual: Fatiha, then Ikhlas, then Nas or Kafirun — focus must leave 112:1.
