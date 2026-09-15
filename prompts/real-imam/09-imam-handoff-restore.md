# Imam fixture handoff restore (GitHub Release zip)

## Goal

Let friends clone the repo and restore founder imam evaluation audio **without git LFS**. Labels stay in git. Large wav/mp3 stay gitignored and come from a GitHub Release zip.

## Scope

Restore script + docs + npm script. Do **not** flip `manifest.stub.json` to `ready`. No matcher/follower retunes. No wav/mp3 committed.

## Inspected

- `scripts/download-recitation-fixtures.ts` (EveryAyah restore pattern)
- `scripts/gen-liturgy-tts.ts` (export + `invokedDirectly` + `--engine say`)
- `prompts/real-imam/LABELS.md`, `labels.json`, `FIXTURES.md`, `manifest.stub.json` (all stub)
- `.gitignore` already ignores `artifacts/`

## Assumptions

- Maintainer uploads `zikrist-imam-fixtures-v1.zip` (~557 MB) on tag `imam-fixtures-v1` after merge.
- Public HTTPS: `https://github.com/Khizar699/zikrist-cursor/releases/download/<tag>/zikrist-imam-fixtures-v1.zip`
- Tag override: `ZIKRIST_IMAM_RELEASE_TAG` (default `imam-fixtures-v1`). Asset name stays `zikrist-imam-fixtures-v1.zip`.
- Missing release → clear 404 error pointing at the Releases page.
- Skip if `artifacts/recitation/imam/LABELS.md` and at least one suite wav exist, unless `--force`.
- Unzip merges into `artifacts/recitation/imam/` (LABELS, labels.json, suite folders, `_inbox/`, `sources/`).
- System `unzip` (fallback `python3 zipfile`). No new npm zip dependency.

## Files

- `scripts/download-imam-fixtures.ts`
- `package.json` script `fixtures:imam`
- `HANDOFF.md`
- `fixtures/real-imam/README.md`, `prompts/real-imam/FIXTURES.md`, `README.md`, `VALIDATION.md`, `THIRD_PARTY_NOTICES.md`
- `tests/download-imam-fixtures.test.ts` — URL/parse/skip helpers, no network

## Architecture / security

Evaluation audio only; not app assets. Zip-slip check on extract. Rights for imam recordings remain unresolved. Do not log audio bytes.

## Acceptance

1. `npm run fixtures:imam` downloads public release zip, unpacks into gitignored `artifacts/recitation/imam/`.
2. `--force` re-downloads; otherwise skip when labels + one wav exist.
3. 404 names the Releases page and expected tag/asset.
4. Friend path documented: clone → `npm i` → `fixtures:recitation` → `fixtures:imam`.
5. Liturgy TTS note: `npm run liturgy:tts -- <id> --engine say` (gitignored).
6. Labels remain in `prompts/real-imam/`. Suites stay stub.

## Checks

- `npm run typecheck`
- `npx tsx --test tests/download-imam-fixtures.test.ts tests/real-imam-pack.test.ts`
- Confirm `manifest.stub.json` still all `stub`
- Confirm no wav/mp3 tracked
- Optional: run script against missing release and confirm 404 wording (no zip upload in this session)

## Manual device tests

None. Acoustic replay still Mac/Sim QA after the zip exists.
