# Recover Fatiha lock and Falaq jumps

## Goal

Reciting Al-Fatihah from Alhamdulillah should lock near 1:2, not 1:4. The focused translation must not move to an unheard ayah. After 1:7, Al-Falaq must be able to take over; the screen must not stay on the last Fatiha ayah until An-Nas 4.

## Scope

Inspected: `AGENTS.md`, `src/core/{follower,continuation-gate,sequential,basmala,passage}.ts`, `src/services/listening.ts`, `tests/{follower,sequential-display}.test.ts`, live `quran.data` phoneme words, Tilawa `getNextVerse(1,7) → 2:1`.

Device report: Al-Fatihah located at ayah 4; some later ayahs appeared before they were recited and some on time; Al-Falaq was not recognized and the screen stayed on 1:7; An-Nas locked at ayah 4 and then tracked.

Root causes:

1. `currentAyah` prefers a later span ayah (+0.03), so a 4 s acquire window of 1:2–1:4 locks 1:4. 1:3 is only the Basmala tail, so it is not a safe first lock and delays 1:2.
2. Coverage visual-advance moves focus to the next same-surah ayah at 82% without that ayah’s words. Short Fatiha ayahs hit that as soon as the current ayah ends.
3. 1:6 `الصرط` fuzzy-matches 1:7 `صرط` (ratio ~0.88). Next-ayah search anywhere in the window can treat the current ayah’s last words as the successor.
4. After 1:7, mushaf-next is 2:1 (Basmala + الم). Bismillah before Falaq counts as `heardOpening` of 2:1, keeps neighborhood ≥ 0.5, and blocks locate/jump. 113:1 vs 114:1 stay tied (`ayah <= 1`), and later unique Falaq ayahs are never scanned.

Keep: acquire / follow / reacquire, same-surah sequential commit from unique next words, Basmala hold, jump evidence, no predicted history, no Tilawa streaming tracker.

## Files

`src/core/{follower,basmala,sequential}.ts`, `src/services/listening.ts`, `tests/{follower,sequential-display}.test.ts`, `prompts/fatiha-falaq-jump.md`, `README.md`, `VALIDATION.md`.

## Architecture / security

- First lock: skip 1:1 and 1:3; prefer the earliest span ayah whose opening is in the window when no close rival exists.
- Close 113/114 (or other close different-surah) rivals: scan a few later ayahs in both surahs and lock the one whose opening is heard and which uniquely beats the other.
- Neighborhood and advance at a surah boundary need unique post-Basmala words of mushaf-next, not Basmala. Locate while the last ayah of a surah is complete. Look for the next ayah after the current ayah’s spoken words.
- Do not move focused translation from coverage. Private local capture only.

## Acceptance

- A 1:1–4 span whose transcript starts at 1:2 locks 1:2, not 1:4.
- Completing 1:6 does not commit 1:7 from 1:6 audio; unique 1:7 words still advance.
- Completing 1:7 then Basmala does not commit 2:1; unique Falaq words (113:2) take over even when 114:1 is a close rival.
- Coverage does not reveal the next ayah. Typecheck, lint, tests. No physical-device accuracy claim.

## Checks and device tests

`npm run typecheck`, `npm run lint`, `npm test`. Manual: Al-Fatihah from Alhamdulillah; then Al-Falaq; then An-Nas. Simulator is not mosque evidence.
