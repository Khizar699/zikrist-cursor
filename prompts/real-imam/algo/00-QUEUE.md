# Founder-clip algo queue (after label-fill)

Label-fill **01** (`6df8ef3` / #18) + **02** (`c228533` / #19) are on main. Pack is **unheld**.

Bot launches **one Cursor session at a time**, in order — **no mega-prompt**.

**Current MVP = Phase 1 mushaf follow** (`prompts/mushaf-first-mvp.md`). Neighborhood `[current − 1, current + 2]`, monotonic advance, madd/CTC sticky lock, ayah-1 surah handoff. **Phase 2 translation** is a `[surah:ayah]` lookup after Arabic tracking is flawless — out of this queue.

**Next = current Tip** mushaf-first vision pass landed; resume **P0** floor restore **english-negative** (`floor-english-negative-20-1`) **and** stall-after-lock `no_matches`, **or** Hafiz Usama **27:15**. Ready qiyam **36:16** false-lock **2:1** is open. Surah-handoff, no-global-freeze, sticky-lock latency, sim-test-2, and live short-surah tail remain **closed**. P1 chrome `prompts/live-passage-chrome.md` is **Arabic** island/garbled-neighbor work, not translation. Jump (`floor-jump-ikhlas`) and live shared-tail (`live-follow-shared-tail`) remain **closed**. Default stays Tilawa; a streaming swap needs a commercial Quran-token head that wins `npm run test:bakeoff`.

**Do not** expand the default replay floor or treat Tier A coverage M/N as merge-green while floor is red.

**Regression floor every session:** Mac `npm run test:replay -- all` = **14/14** (or honest N/14 if red — restore before claiming green).  
**Product bar every algo session:** `PRODUCT-BAR.md` — lock + monotonic ordered advance + matching Arabic mushaf on the Tip clip; 14/14 alone is **not** done. Translation is Phase 2, not this bar.  
**Ratchet every fix:** `RATCHET.md` — same-PR permanent unit and/or ready expect; tip known-fails only shrink when locked.  
**Coverage scoreboard:** `COVERAGE.md` + `npm run test:coverage` — append findings; never invent labels.

Continuity: `prompts/_SHARED-HANDOFF.md` + root `HANDOFF.md` tip in the same PR.

**Do not** flip manifest `ready` in these algo sessions (label-fill owns readiness). **Do not** commit wav/mp3. **Do not** retune liturgy.

## Launch order (product priority)

| Pri | Prompt | Concern |
|---|---|---|
| **P0** | floor restore (`english-negative`) | Tip finding `floor-english-negative-20-1` — same-PR lock before expanding floor |
| **P0** | `04-hafiz-usama-1-2-vs-27-15.md` | **Follow/handoff:** Fatiha→An-Naml **27:15** (finding `product-hafiz-usama-27-15`) |
| P1 | `prompts/live-passage-chrome.md` | Island remnants, waveform covering **next Arabic**, gear overlap, garbled dim Arabic. Not translation. |
| P2 | `01-masjid-e-nabi-25-69-false-2-1.md` | False first-lock: **25:69** ≠ **2:1** |
| P2 | `02-ahzab-to-saba-cold-33-60-vs-33-62.md` | False first-lock / cold: **33:62** ≠ **33:60** |
| P2 | `03-baqarah-to-imran-false-57-28.md` | False first-lock: refuse **57:28** |
| P3 | Tier A coverage growth | `npm run test:coverage` — scoreboard only until floor green |

Rationale: locate/famous-short already improved under the old acquire-first queue. User-facing gap is **stuck after first lock** and incomplete surah coverage. False-first-lock clips stay in the pack but are **not** P0. Translation-first prompts are parked.

Shared notes: `_SHARED.md`. Product bar: `PRODUCT-BAR.md`. Ground truth: `prompts/real-imam/LABELS.md` + `labels.json`. Never trust `probes/hypothesized-locks.txt`.

## Status

| # | Prompt | Status |
|---|---|---|
| live-short-surah-tail | Ikhlas 112:2 freeze + clipped Fatiha 1:7 (iPhone 17 sim 2026-09-18) | **closed** — finding `live-ikhlas-stall-112-3`. Mac 2026-09-18: ikhlas **112:1–4** including 112:3@6s; compact-surah cache; 1:7 padding unit. Live Simulator recitation not re-measured |
| follow-sticky-lock-latency | Match lag / Global Search spikes / sticky lock | **closed** — inverted n-gram locate shortlist; mid-surah `[n−1,n+2]`; min transcript; sequential 0.65 |
| follow-no-global-freeze | 2500ms locate freeze / false Global Search / Fatiha→Ikhlas handoff | **closed** — no `bestJoint03Match` while following; pool handoff; madd collapse; grace 3 hops **and** 1.5s. Mac 2026-09-18: units 269/269; floor 13/14; ikhlas/fatiha/nas + jump 112:1@16.5s; ready imam PASS |
| follow-surah-handoff | 1986ms Match spike at 109:6 + carousel frozen on 109:6 while engine locked 105:5 / 108:3 | **closed** — no sync global on follow hop; ayah-1 pool at ≥0.65 (105:1 not 105:5); gate/display-hold paint new surah immediately. Mac 2026-09-18: units 272/272; floor 13/14; ikhlas/fatiha/nas + jump 112:1@16.5s; ready imam PASS. Live Simulator recitation not re-measured |
| sim-test-2-surah-switch | Simulator test 2: 1:7 held ~30s through An-Nas; cold-start Match 1418–2277ms | **closed** — gate paints salah-prior ayah-1 immediately; acquire `locate:false` then pool ≥0.65; listening flushes passage on surah switch. Mac 2026-09-18: units 280/280; floor 13/14; nas **114:1@4s–6**; falaq **113:1@3s–5**; ikhlas **112:1@1s–4**; ready imam PASS. Live Simulator recitation not re-measured |
| follow-phantom-surah-jump | Nas trail 4:142 / last-ayah snap / reacquire locate freeze | **closed this session** — openings-only handoff; ≥0.70 or 2 contiguous words; acquire `locate:false` + throttled JS search; 3-miss salah-prior ayah-1 breakout. Mac 2026-09-18: units 290/290; floor **12/14** (english-negative 20:1, stall-after-lock no_matches); nas **114:1–6** no 4:142; jump **112:1@16.5s**; imam-cold PASS 4:129–130; qiyam FAIL 2:1. Live Simulator recitation not re-measured |
| live-passage-chrome | Island remnants / waveform overlap / gear | **P1 Arabic chrome** after mushaf P0 — `prompts/live-passage-chrome.md`. Translation pane stays off. |
| live-follow | Phase A+B smoothness / expected tape + Phase C bakeoff | **closed this session** — splice 0.25 s, backlog keeps lock, sequential focus, word highlight; follow hops `locate=false` and score remainder+next. Phase C: Tilawa control clocks + skip rate on the same clips; Muno459 NPL-1.1 blocked; default not swapped (`npm run test:bakeoff`) |
| floor | english-negative | **co-P0** — finding `floor-english-negative-20-1`. stall-after-lock `no_matches` also red this session. Jump (`floor-jump-ikhlas`) **closed**. Live shared-tail stall (`live-follow-shared-tail`) **closed** Mac 2026-09-18: nas 114:1–6, fatiha 1:2–7, ikhlas 112:1–4 |
| 04 | hafiz-usama →27:15 (follow/handoff) | **co-P0** — finding `product-hafiz-usama-27-15`. Mac 2026-09-18: **2:1** false lock cleared; stall after **1:7** (no **27:15**; Naml CTC is `الم`) |
| 01 | masjid-e-nabi 25:69≠2:1 | deferred P2 — after follow P0 |
| 02 | ahzab cold 33:62≠33:60 | deferred P2 |
| 03 | baqarah→imran ≠57:28 | deferred P2 |

This pack does **not** claim Mac-green for these clips until the matching algo session measures them. Short mid-surah ready suites (Subayyal / Qiyam) are not a substitute for Fatiha→body handoff.
