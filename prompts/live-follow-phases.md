# Live follow: locate is search, follow is alignment

## Goal

After the first lock, following must feel like the reciter is moving now: the focused ayah changes as the current one finishes, words highlight while they are heard, and a late confirm must not skip the ayah that was just spoken. Locate may stay Tilawa search. Follow must stop re-identifying whole ayahs from a mixed previous-ayah window.

History stays honest: only accepted `verse_match` is an occurrence. Sequential focus and word highlight are the live layer, not predicted history.

## Scope

Inspected: founder report (locate improved; follow late then skips), `Zikrist-research.md`, `src/core/{follower,audio-queue,sequential,display-hold,continuation-gate,timeline}.ts`, `src/services/listening.ts`, `src/ui/SyncedVersePanes.tsx`, Tilavet / cache-aware FastConformer / karaoke forced-alignment notes.

Phase A landed. **This session implements Phase B** (expected tape). Do not swap the shipping ONNX model. Do not retune Hafiz Usama 27:15 or english-negative in this prompt.

## Phases

### Phase A (this PR) — same model, live feel

1. First lock keeps `KEEP_AFTER_LOCK_SEC` (1.0 s) of the current ayah. Advancing keeps `KEEP_AFTER_COMMIT_SEC` (~0.25 s) so the previous tail does not dominate.
2. Processing backlog drops oldest pending packets and **keeps the lock**. Do not `discontinuity` / reset the follower.
3. Same-surah sequential **focus** when word coverage on the displayed ayah reaches tracking completion. History still waits for `verse_match`. Next-surah and jumps still need unique evidence.
4. Arabic word highlight from `word_progress`. Translation is verse-level (not 1:1).
5. Timeline records same-surah skipped hops (committed N+2 while N+1 never occurred).

### Phase B (this session) — expected tape

Score a token stream against current remainder + mushaf-next (+1), not a 1.2 s blob vs the whole mushaf. Forced-align expected phonemes to the CTC decode when that is cheaper than another fuzzy locate. Generic class tests (shared tail, short next, joined ayahs), not verse-numbered patches. Follow hops transcribe with `locate=false`; leftover distinctive tokens may still token-search.

### Phase C (only if A+B still miss the tracking clock on a phone)

Bakeoff behind `TranscribeFn`. Default stays Tilawa FastConformer until a streaming encoder wins **follow latency + skip rate** on the same clips, with a license that allows a possibly commercial app. See `prompts/model-bakeoff.md`.

## Files

`src/core/{expected-tape,follower,audio-queue,sequential,timeline,word-highlight}.ts`, `src/services/listening.ts`, `src/ui/{SyncedVersePanes,theme}.tsx`, tests listed below, `HANDOFF.md`, `VALIDATION.md`, `prompts/real-imam/algo/00-QUEUE.md`.

## Architecture / security

- Predictions are not history. Sequential preview may move the focused translation.
- Offline. No uploads. Clocks stay local (no verse ids in remote telemetry).
- One serialized inference. Bounded pending audio.

## Acceptance

Phase A (landed): splice 0.25 s, overflow keeps lock, sequential focus, word highlight, timeline skip.

Phase B:
- Shared tail class: remainder empty, only the shared suffix → next is not heard.
- Short next class: distinctive next tokens after complete current → next is heard.
- Joined class: remainder then next opening in one stream → remainder consumed and next heard.
- Follow hops do not pass `locate=true` when the tape explains the window.
- Expected phoneme score is remainder+next vs the CTC decode, not a distant host ayah.
- Typecheck, lint, `npm test`. Mac replay honest N/14. Do not claim 14/14 while english-negative is red.

## Checks and device tests

`npm test`, `npm run typecheck`, `npm run lint`. When fixtures exist: `npm run test:replay -- nas fatiha ikhlas jump all`. Manual: Nas / Fatiha — highlight should move; the next ayah should focus near the end of the current one; a late confirm must not blank the ayah just shown.
