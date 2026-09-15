# Stop short-ayah false surah jumps

## Goal

Reciting An-Nas (and other short ayahs) must stay on that passage. A 2-word ayah must not display a long unrelated ayah such as 2:109 while the reciter continues in place.

## Scope

Inspected: `AGENTS.md`, `src/core/{follower,continuation-gate,sequential}.ts`, `src/services/listening.ts`, `src/ui/SyncedVersePanes.tsx`, Tilawa `fragmentScore` / `bestJoint03Match`, live corpus phonemes for 114:1–6 and 2:109.

Device report: while reciting An-Nas, the third ayah replaced the screen with 2:109 (centered, so the visible Arabic/English started at "بعد إيمانكم" / "disbelief after you have believed"). Broader report: some ayahs follow live; others jump to a new surah with no imam change.

Root causes:

1. `explainScore` is `fragmentScore(transcript, verse)`. A 2.5 s window cannot fit in an 8-character ayah (`ملك الناس`, `اله الناس`), so the true neighborhood scores ~0.50. The same window against a 33-word ayah such as 2:109 scores ~0.44. Jump then only needs `neighborhood < 0.65`.
2. Follow runs a global locate every fourth cycle (~1 s) and treats that champion as an equal candidate. Long ayahs absorb mixed/noisy text via substring alignment.
3. `currentAyah` always walks `ayah+4` and prefers a later ayah within 0.02, so a weak surah-2 champion can become 2:109.
4. The continuation gate confirms an unexpected jump on two fuzzy word hits and 500 ms, which a 33-word ayah can satisfy by chance.
5. An-Nas 2 and 3 both end in `الناس`. Greedy left-to-right alignment of a mixed window against ayah 3 matches that shared last word first, so `heardNext` never sees `اله`, the tracker stays on ayah 2, then a noisy global locate can jump.

Keep: acquire / follow / reacquire, Basmala hold, 114→1 as reacquire, sequential visual reveal, no predicted history, no Tilawa streaming tracker.

## Files

`src/core/{follower,continuation-gate}.ts`, `tests/{follower,continuation-gate}.test.ts`, `prompts/short-verse-false-jumps.md`, `README.md`, `VALIDATION.md`.

## Architecture / security

- Score a short ayah as present in the window (`fragmentScore(verse, transcript)` when the verse is not longer than the transcript); score a long ayah as containing a partial recitation. Do not let a long ayah win because it can host a short query as a fuzzy substring.
- After lock, do not globally locate on a timer. Locate only after the neighborhood fails. A jump must hear the opening of the new ayah and beat the neighborhood with opening-aligned score, not raw joint coverage.
- When checking the next ayah, search for its opening in the window. Do not align from the first leftover word of the previous ayah.
- Pick the current ayah only inside the champion span; do not walk four extra ayahs.
- Unexpected jumps still need later voiced progress; long ayahs need more unique opening words than two.
- Private local capture only.

## Acceptance

- Mixed 114:2+3 audio with a high-scoring 2:109 champion does not commit 2:109.
- 114:2 still advances to 114:3 from 114:3’s own words.
- 114:6 then 1:2 still leaves An-Nas.
- A real mid-session jump still confirms after opening-word evidence.
- Two matched words do not confirm a long unrelated ayah.
- Typecheck, lint, tests. No physical-device accuracy claim.

## Checks and device tests

`npm run typecheck`, `npm run lint`, `npm test`. Manual: recite An-Nas through ayah 3 and 4; recite a long ayah in Al-Baqarah; pause mid-surah. Simulator is not mosque evidence.
