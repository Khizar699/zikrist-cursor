# Passage follow scroll

## Goal

After the first confident lock, Arabic and translation should already contain the surrounding passage. The focused ayah is full opacity; previous and next ayahs stay on screen at 10% opacity. When the focused ayah is about 75–82% recited, both panes scroll so the next ayah (and its translation) become the visible focus. The screen must not wait to load and swap a single verse after each microphone match.

## Scope

Inspected: `AGENTS.md`, `src/ui/SyncedVersePanes.tsx`, `src/App.tsx`, `src/services/{listening,content}.ts`, `src/core/{sequential,streaming,display-hold,types}.ts`, `prompts/sequential-realtime-display.md`.

In: dual independent verse lists, neighborhood already in memory as the scroll source, visual advance at 75% word coverage, translation pane scrolls to the same ayah, hold/history policy.

Out: word-level karaoke highlighting, claiming unconfirmed jumps, writing history from coverage, loading the whole Quran into the lists, physical-device latency claims.

## Assumptions

- First location still needs unique recitation. A passage cannot be shown before the surah is known.
- The recitation unit is an ayah row, not a wrapped visual line. Long ayahs remain one row.
- Visual advance uses 75% coverage of the focused ayah. Tilawa `trackingCompletionCoverage` stays 0.82 so word-progress still reaches that threshold.
- Neighbors at 10% opacity are context, not confirmed translations. History still waits for `verse_match`.
- Sequential next may take focus from coverage; a late match for the ayah just left must not scroll backwards. A confirmed repeat or jump may move focus.
- Manual scrolling of one pane does not drag the other. Recitation-driven advance recenters both on the same ayah.

## Files

`prompts/passage-follow-scroll.md`, `src/core/{sequential,streaming,display-hold,passage}.ts`, `src/services/{listening,content}.ts`, `src/ui/{SyncedVersePanes,theme}.ts(x)`, `src/App.tsx`, `tests/{sequential-display,display-hold,passage}.test.ts`, `README.md`, `VALIDATION.md`.

## Architecture / security

- Reuse current-plus-next surah preload. Do not query SQLite on the sequential scroll path once cached.
- Do not run inference or SQLite in an audio callback or React render.
- Predictions of non-sequential locations still must not display at full opacity or enter history.
- Private local content only. No uploads.

## Acceptance

- After lock, both panes list the cached neighborhood with the focused ayah at opacity 1 and other ayahs at 0.1.
- At ≥75% word coverage of the focused sequential ayah, both lists scroll to the next ayah if it is cached.
- Translation scroll targets the matching ayah, not a proportional pixel offset of a single block.
- History still records only accepted `verse_match` events.
- Typecheck, lint, and tests. No physical-device claim.

## Checks and device tests

`npm run typecheck`, `npm run lint`, `npm test`. Manual: after first lock, previous/next ayahs are already visible and dim; near the end of an ayah both panes scroll to the next row; a jump still waits for evidence; a pause does not blank the passage.
