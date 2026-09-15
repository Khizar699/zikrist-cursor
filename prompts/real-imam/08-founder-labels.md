# Founder-verified real-imam labels (docs only)

## Goal

Commit Khizar’s 2026-09-16 ayah + timestamp labels as ground truth for staged imam clips. Do **not** flip `manifest.stub.json` suites to `ready`. Mac probes fail on two shorts; Fatir works.

## Scope

Docs and machine labels only. No matcher / follower threshold changes. No Quran fixture edits. No large wavs under `artifacts/`.

## Inspected

- Attached `LABELS.md` / `labels.json` (founder-verified; `suite_candidates` included)
- `prompts/real-imam/FIXTURES.md`, `manifest.stub.json`, `01-fixture-scaffold.md`
- Staging contract: gitignored `artifacts/recitation/imam/`

## Assumptions

- Labels override hypothesized probe locks.
- `imam-mid-ayah-pause` stays empty until a pause is annotated.
- `s9P8adOF7F0` @4:56 is Qunut Du’a → later liturgy/dua, not a Quran suite.
- Invented ayah numbers beyond the attached labels are not allowed.

## Files

- `prompts/real-imam/LABELS.md` — human labels + founder attribution
- `prompts/real-imam/labels.json` — machine labels + `suite_candidates`
- `prompts/real-imam/FIXTURES.md` — ground truth, Mac baseline, staging path
- `prompts/real-imam/MANIFEST-NOTE.md` — suites remain `stub` until algorithm fixes
- Pointers in `fixtures/real-imam/README.md`, `00-OVERNIGHT-QUEUE.md`, `README.md`, `VALIDATION.md`

## Architecture / security

Offline evaluation notes only. No audio committed. Rights for imam recordings remain unresolved.

## Acceptance

1. LABELS.md + labels.json on the branch; founder attribution kept.
2. FIXTURES.md states labels are ground truth and records Mac probe mismatches.
3. All `manifest.stub.json` suites stay `stub`.
4. No wavs, matcher edits, or invented ayahs.

## Checks

- `npm run typecheck`
- `npm test` (docs-only; expect no replay/follower regressions)
- Confirm no `artifacts/` audio staged

## Manual device tests

None this session. Mac acoustic probes already recorded as mismatches; do not treat them as labels.
