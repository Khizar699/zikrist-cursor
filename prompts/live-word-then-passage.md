# Live words, then the rest of the surah

## Goal

While the imam is still being located, show the Quran Arabic words that have actually been heard, as they arrive. Do not name a surah or show a translation yet. Once unique evidence confirms the ayah, snap to that full verse plus its approved translation, and already list the next ayahs of that same surah in line (dim, not focused).

This is the ChatGPT-style “words appear as I speak” feel, adapted to a Quran matcher: only canonical words, never a guessed ayah.

## Scope

Inspected: founder request (live `الحمد لله` then `رب العالمين`, then populate Fatiha), `AGENTS.md`, `prompts/word-pair-until-confirm.md`, `prompts/passage-follow-scroll.md`, `src/core/{follower,passage,salah-liturgy-display}.ts`, `src/ui/SyncedVersePanes.tsx`, `src/App.tsx`.

Already shipped: `heard_words` during acquire; after lock, a 1-ayah neighborhood at 10% opacity.

Gap: after lock the rest of a short surah never appears, and neighbors are almost invisible, so the screen still feels like a single verse swap.

Out: karaoke word highlight inside a locked ayah, dumping all of Al-Baqarah onto the list, showing unread ayahs as confirmed translations or history, retuning locate/follow.

## Files

`src/core/passage.ts`, `src/ui/SyncedVersePanes.tsx`, `tests/{passage,follower,salah-liturgy-display}.test.ts`, `README.md`, `VALIDATION.md`, `HANDOFF.md`.

## Architecture / security

- `heard_words` remains a display prefix only. Predictions are not translations or history.
- Translation appears with the confirmed ayah, not word-by-word.
- After lock, on-screen rows are previous (1) + current + same-surah lookahead (capped). The recited surah still lives in the cache; long surahs are not listed in full.
- Neighbors are context at reduced opacity. Focus moves only on an accepted `verse_match`.
- Offline, no uploads. Scores stay similarity scores.

## Acceptance

- Shared `الحمد لله` emits heard Arabic and no `verse_match` / 14:39.
- Unique `رب العالمين` locks 1:2, shows the approved translation, and lists the rest of Al-Fatihah already in the passage (1:3–1:7) when those ayahs are cached.
- A long surah after lock shows at most the capped lookahead, not every remaining ayah.
- Typecheck, lint, tests. No physical-device latency claim.

## Checks and device tests

`npm run typecheck`, `npm run lint`, `npm test`. Manual: speak Al-Fatihah 1:2 and expect growing `الحمد` / `الحمد لله` then the full 1:2 with translation and dim 1:3… on screen.
