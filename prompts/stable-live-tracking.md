# Stable live tracking and passage following

## Goal

A person using the microphone should see the passage stay put and follow recitation. Pauses, the next ayah, and a long surah must not make the screen jump, blank, or lock onto a random verse.

## Scope

Inspected: `AGENTS.md`, `src/services/listening.ts`, `src/core/{streaming,continuation-gate,sequential,passage,audio-queue}.ts`, `src/ui/SyncedVersePanes.tsx`, `src/App.tsx`, Tilawa `tracker.js` (`staleCycleLimit` clamp 12, 0.25 s tracking cycles, silence still transcribed).

Root causes of the broken feel:

1. Silent frames are still inferred. Twelve stale cycles at 0.25 s exit tracking after about 3 s of pause, then leftover audio rediscovers a different verse. The app also hard-resets the session at 4 s, which wipes the continuation prior.
2. After lock, both lists render the whole current and next surah. Al-Baqarah is hundreds of variable-height rows; `scrollToIndex` without layout is unstable.
3. Visual advance at 75% coverage shows the next ayah while the current one is still being recited, especially on short ayahs.
4. Meter/cycle updates re-render the verse lists. A new Listen keeps the previous session’s verse on screen.

Keep: unique first-lock and Basmala hold, jump guard, deferred history, current+next surah cache, no uploads, no predicted non-sequential display.

## Files

`src/core/{capture-policy,sequential,passage,continuation-gate,streaming}.ts`, `src/services/{listening,content}.ts`, `src/ui/SyncedVersePanes.tsx`, `src/App.tsx`, `tests/{capture-policy,passage,sequential-display,continuation-gate}.test.ts`, `README.md`, `VALIDATION.md`.

## Architecture / security

- Do not feed silence into the tracker. Treat a ~10 s pause as a tracker reset (do not join unrelated audio) while keeping the last confirmed verse and the gate’s continuation prior.
- Real capture gaps/backlog still reset the tracker; they must not clear the last accepted location.
- Render only the focused ayah and its immediate neighbors. Full surahs stay in the translation cache.
- Advance the focused row at tracking completion coverage (last word on short ayahs), not 75%. History still waits for `verse_match`.
- Private local capture only.

## Acceptance

- A few seconds of pause does not rediscover a different surah or blank the passage.
- After lock, each pane has at most previous, current, and next ayahs.
- 8/10 words does not take focus; 9/10 or the last word may.
- Starting Listen does not show the previous session’s verse.
- Typecheck, lint, tests. No physical-device accuracy claim.

## Checks and device tests

`npm run typecheck`, `npm run lint`, `npm test`. Manual: pause mid-surah, continue the next ayah, recite a long surah; the lists must not jump to a random passage. Simulator is not mosque evidence.
