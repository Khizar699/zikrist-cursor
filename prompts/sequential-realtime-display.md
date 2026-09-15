# Sequential realtime translation display

## Goal

After the first confident lock, following should feel live: the expected next ayah (and the first ayah of the next surah) is already in memory, and the screen can change as soon as the current ayah is acoustically complete. The app must not sit on a finished verse while the reciter has moved on. Jumps, repeats, and a wrong first lock still recover from fresh audio.

## Scope

Inspected: `AGENTS.md`, `src/services/{listening,content}.ts`, `src/core/{streaming,continuation-gate,display-hold}.ts`, Tilawa tracker (`deferred_confirm`, 0.82 completion, 1.2 s final silence, 4 stale cycles), `Zikrist-research.md`.

Product decision: sequential recitation is the majority path, including continuing into the next surah. A sudden mid-session jump is the edge case. Display may lead history for that sequential next ayah. History still waits for a Tilawa `verse_match`. Predictions of non-sequential locations still must not display or record.

Root causes of the stuck feel:

1. Translation cache held 32 verses and prefetched only the next ayah, so a surah was not ready in RAM.
2. `deferred_confirm` waits for the next ayah's opening words before `verse_match`, so the screen lagged the reciter.
3. ~1.2 s of silence between ayahs flushed tracking (stale pending advance in ~1 s), forcing full rediscovery.

## Files

`src/core/sequential.ts`, `src/core/{streaming,display-hold}.ts`, `src/services/{content,listening}.ts`, `tests/sequential-display.test.ts`, `tests/display-hold.test.ts`, `README.md`, `VALIDATION.md`.

## Architecture / security

- One bulk read of the current surah and the following surah after lock (and after a surah change). Evict other cached surahs. No third-language pack growth.
- Reveal the cached sequential successor when word progress on the *displayed* ayah reaches tracking completion coverage. Do not reveal during ambiguous Basmala or jump checks.
- Keep `nextVerseEmitMode: 'deferred_confirm'` so history is not a prediction. Continue ONNX tracking. Do not advance from a timer or from preloaded text without that coverage evidence.
- Lengthen live silence/stale patience so a normal pause between ayahs does not drop the lock. The 4 s listening silence reset remains the session-level wait.
- Private, local content only. No uploads.

## Acceptance

- First confirmed lock bulk-loads that surah and the next surah. Cache hit for sequential next does not query SQLite again.
- End of 112:4 prepares 113:1. 114 has no following surah.
- Screen may show the sequential next ayah when current coverage is high; history still records only accepted `verse_match` events.
- Unexpected jumps and silence-flush first matches still need voiced progress. Repeating the current ayah can return the held translation.
- Typecheck, lint, and tests. No physical-device latency claim.

## Checks and device tests

`npm run typecheck`, `npm run lint`, `npm test`. Manual: sequential recitation should change translation near the end of each ayah without a “stuck” pause; a jump should still wait for evidence; a pause of a couple of seconds should keep the last verse on screen.
