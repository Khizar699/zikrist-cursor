# Founder-clip algo queue (after label-fill)

Label-fill **01** (`6df8ef3` / #18) + **02** (`c228533` / #19) are on main. Pack is **unheld**.

Bot launches **one Cursor session at a time**, in order — **no mega-prompt**.

**Next = co-P0** either restore floor (**jump** + **english-negative**, same-PR locks) **or** `04-hafiz-usama-1-2-vs-27-15.md` (**follow / handoff**). Tip names exactly one; findings ledger ids: `floor-jump-ikhlas`, `floor-english-negative-20-1`, `product-hafiz-usama-27-15`.

**Do not** expand the default replay floor or treat Tier A coverage M/N as merge-green while floor is red.

**Regression floor every session:** Mac `npm run test:replay -- all` = **14/14** (or honest N/14 if red — restore before claiming green).  
**Product bar every algo session:** `PRODUCT-BAR.md` — lock + ordered advance on the Tip clip; 14/14 alone is **not** done.  
**Ratchet every fix:** `RATCHET.md` — same-PR permanent unit and/or ready expect; tip known-fails only shrink when locked.  
**Coverage scoreboard:** `COVERAGE.md` + `npm run test:coverage` — append findings; never invent labels.

Continuity: `prompts/_SHARED-HANDOFF.md` + root `HANDOFF.md` tip in the same PR.

**Do not** flip manifest `ready` in these algo sessions (label-fill owns readiness). **Do not** commit wav/mp3. **Do not** retune liturgy.

## Launch order (product priority)

| Pri | Prompt | Concern |
|---|---|---|
| **P0** | floor restore (`jump`, `english-negative`) | Tip findings `floor-jump-ikhlas` + `floor-english-negative-20-1` — same-PR locks before expanding floor |
| **P0** | `04-hafiz-usama-1-2-vs-27-15.md` | **Follow/handoff:** Fatiha→An-Naml **27:15** (finding `product-hafiz-usama-27-15`) |
| P1 | (future prompt if needed) | Advance under overlap — park on 1:2/1:5 while next ayah spoken |
| P2 | `01-masjid-e-nabi-25-69-false-2-1.md` | False first-lock: **25:69** ≠ **2:1** |
| P2 | `02-ahzab-to-saba-cold-33-60-vs-33-62.md` | False first-lock / cold: **33:62** ≠ **33:60** |
| P2 | `03-baqarah-to-imran-false-57-28.md` | False first-lock: refuse **57:28** |
| P3 | Tier A coverage growth | `npm run test:coverage` — scoreboard only until floor green |

Rationale: locate/famous-short already improved under the old acquire-first queue. User-facing gap is **stuck after first lock** and incomplete surah coverage. False-first-lock clips stay in the pack but are **not** P0.

Shared notes: `_SHARED.md`. Product bar: `PRODUCT-BAR.md`. Ground truth: `prompts/real-imam/LABELS.md` + `labels.json`. Never trust `probes/hypothesized-locks.txt`.

## Status

| # | Prompt | Status |
|---|---|---|
| floor | jump + english-negative | **co-P0** — findings `floor-jump-ikhlas`, `floor-english-negative-20-1` |
| 04 | hafiz-usama →27:15 (follow/handoff) | **co-P0** — finding `product-hafiz-usama-27-15` |
| 01 | masjid-e-nabi 25:69≠2:1 | deferred P2 — after follow P0 |
| 02 | ahzab cold 33:62≠33:60 | deferred P2 |
| 03 | baqarah→imran ≠57:28 | deferred P2 |

This pack does **not** claim Mac-green for these clips until the matching algo session measures them. Short mid-surah ready suites (Subayyal / Qiyam) are not a substitute for Fatiha→body handoff.
