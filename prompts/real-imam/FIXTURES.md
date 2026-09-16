# Real-imam / live-tilawah fixtures

Large audio is gitignored (no git LFS). Founder-verified **labels** stay in git. Friends restore clips from a GitHub Release zip. Founder can also drop source media in `~/Desktop/zikrist-imam-clips/`.

## Friend restore

See `HANDOFF.md`. After clone:

```sh
npm i
npm run fixtures:recitation
npm run fixtures:imam
```

`npm run fixtures:imam` downloads public `zikrist-imam-fixtures-v1.zip` from tag `imam-fixtures-v1` (override with `ZIKRIST_IMAM_RELEASE_TAG`) and unpacks into `artifacts/recitation/imam/`, merging `LABELS.md`, `labels.json`, suite folders, `_inbox/`, and `sources/`. It skips when that `LABELS.md` and at least one suite wav already exist (`--force` to re-download). If the Release is missing, the script prints HTTP 404 and the Releases page URL.

Liturgy TTS wavs are **not** in that zip. Regenerate with `npm run liturgy:tts -- <id> --engine say` (gitignored).

## Ground truth

Founder-verified ayah + timestamp labels live in git at `prompts/real-imam/LABELS.md` and `prompts/real-imam/labels.json` (Khizar Javed, 2026-09-16). Those files are **ground truth**. Ignore hypothesized probe locks (including `probes/hypothesized-locks.txt` if present). Do not invent ayah numbers beyond the attached labels. A copy may also unpack into `artifacts/recitation/imam/LABELS.md` from the zip.

## Layout

```
artifacts/recitation/imam/
  LABELS.md
  labels.json
  <suite-id>/<qari-or-source>/<files>.wav
  _inbox/
  sources/
  _stubs/   # placeholder entries until clips arrive
```

Staged wav segments live under `artifacts/recitation/imam/` (gitignored). Naming follows the scaffold, for example:

- `imam-mid-surah-cold__dr-subayyal__004-129-130__raw.wav`

`suite_candidates` in `labels.json` list intended paths under that tree. Do not commit large wavs.

## Suite ids

See `prompts/real-imam/00-OVERNIGHT-QUEUE.md` and `01-fixture-scaffold.md`.

- `imam-mid-ayah-pause` is still empty (no pause annotation).
- `s9P8adOF7F0` @4:56 is Qunut Du’a → liturgy/dua later, not a Quran suite.

## Status

- `stub` — no ready evaluation yet; automated suite must **skip**, not PASS
- `ready` — clip path + founder expect are wired; Mac must PASS after `npm run fixtures:imam`

`imam-mid-surah-cold` is `ready` (Subayyal **4:129–130**, label-fill 01). Other rows in `manifest.stub.json` stay `stub`. Restoring the zip is not a readiness flip. See `MANIFEST-NOTE.md`.

## Label-fill (founder labels landed 2026-09-16)

**Prompts:** `prompts/real-imam/label-fill/` — one suite per session; no matcher retune.

| Priority | Prompt | Suite | Expect | Status |
|---|---|---|---|---|
| 1 | `label-fill/01-mid-surah-cold-dr-subayyal.md` | `imam-mid-surah-cold` | 4:129–130 | **done** (manifest ready; Mac score is Bot/Sim) |
| 2 | `label-fill/02-mid-surah-cold-qiyam.md` | `imam-mid-surah-cold-qiyam` (sibling) | 36:16–18 | **next** |

**Blocked:** `imam-mid-ayah-pause` (no pause mark). Qunut at s9P@4:56 is dua — not Quran. PR **#17** Mac-green on merge cleared the mid-surah false-lock hold.

## Mac baseline (2026-09-16) — superseded for Subayyal/Qiyam false locks

Informal Mac probes **before** PR #17. **Do not** treat these locks as labels.

- Fatir 35:1–8 locks OK
- Subayyal expected 4:129 locked wrong 41:34 — **cleared** on #17 Mac-green (4:129→130)
- Qiyam expected 36:16 locked wrong 78:4 — **cleared** on #17 Mac-green (36:16→18)
