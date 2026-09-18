# Phantom surah jump / reacquire freeze

**Status: done this session** (Mac units + replay; live Simulator recitation not re-measured).

## Goal

Stop prayer follow from snapping into a mid-surah or last-ayah of another surah (Nas trail **4:142**, **112:4**, **113:5**), refuse 1-token hallucinations, never run Tilawa `locate:true` on the acquire/reacquire audio loop, and break a wrong-surah deadlock when Misses hit 3/3 and ayah 1 of a salah-prior surah is already in the window.

## Constraints

- Handoffs target ayah 1 (or ayah 2 only when ayah 1 is unusable Basmala). Do not scan `famous` / `last20` bodies.
- New-surah lock: opening ≥0.70 **or** two contiguous ayah-1 body words. Not `نيم` / `وان المهتدين`.
- Acquire transcribes `locate: false`. Salah-prior pool first. JS `bestJoint03Match` is hop-throttled; never a second `transcribe(..., true)`.
- Cold mid-surah first-lock (4:129) still allowed when `priorSurah` is null.
- No `ready` flip; do not commit wav/mp3.

## Ratchet

Units in `tests/follower.test.ts`: refuse 4:142 / 112:4 / 113:5 handoffs; 1-token refuse; Fil **105:1** breakout without 1.5 s; acquire locate flags stay `[false]`; cold 112:2 via throttled JS search; Ya-Sin 36:16 lookback must not steal 2:1.

## Mac verify (2026-09-18)

- `npm test` **290/290** + typecheck.
- Floor `npm run test:replay -- all` = **12/14 FAIL** — `english-negative:verse_lock_20:1`, `stall-after-lock:no_matches`. nas **114:1–6** with no 4:142; jump **112:1@16.5s–4**.
- `imam-mid-surah-cold` PASS **4:129@11s → 4:130@19.5s**.
- `imam-mid-surah-cold-qiyam` FAIL **2:1@5.5s** (want **36:16**).
