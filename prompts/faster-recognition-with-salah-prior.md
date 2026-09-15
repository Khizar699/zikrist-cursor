# Faster recognition with a salah prior

## Goal

Cut time-to-correct-verse and sustained follow cost on mid-range phones, without locking from a guess. Keep one global retrieve. Rank with an editable salah prior. After a surah finishes, try a small next-surah pool before a full-Quran locate. Never display an unconfirmed candidate as translation or history.

## Scope

Inspected: `AGENTS.md`, `Zikrist-research.md`, `VALIDATION.md`, `README.md`, `src/core/{follower,audio-queue,continuation-gate,streaming,capture-policy,sequential}.ts`, `src/services/{listening,model}.ts`, `@tilawa/core` `index.ts` / `quran-db.ts` / `ctc-rescore.ts`, `patches/@tilawa+core+0.1.0.patch`, `tests/{follower,tilawa-patch,continuation-gate}.test.ts`.

This is not a new recognizer and not a mushaf split. Live following stays in `RecitationFollower`. Tilawa stays acoustic decode + Quran index. Do not revive `RecitationTracker` / `session.feed()` for the microphone path.

**What is actually slow (do not invert this):**

1. Non-streaming ONNX re-encodes the whole window every cycle. Follow is a 2.5 s window every 0.25 s of speech (~10× audio encoded per second). Acquire can grow to 4 s. This dominates heat, queue lag, then *slower* search. Desktop median ONNX was ~85 ms on Apple Silicon with ~667 MB RSS; that is not a phone number.
2. Evidence delay on shared openings (Basmala; ~47% of verses share the first two words). More search cannot invent a unique location.
3. Locate CPU on the JS thread: up to 950 Levenshtein scores, span 2–6 on the top 32 surahs, then prefix/global-span rescue on long queries. If n-gram overlap is thin (`scored.length < 80`) or the query is under 4 compact characters, `_jointCandidateVerses` falls back to **all 6,236 verses**.
4. Duplicate locate: `createTilawaSession` runs `bestJoint03Match` then drops it unless score ≥ 0.8 (`CHAMPION_TRUST_THRESHOLD`). The follower lock bar is 0.62, so scores in 0.62–0.79 pay for the search twice.
5. Display/SQLite is not the first-lock problem; neighborhood text is already preloaded after a confirm.

**Salah prior (ranking, not exclusive zones):**

Typical mosque use after Al-Fatihah is a short surah. After Kawthar (108), the next recitation is often a *later remaining* short surah, not Al-Baqarah. Cold-start and lost-lock ranking:

1. Al-Fatihah (every rak‘ah; missing from the original list; must be first).
2. Last 10 surahs (105–114).
3. After a confirmed surah S, remaining surahs **after S** in that short-surah band, then the rest of that band (repeats of S stay allowed).
4. Last 20 (95–114).
5. Famous list (data, not identity): Rahman 55, Yasin 36, Yusuf 12, An-Nisa 4. Editable later.
6. Juz 30 / Juz Amma (78–114). Nested in 2/4; do not search it as a fifth exclusive pass.
7. Rest of the Quran.

After 1:7, Bismillah must not keep 2:1 as the neighborhood. Unique post-Basmala words of the heard surah are still required.

**Out of scope (do not implement in this pass):**

- Five exclusive corpus shards or unloading Juz 1–29 from RAM. The packed index + ONNX dominate memory; overlapping slices will not fix the ~667 MB-class RSS.
- Sequential last-10 → last-20 → famous → Juz 30 → rest *instead of* one retrieve. That makes Yasin/Baqarah slower and invites false last-10 locks.
- Vector/embedding search, remote ASR, LLM location, “pick the surah” UI, prayer-type picker during salah.
- Core ML / NNAPI / XNNPACK / a streaming encoder. CPU-only ONNX stays until a *phone* trace exists. Leave a one-line note in VALIDATION that EPs are unmeasured.
- PostHog or any remote timing. Local diagnostics only; no raw audio, full transcripts, tokens, or verse identifiers in telemetry.
- Changing translation packs, history persistence, or the listen UI except honest searching/following/waiting already on `ListeningState.phase`.

## Assumptions

- Hafs ‘an ‘Asim, current follower lock/jump/Basmala rules, and continuation-gate jump evidence stay the source of truth. A prior may only break ties.
- Scores remain similarity scores, not calibrated probabilities. Do not show them as percent certainty.
- Predictions, coverage, and elapsed time still must not become the focused translation or history.
- Phone/mosque latency is unmeasured. This pass must not claim production speed or accuracy.
- Existing user authorization to implement is sufficient; do not wait for a second approval after this prompt.

## Implementation order (required)

Do these in order. Later steps assume earlier ones. Do not start with the prior file.

### 1. Local clocks (no product claims)

Add a narrow in-memory timing record on each processed packet, testable without a phone:

- window seconds, ONNX ms, CTC-decode ms, locate ms (0 when `locate=false`), queue wait ms, follower phase.
- Optional JS-thread stall hint if cheap (time from queue pop to process start).

Do not log transcripts or audio. Do not surface timings in the default UI. A debug-only dump is acceptable if it is off by default. Update VALIDATION that these clocks exist and that physical-device values are still missing.

### 2. Cut follow overlap (highest leverage)

In `RecitationFollower`, shrink the **follow** window and slow the hop so overlap is about 2–3×, not 10×. Starting point, tune only if tests require it:

- Follow window ~1.0–1.2 s (today `FOLLOW_WINDOW_SEC = 2.5`).
- Follow trigger ~0.35–0.5 s (today `FOLLOW_TRIGGER_SEC = 0.25`).
- Keep-after-commit may shrink with the window; do not keep 2.5 s of previous ayah after a commit.

Acquire stays ~0.9–4 s until a unique lock. If the queue is behind **while acquiring**, keep the latest tail (already `keepLast`); do not merge unrelated packets across a discontinuity. While **following**, do not skip-to-latest in a way that drops the current ayah’s opening.

Do not raise inference rate to “feel faster.” Backlog and heat get worse.

Retest short-ayah vs long-ayah (`explainScore` direction), Fatiha 1:2 vs 1:4, 1:7 → Falaq, An-Nas → Fatiha. A shorter window must not revive 2:109 stealing An-Nas, and must not starve word-progress on a long ayah so badly that following never advances. If a long ayah cannot complete in 1.2 s of audio, still advance from unique next-ayah openings in the window; do not restore 2.5 s solely for comfort.

### 3. One locate per window; cap short queries

- When `transcribe(..., true)` already ran `bestJoint03Match`, the follower must **not** call it again on the same text. Return the champion even below 0.8; Zikrist applies `LOCK_SCORE` / `LOCK_CLEAR_SCORE`. Prefer a small Tilawa patch or a wrapper that exposes the untrusted champion. Keep `tests/tilawa-patch.test.ts` (or an equivalent) proving the shortlist is unchanged and that a 0.62–0.79 score is not searched twice.
- `locate=true` only in acquire, neighborhood-fail reacquire, and surah-complete next-surah handling. Never on a follow timer.
- Short/noisy queries must not explode to 6,236 verses. Cap the candidate list (keep the existing ~950 ceiling as a max, not a fallback-to-all). If n-gram overlap is thin, score a **bounded** set (prior tiers + any already-known lock/rival) or wait for more audio. Patch `_jointCandidateVerses` if that is the only way to stop `scored.length < 80 → this.verses`.
- Skip prefix/global-span rescue unless the compact query is already in the ranges those paths require (today 34 / 80 compact characters). Do not force them on last-10 openings.
- Build prefix/global span tables during model load, not on the first long locate.

### 4. Neighborhood path after lock (no Quran search)

Keep `locate=false` while current / previous / next still explain the window.

Optional if it stays behind the follower adapter and does not import `RecitationTracker`: rescore **only** current, previous, and next with existing `scoreCtcCandidates` / verse CTC ids when `acoustic` is already on `TranscribeResult`. Skip a verse whose token sequence cannot fit the window (`minFramesRequired`). If wiring this pulls in the old tracker or doubles JS cost on long ayahs, ship without it and note that in VALIDATION.

### 5. Editable prior + next-surah pool

Add a versioned data file (JSON imported by the app, not hardcoded if-ladders), for example `assets/recognition/salah-prior.json` + `src/core/salah-prior.ts`:

- tiers and surah numbers as above; famous list is data.
- small numeric bonuses (on the order of 0.02–0.05, below `SURAH_MARGIN` 0.08) used only as **tie-break** when acoustic scores are within the existing rival margin.
- `remainingAfter(surah)` → later surahs in last 10, then last 20, then Juz 30, plus always Al-Fatihah.

**Cold acquire / lost lock:** one `bestJoint03Match` (or equivalent). Rerank champion + runners-up with the prior. Do not lock because the prior is high. `canLock` / opening evidence / ambiguous-surah rules stay mandatory.

**Surah complete:** before global locate, score a bounded pool: Al-Fatihah + remaining later short surahs after the surah just finished + (if still unexplained) last 20 / famous openings. Use opening-aligned evidence, not Basmala. If the pool cannot explain the audio, then global locate + prior rerank. Completing An-Nas still treats Al-Fatihah as reacquire, not mushaf-next. Repeating the same short surah must still lock.

**Wrong lock:** neighborhood fail still reacquires; a prior that was wrong must lose as soon as the audio stops matching.

## Files

Expect to touch:

- `src/core/follower.ts` — window/hop, single locate, next-surah pool, prior rerank at lock time.
- `src/core/salah-prior.ts` (new) + `assets/recognition/salah-prior.json` (or equivalent) — data + `remainingAfter` / tier bonus.
- `src/core/audio-queue.ts` — only if acquire backlog needs an explicit tail policy; do not relax serialization or `maxSamples`.
- `src/services/model.ts` / Tilawa adapter — return untrusted champion; optional span-table warmup; optional neighborhood CTC.
- `patches/@tilawa+core+0.1.0.patch` — only for champion-below-0.8, `_jointCandidateVerses` fallback, or span warmup. Keep the packed n-gram path. Extend `tests/tilawa-patch.test.ts`.
- `src/services/listening.ts` — optional local timings; do not notify React more often.
- `tests/follower.test.ts`, `tests/salah-prior.test.ts` (new), existing Fatiha/Falaq/Nas/jump tests.
- `README.md`, `VALIDATION.md`, this prompt.

Keep `continuation-gate.ts` jump/Basmala holds unless a test proves a prior-induced false confirm.

## Architecture / security

- Distinguish acquire (broad retrieve + prior rerank) from follow (local neighborhood) from reacquire (pool, then global).
- Preserve multiple candidates when two surahs are tied; refuse an exact ayah until evidence exists.
- Do not advance from elapsed time, inferred pace, or preloaded text.
- Serialized, bounded inference only. No overlapping mutation of the same session. No heavy work in the audio callback or in render.
- Private local capture. No uploads. No new network during listening.
- MIT patch terms unchanged; do not treat search-index changes as a content-license change.

## Acceptance

**Overlap and locate**

- Follow overlap is ≤ ~3× (window / hop) with the constants recorded in README/VALIDATION.
- A window that already ran locate does not call `bestJoint03Match` again.
- A compact query shorter than 4 characters, or a thin n-gram hit, does not score all 6,236 verses.

**Prior is ranking**

- A last-10 prior cannot commit a last-10 surah when a clearly better acoustic match exists elsewhere (margin ≥ `SURAH_MARGIN`).
- Cold Al-Ikhlas still locks from unique words after Bismillah, not from Basmala.
- After confirmed 108 (Kawthar) last ayah, 109–114 and 1 are tried before 2:1; Bismillah alone still does not lock Al-Baqarah.
- After 108, reciting 112 (Ikhlas) or repeating 108 still works; reciting 36:1 (Yasin) still falls through to global locate and can lock.
- After 114:6, 1:2 still leaves An-Nas.

**Regressions that must stay green**

- Al-Fatihah locks from 1:2, not 1:3 or 1:4 already in the window.
- Completing 1:7 then unique Falaq words can replace 1:7; 113 vs 114 stay unresolved until distinguishing words.
- Mixed An-Nas 2–3 audio does not commit 2:109.
- Coverage still does not reveal the next ayah. Unexpected jumps still need later voiced unique openings.
- Honest phase: searching while acquiring/ambiguous, following after confirm, waiting on a long pause.

**Product claims**

- No physical-device speed, RAM, battery, or accuracy claim.
- Source notices unchanged.

## Checks and device tests

`npm run typecheck`, `npm run lint`, `npm test`. If the Tilawa patch changes, `npm run assets:verify` is not a substitute for `tests/tilawa-patch.test.ts`; still run `npm test`.

Manual (simulator or replay is not mosque evidence): Al-Fatihah then Kawthar then Ikhlas; Fatiha then Falaq then Nas then Fatiha; a long unique ayah (e.g. Yasin or Baqarah) from a cold start; a mid-surah pause; silence / English speech must not confirm a verse.

If a physical phone is available, record ONNX ms vs window length, locate ms, queue delay, peak RSS, and temperature over several minutes — as observations, not guarantees. If it is not available, say so.

## Done when

The five implementation steps above are in the tree or explicitly waived in VALIDATION with a reason (for example CTC neighborhood rescore skipped because it required the old tracker). README describes the follow window/hop and that the prior is a tie-break file, not a limited Quran. Existing follower regression tests pass, plus new tests for duplicate-locate, candidate cap, remaining-after-Kawthar, and prior-cannot-override-a-clear-acoustic-winner.
