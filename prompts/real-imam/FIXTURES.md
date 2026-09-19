# Real-imam fixtures

Large audio is gitignored. Labels stay in git. Restore clips with `npm run fixtures:imam` (GitHub Release `imam-fixtures-v1`, or `ZIKRIST_IMAM_RELEASE_TAG`).

```sh
npm i
npm run fixtures:recitation
npm run fixtures:imam
```

The zip unpacks into `artifacts/recitation/imam/`. Re-download with `--force`. Liturgy TTS wavs are not in the zip: `npm run liturgy:tts -- <id> --engine say`.

Founder-verified ayah labels: `LABELS.md` and `labels.json`. Do not invent ayah numbers.

Suite registry: `manifest.stub.json`. `imam-mid-surah-cold` (4:129–130) and `imam-mid-surah-cold-qiyam` (36:16–18) are `ready`. Other rows stay `stub` and skip when the clip is missing.
