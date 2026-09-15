# Stop false early acquire locks (replay gate)

## Goal

Headless `npm run test:replay` must not first-lock the wrong surah/ayah on short opening audio. Fix acquire so Fatiha, Ikhlas, and Nas fixtures lock the correct first unique ayah — not a distant false champion — then follow in order.

## Last session proved / failed

Harness landed (`tsx scripts/replay.ts`, Fatiha `001001`–`001007`, JSON under `artifacts/qa-runs/`).

Measured failures (live RecitationFollower + ContinuationGate path):

| Suite | firstLock | failureMode |
| --- | --- | --- |
| Fatiha | **35:9@3s** | `first_lock_35:9_expected_1:2` then stall |
| Ikhlas | **17:110@2s** then 112:3@8.25s | `sequence_break_at_0_got_17:110_expected_112:1` |
| Nas | **25:77@2s** | `sequence_break_at_0_got_25:77_expected_114:1` |

Unit tests still 85/85; this is acoustic acquire, not a missing regression case alone.

## Constraints

- Offline; real ONNX + existing follower. Do not fake matches.
- One concern: **false early acquire** only. Do not polish UI. Do not retune model weights.
- Keep Ibrahim 14:39/14:40 Fatiha guards, 1:2→1:3 / 1:5→1:6 advances, Basmala hold, short-verse vs long-ayah guards.
- Scores stay similarity scores. No physical-device accuracy claims.
- Read `AGENTS.md`, `VALIDATION.md`, `scripts/replay.ts`, `src/core/follower.ts`, `src/core/continuation-gate.ts`.
- Prefer tightening acquire / first-lock evidence (unique words, shared-prefix hold, reject distant champions on thin windows) over widening follow windows.

## Area to touch

- `src/core/follower.ts` (and gate helpers only if acquire evidence lives there)
- `tests/follower.test.ts` — add cases that encode these false locks if not already covered
- Re-run `npm run test:replay` (fatiha / ikhlas / nas); refresh `artifacts/qa-runs/replay-*.json`
- `VALIDATION.md` — honest note of what replay now passes/fails

## Out of scope

- New fixtures beyond what exists
- UI / typography
- Mega-refactors of Tilawa internals
- Changing harness JSON schema unless a field is required to express failureMode

## Success criteria

1. `npm run test:replay -- fatiha` → first lock **1:2**, never 35:9 / 14:39 / 14:40; then 1:3…1:7 ordered (or exact failureMode if still incomplete).
2. `npm run test:replay -- ikhlas` → first lock **112:1**, never 17:110; then 112:2–4 ordered.
3. `npm run test:replay -- nas` → first lock **114:1** (or correct post-Basmala first unique), never 25:77; then 114:2–6 ordered.
4. `npm test`, `npm run typecheck`, `npm run lint` pass.
5. Session ends with: refreshed JSON paths, what proved/failed, next narrow slice.

## Deliverable

Exact commands + updated `replay-*.json` + files changed.
