# Founder-clip algo queue (after label-fill)

Label-fill **01** (`6df8ef3` / #18) + **02** (`c228533` / #19) are on main. Pack is **unheld**.

Bot launches **one Cursor session at a time**, in order — **no mega-prompt**. **Next = P0** `01-masjid-e-nabi-25-69-false-2-1.md`.

**Hard gate every session:** Mac `npm run test:replay -- all` = **14/14**. Continuity: `prompts/_SHARED-HANDOFF.md` + root `HANDOFF.md` tip in the same PR.

**Do not** flip manifest `ready` in these algo sessions (label-fill owns readiness). **Do not** commit wav/mp3. **Do not** retune liturgy.

## Launch order (P0 → P3)

1. `01-masjid-e-nabi-25-69-false-2-1.md` — masjid-e-nabi **25:69** ≠ **2:1**
2. `02-ahzab-to-saba-cold-33-60-vs-33-62.md` — ahzab cold **33:62** ≠ **33:60** (surah-switch cold acquire)
3. `03-baqarah-to-imran-false-57-28.md` — baqarah→imran refuse **57:28**
4. `04-hafiz-usama-1-2-vs-27-15.md` — Fatiha→An-Naml **27:15** (not stuck/wrong at **1:2**)

Shared notes: `_SHARED.md`. Ground truth: `prompts/real-imam/LABELS.md` + `labels.json`. Never trust `probes/hypothesized-locks.txt`.

## Status

| # | Prompt | Status |
|---|---|---|
| 01 | masjid-e-nabi 25:69≠2:1 | **P0 next** — launch now |
| 02 | ahzab cold 33:62≠33:60 | queued |
| 03 | baqarah→imran ≠57:28 | queued |
| 04 | hafiz-usama →27:15 | queued |

This pack does **not** claim Mac-green for these four clips — measure/fix is the algo sessions' job.
