# Last-ayah handoff without mushaf freeze (carousel + locate)

## Goal

Stop the 1986 ms Match spike at surah end, and paint the new surah as soon as the follower commits it. Simulator recitation stayed on **109:6** while the engine locked **105:5** then **108:3**.

## Scope

1. **`follow()` never calls `lockFromTranscript(..., true)` / `bestJoint03Match` on the follow hop.** Last-ayah leftover and grace use `lockFromNextSurahPool()` (salah prior / Juz 30 / last 20). Global Search only after `startReacquire()`.
2. **Ayah-1 openings** of those short surahs (Al-Fil `ألم تر كيف`, Al-Kawthar `إنا أعطيناك`, Ikhlas `قل هو الله احد`) commit at ≥0.65 token match. Do not snap to the last ayah of the new surah.
3. **UI** — `shouldReplaceHeldVerse` is true when `confirmed.surah !== displayed.surah`. `Listening.receive()` applies `verse_match` before `word_progress`, clears stale `wordProgress`, and preloads the new surah. ContinuationGate accepts a voiced last-ayah / salah-pool surah change immediately (not as a discarded 500 ms jump). Mushaf-next Basmala still waits for unique body words. Long unrelated jumps (e.g. 2:109) still need extra evidence.

## Checks

- Units: Kafirun **109:6** leftover `الم تر كيف` → **105:1** not **105:5**, searches 0; then `انا اعطيناك` → **108:1**. Grace reacquire still searches 0. Display-hold and gate: 109:6→105:1 paints.
- `npm test` + `npm run typecheck` + Mac `npm run test:replay -- all` (honest N/14).
- Tip product bar: famous-short Ikhlas ordered advance when fixtures present.

## Limits

No `ready` flip. Do not commit wav/mp3. Same-PR `HANDOFF.md` tip + ratchet locks.
