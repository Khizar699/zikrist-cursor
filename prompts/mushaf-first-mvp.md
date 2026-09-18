# Mushaf-first MVP (Phase 1; translation is Phase 2)

## Goal

The **sole Phase 1 product** is rock-solid, low-latency, real-time Arabic mushaf tracking during live salah. As soon as the app hears Quranic Arabic, lock the correct `[surah:ayah]`, paint canonical Arabic, and follow monotonically.

**Phase 2 translation** is a **1-to-1 static lookup** of an approved edition keyed by that `[surah:ayah]` **after** Arabic alignment is flawless. It is not a second recognizer. **Do not spend engineering on translation logic, packs, onboarding, or dual-pane UX until Phase 1 is confident.**

## Scope

In (acoustic-to-mushaf engine):

- Real-time tracking: neighborhood `[current − 1, current + 2]`; monotonic advance; match-to-display p95 < 50 ms is an **evaluation target** after confirmation, not a claimed first-lock or mic latency.
- Tajweed / madd: CTC elongations (e.g. `الضاااالين`), ghunnah, breath pauses must not mismatch or Global Search.
- Recitation cadence resiliency on the Hafs index (not a second riwayah product).
- Prayer state machine: surah handoff enters **ayah 1** (ayah **2** if ayah 1 is the shared Basmala) of salah-prior surahs; refuse mid-surah phantoms.
- Audio pipeline: bounded buffers, mic jitter, imam breath-pause recovery.
- Listening from the bundled Arabic mushaf (`MUSHAF_ONLY_MVP`). Translation pane stays off.

Out of Phase 1 (park, do not delete):

- On-screen Quran translation, language onboarding, two-pack install/evict, SQLite translation schema as a listen gate.
- Inventing ayah labels; flipping `stub` → `ready`; committing wav/mp3.

## Product bar (this MVP)

A session is done only when the Tip clip shows:

1. **First correct lock** (ayah + approx. audio seconds).
2. **Ordered (monotonic) advance** while audio continues (`verse_match` sequence, not `phase: following` alone).
3. **Correct Arabic mushaf** for those commits (not a translation, not a prediction).
4. **Handoff** when the Tip is a surah switch: next lock is ayah 1 (or ayah 2 after Basmala), not a mid-surah phantom.

Famous-short EveryAyah 14/14 is the regression floor, not mushaf-follow confidence.

## Checks

- `npm test` + `npm run typecheck`. Default `npm test` stays in-memory: monotonic follow, ayah-1 handoff, madd/CTC cousins. **No** network, translation SQLite, or pack-download tests in that suite.
- Units: `MUSHAF_ONLY_MVP` on; translation pane off; mushaf display verse has Arabic and empty translation.
- Mac Agent verify loop when follower/gate/Tilawa changed (`PRODUCT-BAR.md`). No `ready` flip. No wav commits.

## Successor bots

Read Tip → `AGENTS.md` → this prompt. Then resume the Tip P0 mushaf-tracking clip (`00-QUEUE.md`). Do not reopen translation-first prompts as current work.
