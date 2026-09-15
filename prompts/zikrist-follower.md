# Own live verse following

## Goal

A reciter should see the ayah they are on, then the next one, including after An-Nas and a start of Al-Fatihah. Tilawa remains the acoustic model and Quran index. It must not own live following.

## Scope

Inspected: `AGENTS.md`, `Zikrist-research.md`, `@tilawa/core` `tracker.ts` / `quran-db.ts`, `src/core/{continuation-gate,sequential,streaming,capture-policy}.ts`, `src/services/listening.ts`, `VALIDATION.md`.

Observed device failure: An-Nas appeared around ayah 4; starting Al-Fatihah left the screen on An-Nas.

Root causes in Tilawa's tracker, not the translation UI:

1. After a lock, tracking transcribes with `locate=false` and only scores the current verse plus mushaf-next.
2. Live discovery then blocks every non-continuation commit unless a silence flush fires (`live non-continuation discovery blocked`). Continuation is same-surah, ayah+1..+3. Al-Fatihah after 114 is never a continuation. `getNextVerse(114, 6)` is undefined; 114 does not wrap to 1.
3. Zikrist does not feed silence, so that flush almost never happens. A 12 s tracking window can keep An-Nas audio in the buffer.
4. Discovery also waits for ~1.5 s × two identical leaders, so a short surah is often first shown on a later unique ayah (114:4). Falaq vs An-Nas share an opening; ayah 4 can be the first honest lock.

Keep: ONNX / `transcribeRaw` / `QuranDB`, bounded capture, Basmala hold, jump evidence for random false commits, sequential *visual* reveal, no predicted history.

Replace: `session.feed()` / `RecitationTracker` as the live state machine.

## Files

`src/core/follower.ts`, `src/core/continuation-gate.ts`, `src/services/{listening,replay,model}.ts`, `scripts/benchmark.ts`, `tests/{follower,continuation-gate}.test.ts`, `prompts/zikrist-follower.md`, `README.md`, `VALIDATION.md`.

## Architecture / security

Acquire on a 1–4 s voiced window with global locate. No repeat-leader requirement. If the champion is a span, pick the ayah that best explains the current transcript (where the reciter is), and refuse a lock while two surahs are still tied.

Follow on a short (~2.5 s) window: word-align the current ayah; score current, previous, and mushaf-next. Advance only with next-ayah evidence, never from coverage or a timer. 114→1 is not mushaf-next; it is reacquire.

Reacquire when the current ayah is complete and there is no next verse, or when the neighborhood stops explaining the audio. Drop old audio so An-Nas cannot dominate Al-Fatihah. A confirmed jump still needs voiced unique words; Basmala still does not name a surah.

Private local capture only. No uploads.

## Acceptance

- First lock may be 114:4 when that is the first unique evidence; it must not require two discovery cycles after that evidence.
- After 114:6, reciting Al-Fatihah 1:2 must leave An-Nas and show 1:2. The last ayah of the mushaf must not freeze following.
- Expected next ayah stays the fast path. A random jump still needs later voiced progress.
- Completing an ayah does not emit an unheard successor.
- Typecheck, lint, tests. No physical-device accuracy claim.

## Checks and device tests

`npm run typecheck`, `npm run lint`, `npm test`. Manual: An-Nas then Al-Fatihah; a sequential short surah; a mid-surah pause. Simulator is not mosque evidence.
