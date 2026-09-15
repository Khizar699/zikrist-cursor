# Advance Al-Fatihah after Alhamdulillah

## Goal

After a correct 1:2 lock, reciting 1:3–1:7 must move the focused translation. Alhamdulillah must not freeze the passage for the rest of Al-Fatihah.

## Scope

Inspected: `AGENTS.md`, `src/core/{follower,basmala,continuation-gate,sequential}.ts`, `tests/follower.test.ts`, live `quran.json` phoneme words.

Device report: Al-Fatihah locked from Alhamdulillah quickly, then stayed on that first displayed ayah.

Root causes:

1. Live 1:3 `الرحمن` fuzzy-matches 1:2 `الحمد` at ~0.82. Follow then treats 1:3 as the current ayah opening and searches only the leftover `الرحيم`, which is not enough unique evidence.
2. `uniqueWordSkip` lets any of the last three current words fuzzy-match the next opening. 1:2 `العلمين` vs 1:3 `الرحمن` is ~0.77, so 1:3 is treated as overlapping tail.
3. While locked on 1:2, previous is 1:1. 1:3 is an exact substring of the Basmala, so neighborhood score stays ~1.0, mismatches never fire, and the tracker never reacquires.

Keep: 1:2 first lock (skip 1:1 and 1:3), no coverage preview, 1:6 must not commit 1:7 from shared sirat, Basmala hold, no predicted history.

## Files

`src/core/follower.ts`, `tests/follower.test.ts`, `prompts/fatiha-advance-after-1-2.md`, `README.md`, `VALIDATION.md`.

## Architecture / security

- Sequential next may be committed from its own opening in the follow window. Do not slice away those words because they fuzzy-match the current ayah.
- Skip only a real suffix/prefix overlap between the end of the current ayah and the start of the next (sirat), not any 0.7 hit among the last three words.
- Basmala 1:1 must not keep the 1:2 neighborhood while 1:3 is being recited.
- Private local capture only.

## Acceptance

- After 1:2, a window of only 1:3 commits 1:3. Mixed 1:2+1:3 also commits 1:3.
- Live Arabic 1:3 words (`الرحمن الرحيم`) still advance; they must not stay aligned to `الحمد`.
- Completing 1:6 still does not commit 1:7 from the shared sirat word; unique 1:7 words still advance.
- Typecheck, lint, tests. No physical-device accuracy claim.

## Checks and device tests

`npm run typecheck`, `npm run lint`, `npm test`. Manual: recite Al-Fatihah from Alhamdulillah through 1:7. Simulator is not mosque evidence.
