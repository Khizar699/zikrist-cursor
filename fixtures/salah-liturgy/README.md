# Salah liturgy replay fixtures (harness pointer)

Do **not** treat this folder as evaluation audio. Suite ids and the overnight brief live in `prompts/salah-liturgy/`.

| Piece | Path |
|-------|------|
| Manifest / stubs | `prompts/salah-liturgy/manifest.stub.json` |
| Audio staging (gitignored) | `artifacts/recitation/liturgy/<suite-id>/` |
| Sample skip JSON | `fixtures/salah-liturgy/sample-skip.json` |
| Layout / gates | `prompts/salah-liturgy/04-replay-suites.md` |

`npm run test:replay -- liturgy` (alias `salah-liturgy`) **skips** stub suites with `missing_fixture` (not a PASS). Default `all` stays the original 14 Quran suites.

Do not commit TTS/recited evaluation WAVs. Do not drop silent fake WAVs that would PASS. Mixed suites may reuse EveryAyah Fatiha WAVs under `artifacts/recitation/` only for the Quran half; liturgy clips stay stubs until real phrase audio exists.
