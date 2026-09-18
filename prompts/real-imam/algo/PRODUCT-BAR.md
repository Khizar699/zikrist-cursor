# Product bar (recognition sessions)

Binding for Prompt Smith / CloudAgent / **local Cursor Agent/Composer on Mac** / Sim QA / Chief Bot. Complements — does **not** replace — Mac `npm run test:replay -- all` = **14/14**.

**Current MVP (Phase 1):** acoustic-to-mushaf alignment — correct Arabic on screen, monotonic follow inside `[current − 1, current + 2]`, ayah-1 surah handoff, madd/pause that must not Global Search. **Phase 2 translation** is a `[surah:ayah]` lookup after Arabic tracking is flawless. See `prompts/mushaf-first-mvp.md`.

## Who runs verify

**Do not leave Mac acoustic verify to the founder’s iOS vibe check.** After any recognition / follower / Tilawa-patch / gate change (or when Tip names an algo clip), the **same agent that edited code** must run the commands below on a Mac with fixtures + ONNX and paste findings into the session reply + `HANDOFF.md` tip.

Founder live iOS preview is optional smoke only. It is **not** a substitute for headless replay.

## Dual bar

| Bar | Role | Pass means |
|---|---|---|
| **Regression floor** | `npm run test:replay -- all` = **14/14** Quran | Do not merge if this regresses. Linux ONNX is not this gate. |
| **Product bar** | Session Mac verify on the Tip-named clip/concern | Prove the user-facing failure mode for that session: **correct lock + ordered advance + matching Arabic mushaf**. **14/14 alone is not done.** |

Famous short-surah EveryAyah suites (Fatiha / Ikhlas / Nas / …) are a **don't-regress** corpus. They are **not** evidence that live listening follows verses or that all surahs cold-start equally.

Stratified mushaf coverage (Tier A sample, honest M/N) is documented in [COVERAGE.md](./COVERAGE.md) (`npm run test:coverage`). Coverage is a **scoreboard**, not a substitute for floor 14/14 or the Tip product-bar clip.

## Agent verify loop (run after every recognition patch)

Prereqs once per machine: `npm i` → `npm run fixtures:recitation` → `npm run fixtures:imam` (ffmpeg on `PATH`).

```bash
npm test
npm run typecheck
npm run test:replay -- all
# Tip / product-bar clip (example = current P0):
npx tsx scripts/replay.ts \
  artifacts/recitation/imam/imam-multi-qari/qari-a/imam-multi-qari__hafiz-usama__001-027-015__raw.wav
# When ready suites matter for the change:
npm run test:replay -- imam-mid-surah-cold
npm run test:replay -- imam-mid-surah-cold-qiyam
```

**Report in the chat + tip (honest):**

1. Commands run and pass/fail (or blocked: missing fixture / no ONNX / not Mac).
2. **First correct lock** — ayah + approximate audio seconds (or honest miss).
3. **Ordered advance** — committed match sequence while audio continues (not only `phase: following`).
4. **Displayed mushaf** — those commits are the recited Arabic ayahs, not a prediction and not a translation.
5. **Stall / failureMode** if any.
6. **Clip class** — `famous-short` | `mid-surah` | `fatiha-to-body` | `non-famous-cold` | `long-imam`.
7. What was **not** tested (e.g. physical mic, locked screen).

If the Tip concern is follow/handoff and the clip still stalls on the first ayah, the session is **failed** even if `all` is 14/14.

## What “done” requires (algo / follower sessions)

Report all of the following in the PR + `HANDOFF.md` tip (honest; no invented labels or Mac claims):

1. **First correct lock** — ayah + approximate audio seconds (or honest miss).
2. **Ordered advance** while voiced audio continues — committed `verse_match` sequence, not merely `phase: following` or word_progress on the first ayah.
3. **Correct Arabic mushaf** for those commits (canonical display text). Translation is not this bar.
4. **Stall point** if any — e.g. `stall_missing_…`, stuck at **1:2**, wrong body surah.
5. **Clip class** — one of: `famous-short` | `mid-surah` | `fatiha-to-body` | `non-famous-cold` | `long-imam`.

**Fail the session** (do not claim product-green) if:

- Only first-lock improved and the next ayah never commits while audio continues, or
- Only unit tests / 14/14 moved and the Tip clip was not Mac-measured, or
- Acquire was tightened with no follow/handoff evidence when the Tip concern was follow/handoff.

## Engine split (do not conflate)

| Layer | Owns | Typical files |
|---|---|---|
| **Tilawa locate** | Transcription + Quran index / champion for cold acquire speed | `@tilawa/core` patches, locate path |
| **Zikrist follow** | After lock: neighborhood, advance, reacquire, ContinuationGate display commits | `src/core/follower.ts`, `continuation-gate.ts`, related gates |

- Locate patches may make famous surahs feel fast. They do **not** prove verse-following.
- Follow/handoff sessions may change follower/gate; do not default to “prefer acquire-only forever.”
- One session = **one concern**: either acquire/false-first-lock **or** follow/handoff/advance — named in Tip. No mega-prompt.

## Priority themes (product order)

1. **Follow / handoff** — stuck on first ayah; Fatiha→body (e.g. Hafiz Usama → **27:15**); last ayah → **ayah 1** of a salah-prior surah (never mid-surah phantoms).
2. **Advance under overlap + madd** — do not park on 1:2 / 1:5 while the next ayah is spoken; CTC letter runs and breath pauses must not drop to Global Search.
3. **Neighborhood pacing** — after lock, score `[current − 1, current + 2]` only; match-to-display p95 < 50 ms is an evaluation target, not a claimed first-lock.
4. **Coverage** — cold start outside last-20 / salah-prior “famous” bias.
5. **False first-lock polish** — wrong champion on thin windows (after follow P0s).

Do **not** insert translation-pane, language-pack, SQLite translation, or network work into this order.

Queue: `00-QUEUE.md`. Shared session rules: `_SHARED.md`. **Daily ratchet (fix → lock → never re-break):** `RATCHET.md`.

## Merge policy (Chief Bot)

- **Must:** Mac `all` **14/14** when claiming floor-green (or honest N/14 if red — do not invent 14/14).
- **Must for algo claim:** product-bar items above for the Tip clip.
- **Must for “solved”:** same-PR lock per `RATCHET.md` (unit and/or ready expect). No lock ⇒ not solved.
- Short 2–3 ayah Mac-green + label-fill `ready` ≠ “imam-ready” / full prayer follow.
- Never invent ayah labels. Do not commit wav/mp3. No `ready` flip in algo sessions.
