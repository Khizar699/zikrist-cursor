# Handoff — clone and restore evaluation audio

Friends cloning this repo do **not** get large recitation wav/mp3 from git (no Git LFS). Founder-verified imam **labels** are in git. Audio is restored locally.

## Friend path

```sh
git clone https://github.com/Khizar699/zikrist-cursor.git
cd zikrist-cursor
npm i
npm run fixtures:recitation    # EveryAyah Quran replay wavs → artifacts/recitation/
npm run fixtures:imam          # GitHub Release zip → artifacts/recitation/imam/
```

Then continue with native build / Sim QA as in `README.md` (`npm run assets:download`, `npm run test:replay -- all`, and so on).

Re-download imam clips: `npm run fixtures:imam -- --force`.

## Imam fixtures (GitHub Release zip)

| Piece | Where |
|-------|--------|
| Ground truth labels (git) | `prompts/real-imam/LABELS.md`, `prompts/real-imam/labels.json` |
| Staged audio (gitignored) | `artifacts/recitation/imam/` |
| Restore script | `npm run fixtures:imam` |
| Default tag | `imam-fixtures-v1` (`ZIKRIST_IMAM_RELEASE_TAG` to override) |
| Asset | `zikrist-imam-fixtures-v1.zip` (~557 MB) |
| Public URL | `https://github.com/Khizar699/zikrist-cursor/releases/download/imam-fixtures-v1/zikrist-imam-fixtures-v1.zip` |

The zip unpacks **into** `artifacts/recitation/imam/`, merging `LABELS.md`, `labels.json`, suite folders, `_inbox/`, and `sources/`. The script skips when that `LABELS.md` and at least one suite wav already exist.

If the release is not uploaded yet, the script exits with HTTP 404 and points at https://github.com/Khizar699/zikrist-cursor/releases. That is expected until a maintainer publishes tag `imam-fixtures-v1`.

Real-imam replay suites stay `stub` until algorithm fixes land. Restoring wavs is not a readiness flip. `npm run test:replay -- real-imam` still **skips** with `missing_fixture` (not PASS) while the manifest is stub.

## Liturgy TTS wavs (gitignored)

Liturgy evaluation audio is generated on the machine, not restored from the imam zip:

```sh
npm run liturgy:tts -- liturgy-takbeer --engine say
```

Replace `liturgy-takbeer` with another suite id when that fill session exists. Needs `say` + ffmpeg on Mac (or `edge-tts` when it works). Wavs stay under `artifacts/recitation/liturgy/` and must not be committed.

## Rights

Imam and bystander recordings are evaluation-only. They are not app assets. A public Release URL is not a redistribution or training grant. See `THIRD_PARTY_NOTICES.md`.
