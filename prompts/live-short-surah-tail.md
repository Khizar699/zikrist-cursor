# Live short-surah tail (iPhone 17 sim, 2026-09-18)

**Status: done** (Mac units + `ikhlas`/`fatiha`/`nas`/`jump` replay; live Simulator recitation not re-measured). Finding `live-ikhlas-stall-112-3` closed.

## Goal

On live listening, after a short surah locks, the **focused ayah must stay fully readable** and the **next recited ayah of that same surah must take focus** while audio continues. Do not freeze on **112:2** or a clipped **1:7**.

This is the next Tip after the founder ReplayKit recording `Screen Recording 2026-09-18 at 2.37.33 pm.mov` (iPhone 17 Simulator, 115 s, real recitation into the mic). Finding `live-ikhlas-stall-112-3`. Clip class: `famous-short`. Concern: **follow / display of the focused row**, not acquire-only and not Hafiz Usama **27:15**.

Mac EveryAyah `ikhlas` already PASSes **112:1–4**. Live mic on this recording did not. Do not “fix” by weakening floor expects.

## Recording timeline (do not invent extra ayah labels)

ReplayKit, clock 2:38–2:40. Three listen sessions (stop → start between them). Heard-words acquire worked.

| t | Audio | On screen | Issue |
|---|--------|-----------|--------|
| 0–1 s | leftover Nas UI, then Stop | 114:2–4 from the previous listen | — |
| 2–6 s | voiced ~2.75–5.5 s | heard words `الحمد لله` (no translation) | acquire OK |
| 7–14 s | voiced | 1:2 dim, **1:3** focused; no 1:4 lookahead | parked on 1:3 ~7 s |
| 15–17 s | voiced | 1:3→1:4→1:5 | advance OK |
| 18–23 s | voiced | 1:5 dim, **1:6** focused; 1:7 translation peeks **under the waveform** | footer overlap |
| 24–52 s | voiced 24.5–34 s and 38.5–49 s | **1:6** dim, **1:7** focused the whole time | **1:7 Arabic clipped** after `عليهم غن`; **English clipped** after `incurred`; next surah never appeared (~28 s on 1:7) |
| 53–55 s | Stop | 1:7 remains | — |
| 56–59 s | start + Basmala/Ikhlas | empty waveform | — |
| 60–71 s | voiced 62–68 s | Basmala + **112:1** dim + **112:2** focused; **no 112:3–4** | stall + missing lookahead |
| 73–78 s | start + `قل أعوذ` | heard words grow `قل أعوذ` → `قل أعوذ برب` | acquire OK |
| 79–91 s | Nas | 114:1–5 follow, including 114:6 lookahead | Nas follow OK; remnants under island; one garbled 114:4 dim row |
| 92–102 s | voiced through 114:6 then new burst ~100 s | **114:6** focused | last-ayah hold while new audio starts |
| 105–114 s | voiced 106–111 s | Ikhlas **112:1** dim, **112:2** focused, **112:3** dim lookahead; never **112:4** focus | stall on 112:2 **again** (lookahead present this time) |

Do **not** name the post-1:7 body surah. Voiced audio continued after 1:7 was already focused; no new surah displayed. Do **not** commit the `.mov`.

## Issue inventory (this recording)

**P0 — this prompt**

1. **Ikhlas freeze on 112:2** (twice). First listen: 112:3–4 absent from the passage. Second: 112:3 visible dim, focus never moved; 112:4 never focused. Recitation continued.
2. **Fatiha 1:7 unreadable.** Focused row clips mid-ayah: Arabic stops around `عَلَيْهِمْ غَن` (missing `غير المغضوب… ولا الضالين`); English stops at `incurred` (missing wrath / astray). Dual `FlatList` + `paddingVertical ≈ 38%` pane height + 40/32 pt type cannot show a long focused row above the waveform.
3. **Parked on 1:7 ~28 s** while voiced audio continued. Same live class as stall-after-Fatiha (do not retune Hafiz Usama **27:15** here).

**P1 — next prompt, not this session**

4. Previous-ayah **fragments under the Dynamic Island** (`نستعين`, Basmala `الرحيم` as `ارييم`, `الذي يوسوس في`). `scrollToIndex` `viewPosition: 0.5` leaves the prior row hanging in the inset.
5. **Waveform covers** the next translation (1:7 peek at t=18).
6. Top-right **circular gear overlaps Basmala / Arabic**. Not in current `src/App.tsx` — treat as Expo/dev chrome or a stale binary; if it is product settings, it must not cover Quran text.
7. Dim lookahead Arabic can look **garbled** (114:4 at t=81).

**P2 / copy**

8. Live translation shows Tanzil **footnote markers** `[1][2][3]` inline. Preserve footnotes in content; they do not need to be the live reading line.
9. No surah name / ayah number, so a stall is hard to diagnose on device.
10. User had to **Stop/Start** between Fatiha, Ikhlas, and Nas because follow froze.

**What worked (do not regress)**

- Heard-words before lock (`الحمد لله`, `قل أعوذ…`).
- Fatiha 1:2→1:6 ordered focus (after the 1:3 pause).
- Nas **114:1–6** live follow, including last ayah 114:6.

## Last session proved / failed

- Live follow Phase A+B+C landed. Default stays Tilawa. Mac `ikhlas` **112:1–4**, `fatiha` **1:2–7**, `nas` **114:1–6**. Floor **13/14** (`english-negative`).
- `passageWindow` already **drops** uncached neighbors (`tests/passage.test.ts` “focused ayah remains if neighbors are not cached yet”). Live first Ikhlas lock matches that: `content.peek` has 112:1–2, `hasVerse` is mushaf-true, lookahead **breaks**. Second Ikhlas listen in the same process had 112 cached, so 112:3 appeared — and **still** did not take focus.
- `cachedNeighborhood` uses `hasVerse` → arabic table, `peek` → SQLite cache. `preloadNeighborhood` is async after lock (`listening.ts`). Short surahs must not wait on that race to list remaining ayahs.
- Word highlight does not explain clipped **1:7 English** (translation is the full string, not heard-words).

## HANDOFF.md (required every PR)

Update root `HANDOFF.md` in the same PR (`prompts/_SHARED-HANDOFF.md`). Record product-bar fields from `PRODUCT-BAR.md`. Ratchet: `RATCHET.md`.

## Constraints

- **One concern:** live short-surah **tail** — remaining ayahs of the locked surah take focus, and the focused row is fully on screen. No mega-refactor.
- Offline ONNX; no suite-ID hardcodes; no liturgy retune; no `ready` flip; do not commit wav/mp3/mov.
- Keep Mac `npm run test:replay -- all` honest **N/14**. Do not weaken `ikhlas` / `fatiha` / `nas` expects.
- Predictions are not history. Sequential focus may move; `verse_match` still owns occurrences.
- Do not name an unlabelled body surah after 1:7. Do not treat famous-short EveryAyah green as this live bug being gone.

## Area to touch

- `src/core/{follower,passage,sequential}.ts` — leftover after 112:2 / short next; passage must not silently drop same-surah neighbors the mushaf already has once those rows can be built.
- `src/services/{content,listening}.ts` — first lock of a short surah must cache the **rest of that surah** before painting a 1–2 ayah passage (or rebuild the window when preload finishes).
- `src/ui/SyncedVersePanes.tsx` + `theme.ts` — focused long ayah (1:7) fully visible in both panes; do not hide it under the waveform.
- Tests: `tests/{follower,passage,sequential-display}.test.ts` (and a display/content test for the cache race). No verse-ID special cases for 112 or 1:7 beyond using them as examples in generic short-surah / long-row tests.

```bash
npm test
npm run typecheck
npm run test:replay -- ikhlas fatiha nas all
```

## Out of scope

- `04-hafiz-usama-1-2-vs-27-15.md` / finding `product-hafiz-usama-27-15` (keep that prompt).
- Floor `english-negative`.
- Island remnants, gear overlap, footnote chrome, ayah numbers (P1/P2).
- Manifest `ready`; other algo clips; engine swap.

## Success criteria

1. Unit: after a 112:2 lock, leftover distinctive 112:3 tokens (`لم` / `يلد` / `lam` / `yalid`) commit **112:3**, then 112:4 tokens commit **112:4**. Shared `الله` alone must not skip 112:3.
2. Unit: a short-surah focus whose later ayahs exist in the mushaf but are not yet in the display cache still **lists them once cached**, and the first lock path does not paint a tail-less Ikhlas/Fatiha window across a listen. Replace or tighten the “neighbors not cached → only focus” behavior for short surahs; do not leave live Ikhlas as 112:1–2 only.
3. Focused **1:7** shows the full approved Arabic and English (wrath / astray present). Layout test or honest Simulator note plus a content/UI contract that the focused row is not clipped by pane padding/footer.
4. Mac: `ikhlas` still **112:1–4**; `fatiha` **1:2–7**; `nas` **114:1–6**; `all` honest N/14. Product bar: ordered advance on those clips, not `phase: following` alone.
5. **Ratchet lock same PR.** Tip known-fails: `live-ikhlas-stall-112-3` shrinks only when locked. Do not claim physical-device green from Simulator.

## Checks and device tests

Agent verify loop in `PRODUCT-BAR.md`. Reload Metro (and rebuild if UI native layout changed) before asking the founder to re-recite Ikhlas then Fatiha. Manual: recite Ikhlas without stopping — focus must reach **112:4**; recite Fatiha — **1:7** must be fully readable, then a following short surah may take focus (do not invent which one).

## Deliverable

PR + HANDOFF tip + unit/replay JSON. Mark this prompt done in `prompts/real-imam/algo/00-QUEUE.md`. Next open track: P1 live chrome (`prompts/live-passage-chrome.md`) **or** existing co-P0 floor / Hafiz Usama.
