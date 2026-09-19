# Salah liturgy replay fixtures

| Piece | Path |
|-------|------|
| Manifest | `prompts/salah-liturgy/manifest.stub.json` |
| Audio (gitignored) | `artifacts/recitation/liturgy/<suite-id>/` |
| Sample skip JSON | `fixtures/salah-liturgy/sample-skip.json` |

`npm run test:replay -- liturgy` skips stub suites with `missing_fixture`. `liturgy-takbeer` and `liturgy-thana` are ready after `npm run liturgy:tts -- <id> --engine say`. Do not commit evaluation WAVs.
