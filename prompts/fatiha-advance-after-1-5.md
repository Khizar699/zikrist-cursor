# Advance Al-Fatihah after Iyyaka na'budu

## Goal

After a correct 1:2–1:5 follow, reciting 1:6–1:7 must move the focused translation. Faster first lock must not freeze Al-Fatihah on 1:5.

## Scope

Inspected: `AGENTS.md`, `src/core/follower.ts`, `tests/follower.test.ts`, live `quran.json` phoneme words, `prompts/faster-recognition-with-salah-prior.md`, `prompts/fatiha-advance-after-1-2.md`.

Device report: locating is now quicker, but a start at Alhamdulillah followed through 1:5 (`إياك نعبد وإياك نستعين`) and stayed there. Earlier, a slower first lock still felt like it followed at the right speed (coverage preview, now disabled).

Root cause: follow is a 1.2 s window every 0.4 s. 1:5 is the first Al-Fatihah ayah long enough that the overlapping window still contains its tail when 1:6 begins. `shouldAdvance` already hears unique leftover `اهدنا`, then refuses because `explainScore` of the mixed window still ranks 1:5 above 1:6 (`NEXT_SCORE` / `NEXT_MARGIN`). Neighborhood stays ≥ 0.5, so mismatches never reacquire. 1:3 and 1:4 are short enough that the next ayah often fills the same window; 1:6 often does not.

Keep: 1:2 first lock, no coverage preview, 1:6 must not commit 1:7 from shared sirat, Basmala hold, no predicted history. Do not restore a 2.5 s window.

## Files

`src/core/follower.ts`, `tests/follower.test.ts`, `prompts/fatiha-advance-after-1-5.md`, `README.md`, `VALIDATION.md`.

## Architecture / security

- Sequential next may be committed from its own unique opening in the leftover after the current ayah. Overlapping current-ayah audio in the follow window must not veto that evidence.
- Skip only a real suffix/prefix overlap (sirat), not a mixed-window score comparison.
- Predictions, coverage, and elapsed time still must not become the focused translation.
- Private local capture only.

## Acceptance

- After a 1:5 lock, a window of 1:5 tail + 1:6 opening (`واياك نستعين اهدنا` / romanized equivalent) commits 1:6.
- Live Arabic 1:6 words still advance after a 1:5 lock.
- Completing 1:6 still does not commit 1:7 from the shared sirat word; unique 1:7 words still advance.
- Typecheck, lint, tests. No physical-device accuracy claim.

## Checks and device tests

`npm run typecheck`, `npm run lint`, `npm test`. Manual: recite Al-Fatihah from Alhamdulillah through 1:7. Simulator is not mosque evidence.
