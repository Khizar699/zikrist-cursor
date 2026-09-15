# Real-imam / live-tilawah fixtures

Large audio is gitignored. Founder drops source media in `~/Desktop/zikrist-imam-clips/`.

## Layout

```
artifacts/recitation/imam/
  manifest.json
  <suite-id>/<qari-or-source>/<files>.wav
  _stubs/   # placeholder entries until clips arrive
```

## Suite ids

See `prompts/real-imam/00-OVERNIGHT-QUEUE.md` and `01-fixture-scaffold.md`.

## Status

- `stub` — no real audio; automated suite must **skip**, not PASS  
- `ready` — clip present + Mac-verified notes  

## Label-fill (founder labels landed 2026-09-16)

Ground truth: `artifacts/recitation/imam/LABELS.md` + `labels.json` (not probes).

**Prompts:** `prompts/real-imam/label-fill/` — one suite per session; no matcher retune.

| Priority | Prompt | Suite | Expect |
|---|---|---|---|
| 1 | `label-fill/01-mid-surah-cold-dr-subayyal.md` | `imam-mid-surah-cold` | 4:129–130 |
| 2 | `label-fill/02-mid-surah-cold-qiyam.md` | `imam-mid-surah-cold-qiyam` (sibling) | 36:16–18 |

**Blocked:** `imam-mid-ayah-pause` (no pause mark). Qunut at s9P@4:56 is dua — not Quran.
