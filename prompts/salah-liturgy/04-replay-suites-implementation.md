# Session: salah liturgy replay suites (stub-first)

## Goal

Register the eight headless salah liturgy replay suites from `04-replay-suites.md` + `manifest.stub.json`. Stubs **SKIP** with `failureMode`/`status` `missing_fixture` — never fake PASS. Default `npm run test:replay -- all` stays the original **14** Quran names.

## Scope

Harness only: CLI aliases, suite registry, stub wiring, skip reports, units, README/VALIDATION. Mirror `real-imam` registration in `scripts/replay-suites.ts` / `scripts/replay.ts`.

## Inspected

- `prompts/salah-liturgy/04-replay-suites.md`, `manifest.stub.json`
- Real-imam pattern: `REAL_IMAM_SUITE_NAMES`, pending `readiness`, `recordMissingFixture`, `MISSING_FIXTURE`
- Live liturgy path: `listening.ts` feeds `RecitationFollower.lastHeardTokens` into `SalahLiturgyMatcher` (PCM → tokens → matcher). Replay Quran path is still follower+gate only.

## Assumptions

- Wire the committed stub manifest; extend with `clip_path` / gate fields consistently with real-imam.
- Audio staging (gitignored): `artifacts/recitation/liturgy/<suite-id>/`. No silent fake WAVs. No evaluation audio committed.
- Mixed suites may list EveryAyah Fatiha WAVs for the Quran half; liturgy clips stay stubs so the suite still skips until liturgy audio exists.
- Chosen scoring path when audio later exists: **PCM through the same follower + matcher path as live listening** (not token-fixtures that could PASS without audio). Matcher units already cover token locks.
- Do not retune follower or liturgy matcher thresholds. Do not change the 14 Quran gate bodies.

## Files

- `scripts/replay-suites.ts`, `scripts/replay.ts`
- `tests/replay-suites.test.ts`, `tests/salah-liturgy-replay.test.ts`
- `prompts/salah-liturgy/manifest.stub.json` (clip_path / gate extend)
- `fixtures/salah-liturgy/` pointer README + sample skip JSON
- `README.md`, `VALIDATION.md`, `package.json`, overnight queue note

## Architecture / privacy

- Offline; no upload; no committed liturgy WAV/MP3.
- Default 14 suites must not run the liturgy matcher (avoid changing Mac 14/14).
- Liturgy suites attach matcher only when those suites actually run (audio present).
- Skip is not PASS. `missing_fixture` stays the failureMode while status is `skipped`.

## Acceptance

1. `parseSuiteSelection(['all'])` is 14 names; no `liturgy-*` / `fatiha-then-takbeer`.
2. `npm run test:replay -- liturgy` (and `salah-liturgy`) lists/runs 8 stubs, skip `missing_fixture`, exit 0, no ONNX.
3. Units cover alias selection, skip-not-PASS, and liturgy gate evaluation (synthetic locks).
4. Docs: commands, skip-not-PASS, phrases still lacking audio, sample skip JSON.
5. If shared replay code is touched: Mac must re-verify 14/14; Linux ONNX is not that gate.

## Checks / device

- `npm test`, `npm run typecheck`, `npm run lint`
- `npx tsx scripts/replay.ts all --list` shows 14 ready names
- `npx tsx scripts/replay.ts liturgy` skip 8, exit 0
- No physical device / no Mac ONNX in this Linux workspace
