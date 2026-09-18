# Simulator test 2: Fatiha → An-Nas paint + cold-start locate

## Goal

After Al-Fatihah **1:7**, reciting An-Nas **114:1** must leave **1:7** immediately. Cold start of a salah-prior opening (Falaq `قل اعوذ برب الفلق`) must lock ayah 1 without a 6,236-ayah `bestJoint03Match` spike.

## Scope

1. **`ContinuationGate.accept()`** — at surah end, or incoming `verse_match` ayah **1** of a `salahPrior` surah (last 20 / Juz 30 / Fatiha): accept and set `this.current` immediately. Do not stash in `pending` waiting for `word_progress`. Mushaf-next **2:1** Basmala still waits. Cold-start shared Basmala (no current lock) still waits.
2. **`RecitationFollower.acquire()`** — `transcribe(window, false)` first; `lockShortSurahOpening(..., 1)` at ≥0.65 ayah-1; `commit()` without locate. Only `transcribe(window, true)` if the pool misses.
3. **`Listening.receive()`** — when `verse_match.surah !== current.surah`, clear `passage`, set `pendingDisplay = null`, paint ayah 1 from cache or Arabic preview without waiting for compact-surah translation preload.

## Checks

- Gate: **1:7 → 114:1** paints with no `word_progress` (even unvoiced). **1:7 → 2:1** still held. **112:1** cold Basmala wait unchanged.
- Follower: Falaq opening locks **113:1**, `locate=false`, searches **0**. Shared `الحمد لله` still does not lock **1:2**.
- `npm test` + `npm run typecheck` + Mac `npm run test:replay -- all` (honest N/14).

## Limits

No `ready` flip. Do not commit wav/mp3. Same-PR `HANDOFF.md` tip + ratchet locks.
