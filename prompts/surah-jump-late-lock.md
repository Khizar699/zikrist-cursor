# Keep jumps off the mushaf-next surah

## Goal

Reciting An-Nas, then Bismillah and Al-Ikhlas, then Al-Fatihah must show those passages. Completing a short surah must not display the mushaf-next surah from coverage or Basmala alone. First lock of An-Nas / Al-Fatihah should be the first unique ayah, not ayah 4–5.

## Scope

Inspected: `AGENTS.md`, `src/core/{follower,continuation-gate,sequential,passage,basmala}.ts`, `src/services/listening.ts`, `tests/{follower,continuation-gate,sequential-display,passage}.test.ts`, Tilawa `getNextVerse` (next surah, not 114→1).

Device report: An-Nas appeared around ayah 3–4, then tracked. After An-Nas, Bismillah and all of Ikhlas; at the last verse the screen showed Basmala with Al-Falaq at 10% opacity. Al-Fatihah appeared around ayah 4–5.

Root causes:

1. Shared Basmala is Al-Fatihah 1:1. After 114:6 reacquire, that lock puts the follower on 1:1 while the gate hides it. Ikhlas is then followed as a failed Fatiha continuation.
2. `canLock` / jump `openingScore` score the whole window against a short ayah opening, so unique 2-word ayahs (114:2–3, 1:2) fail until a longer later ayah is in the window. `ambiguousSurah` also blocks before `currentAyah` can pick that unique ayah.
3. Completing 112:4 is mushaf-next 113:1. Coverage visual-advance and the passage window show Basmala + Falaq (including at 10% opacity) without Falaq audio. The gate accepts 113:1 as expected next and skips the Basmala hold.
4. Neighborhood-mismatch reacquire used to wipe the window that already contains the new surah, so Al-Fatihah was located from ayah 4–5. Mushaf-next Al-Falaq also scores ~0.64 against Al-Fatihah 1:2 (`rabbi` / `birabbi`), which kept the neighborhood alive and blocked the jump.

Keep: acquire / follow / reacquire, same-surah sequential reveal, Basmala hold for a first ayah, jump evidence, no predicted history, no Tilawa streaming tracker.

## Files

`src/core/{follower,continuation-gate,sequential,passage}.ts`, `tests/{follower,continuation-gate,sequential-display,passage}.test.ts`, `prompts/surah-jump-late-lock.md`, `README.md`, `VALIDATION.md`.

## Architecture / security

- Never lock Al-Fatihah 1:1 from Basmala. Stay in acquire until 1:2 or another surah’s unique body.
- Lock a short unique ayah when it appears in the window and its opening is heard. Do not require the whole window to equal that short opening. If a later ayah in a span uniquely beats a rival surah, lock it even when 114:1 vs 113:1 stay close.
- Do not visually reveal or passage-list the next surah from last-ayah coverage. Same-surah next ayah may still move focus. Cross-surah 113:1 still needs unique words after Basmala; the gate must not treat that as a fast-path continuation.
- After a neighborhood failure, reacquire on the current window and reuse that transcript. Only wipe audio after the last mushaf ayah (114:6) so An-Nas cannot dominate the next recitation. Mushaf-next only counts toward the neighborhood after its opening is heard, so Al-Falaq cannot hold the lock against Al-Fatihah.
- Private local capture only.

## Acceptance

- Basmala after 114:6 does not lock 1:1; Basmala then Ikhlas locks 112:1.
- Mixed 114:2–3 with a close Falaq rival locks An-Nas, not a later unrelated ayah.
- Completing 112:4 does not focus or list 113:1 from coverage or Basmala-only audio.
- 112:4 → 113:1 still waits for post-Basmala words in the gate.
- Failed neighborhood then Al-Fatihah 1:2 locates from the kept window.
- Typecheck, lint, tests. No physical-device accuracy claim.

## Checks and device tests

`npm run typecheck`, `npm run lint`, `npm test`. Manual: An-Nas; Bismillah + Ikhlas (not Falaq); Al-Fatihah from Alhamdulillah; sequential Ikhlas → Falaq with unique Falaq words. Simulator is not mosque evidence.
