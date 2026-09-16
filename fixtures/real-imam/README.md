# Real-imam fixtures (harness pointer)

Do **not** treat this folder as a second prompt pack. Naming, suite ids, and the overnight queue live in `prompts/real-imam/` (Prompt Smith). Friend restore steps: `HANDOFF.md`.

| Piece | Path |
|-------|------|
| Friend restore | `npm run fixtures:imam` (GitHub Release zip, not git LFS) |
| Founder drop | `~/Desktop/zikrist-imam-clips/` |
| Founder labels (ground truth, git) | `prompts/real-imam/LABELS.md`, `labels.json` |
| Manifest / stubs | `prompts/real-imam/manifest.stub.json` (`imam-mid-surah-cold` ready; others stub; see `MANIFEST-NOTE.md`) |
| Audio staging (gitignored) | `artifacts/recitation/imam/<suite-id>/<qari-or-source>/` |
| Layout contract | `prompts/real-imam/01-fixture-scaffold.md`, `FIXTURES.md` |

Friend path: clone → `npm i` → `npm run fixtures:recitation` → `npm run fixtures:imam` → continue. Liturgy TTS wavs are regenerated with `npm run liturgy:tts -- <id> --engine say` (gitignored).

`npm run test:replay -- real-imam` scores `imam-mid-surah-cold` when the WAV is restored (`npm run fixtures:imam`) and **skips** remaining stub suites with `missing_fixture` (not a PASS). Default `all` stays the original 14.
