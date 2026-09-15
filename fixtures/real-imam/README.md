# Real-imam fixtures (harness pointer)

Do **not** treat this folder as a second prompt pack. Naming, suite ids, and the overnight queue live in `prompts/real-imam/` (Prompt Smith).

| Piece | Path |
|-------|------|
| Founder drop | `~/Desktop/zikrist-imam-clips/` |
| Founder labels (ground truth) | `prompts/real-imam/LABELS.md`, `labels.json` |
| Manifest / stubs | `prompts/real-imam/manifest.stub.json` (still `stub`; see `MANIFEST-NOTE.md`) |
| Audio staging (gitignored) | `artifacts/recitation/imam/<suite-id>/<qari-or-source>/` |
| Layout contract | `prompts/real-imam/01-fixture-scaffold.md`, `FIXTURES.md` |

`npm run test:replay -- real-imam` **skips** stub suites with `missing_fixture` (not a PASS). Default `all` stays the original 14.
