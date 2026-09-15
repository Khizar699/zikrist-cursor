# Real-imam coverage pack (scaffold, no audio)

## Session plan (2026-09-15)

### Goal

Scaffold a **real-imam coverage pack** so founder-dropped WAV/MP3 later is mechanical. Register pending replay suites that do **not** join default `npm run test:replay -- all` (still the original 14). Until clips exist, `npm run test:replay -- real-imam` reports `missing_fixture` — never a fake PASS and never invented audio.

### Scope (one concern)

Harness + fixture layout + overnight prompts + docs. **Do not** retune `RecitationFollower`, ContinuationGate, salah liturgy matcher, or model weights. **Do not** synthesize or commit evaluation audio.

### Inspected

- `scripts/replay-suites.ts` / `scripts/replay.ts`: 14 ready suites in `ALL_SUITE_NAMES`; clips under gitignored `artifacts/recitation/`; gates in `evaluateFailure`.
- `prompts/real-imam/*` already named suite ids (`imam-mid-surah-cold`, …) and a stub manifest, but `artifacts/` is fully gitignored so a committed README/schema could not live there.
- Salah liturgy is a **separate** track (`prompts/salah-liturgy/`, data-only pack on main). Do not merge liturgy replay into this pack.
- Live mic / replay skip unvoiced frames **inside** the clip (`index < audio.length`) and still feed trailing pad. Mid-ayah pause as internal silence matches live pause (frames skipped). Stall-after-lock remains trailing **fed** pad.

### Assumptions

- Stable suite ids stay those in `prompts/real-imam/01-fixture-scaffold.md`.
- Committed layout: `fixtures/real-imam/` (JSON + README). Audio only under `clips/`, gitignored.
- Incoming founder media: `~/Desktop/zikrist-imam-clips/` (not in repo).
- Placeholder `expect` arrays describe the **intended** clip, not a measured result. Edit JSON to match the dropped recording.
- `real-imam` / `--include-pending` are the only ways default `all` grows; 14/14 remains the hard Quran gate.

### Files

- `prompts/real-imam/*`, `prompts/real-imam-coverage-pack.md`
- `fixtures/real-imam/` (README, schema, suite JSON, empty clip dirs)
- `scripts/replay-suites.ts`, `scripts/replay.ts`
- `tests/replay-suites.test.ts`, `tests/real-imam-pack.test.ts`
- `package.json`, `README.md`, `VALIDATION.md`, `THIRD_PARTY_NOTICES.md`

### Architecture / security

- Same headless path as Quran suites when audio exists (ONNX + follower + gate). No fake matches.
- Pending suites skip engine load when every selected clip is missing.
- Evaluation audio is not an app asset and is not uploaded. Imam/bystander rights stay unresolved until reviewed. A local file is not a redistribution grant.

### Acceptance

1. `npm run test:replay -- all` still resolves to the original 14 names.
2. `npm run test:replay -- real-imam` lists the five pending suites and exits with `failureMode: missing_fixture` (no ONNX required).
3. `--list` documents pending entries. `--include-pending` can add them to `all`.
4. Fixture README documents clip id, expected-locks schema, and how to register a suite.
5. `npm test`, `npm run typecheck`, `npm run lint` pass. No follower edits. No WAV/MP3 committed.

### Checks / manual

- Unit tests for selection, 14-count, pending names, schema files, empty clip dir.
- `npx tsx scripts/replay.ts real-imam` and `--list` on this agent (no model needed).
- Do not run `test:replay -- all` acoustic scoring unless fixtures + ONNX are present; do not claim 14/14 from this session if WAVs are absent.
- Not a physical-phone or mosque measurement.
