# Real-imam coverage pack (scaffold, no audio)

## Session plan (2026-09-15)

### Goal

Register Prompt Smith’s real-imam suite ids in the replay harness so founder-dropped WAV/MP3 later is mechanical. **Do not duplicate** `prompts/real-imam/` briefs. Default `all` stays 14. Stubs **skip** with `missing_fixture` — never a fake PASS, never invented audio.

### Scope (one concern)

Harness registration + a thin pointer README. Prompt Smith already landed the overnight queue, FIXTURES, LIVE-FEEL, suite prompts, and `manifest.stub.json`. **Do not** retune `RecitationFollower` or salah liturgy.

### Inspected

- `prompts/real-imam/*` on main: suite ids `imam-mid-surah-cold` … `imam-multi-qari`; clip drop `~/Desktop/zikrist-imam-clips/`; staging `artifacts/recitation/imam/<suite-id>/<qari-or-source>/`.
- `ALL_SUITE_NAMES` is the 14 Quran gate.

### Assumptions

- Read `prompts/real-imam/manifest.stub.json` as the suite registry (`status: stub`).
- Audio lives under gitignored `artifacts/recitation/imam/` (Prompt Smith), not a second committed clip tree.
- `real-imam` skip must not fail `all` / `--include-pending` Quran results.

### Files

- `scripts/replay-suites.ts`, `scripts/replay.ts` (pending pack, skip)
- `tests/replay-suites.test.ts`, `tests/real-imam-pack.test.ts`
- `fixtures/real-imam/README.md` (pointer only)
- `README.md`, `VALIDATION.md` — 14/14 hard gate; liturgy separate
- One short harness note on `prompts/real-imam/00-OVERNIGHT-QUEUE.md`; do not rewrite the suite briefs

### Acceptance

1. `npm run test:replay -- all` = original 14 names.
2. `npm run test:replay -- real-imam` skips five stubs (`status: skipped`, `missing_fixture`) and exits 0 (not PASS).
3. No duplicate overnight prompt pack.
4. `npm test` / typecheck / lint pass. No follower edits. No WAV/MP3 committed.
