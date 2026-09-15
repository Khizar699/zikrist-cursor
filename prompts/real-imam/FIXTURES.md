# Real-imam / live-tilawah fixtures

Large audio is gitignored. Founder drops source media in `~/Desktop/zikrist-imam-clips/`.

## Ground truth

Founder-verified ayah + timestamp labels live in git at `prompts/real-imam/LABELS.md` and `prompts/real-imam/labels.json` (Khizar Javed, 2026-09-16). Those files are **ground truth**. Ignore hypothesized probe locks (including `probes/hypothesized-locks.txt` if present). Do not invent ayah numbers beyond the attached labels. A copy may also exist under `artifacts/recitation/imam/` after clips are staged.

## Layout

```
artifacts/recitation/imam/
  manifest.json
  <suite-id>/<qari-or-source>/<files>.wav
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
- `ready` — clip present + Mac-verified notes **and** algorithm good enough to flip

All suites in `manifest.stub.json` stay `stub` until algorithm fixes land. See `MANIFEST-NOTE.md`.

## Label-fill (founder labels landed 2026-09-16)

**Prompts:** `prompts/real-imam/label-fill/` — one suite per session; no matcher retune.

| Priority | Prompt | Suite | Expect |
|---|---|---|---|
| 1 | `label-fill/01-mid-surah-cold-dr-subayyal.md` | `imam-mid-surah-cold` | 4:129–130 |
| 2 | `label-fill/02-mid-surah-cold-qiyam.md` | `imam-mid-surah-cold-qiyam` (sibling) | 36:16–18 |

**Blocked:** `imam-mid-ayah-pause` (no pause mark). Qunut at s9P@4:56 is dua — not Quran. Do not launch 01/02 until the mid-surah false-lock algorithm is Mac-green.

## Mac baseline (2026-09-16)

Informal Mac probes. **Do not** treat these locks as labels.

- Fatir 35:1–8 locks OK
- Subayyal expected 4:129 locks wrong 41:34
- Qiyam expected 36:16 locks wrong 78:4
