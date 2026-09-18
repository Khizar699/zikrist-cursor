# Sticky lock + indexed Global Search (tracking lag)

## Goal

Cut 2500ms+ match spikes and erratic surah jumps diagnosed on the Debug HUD (`Space Global Search`).

## Scope

1. **Indexed Global Search** — Tilawa `bestJoint03Match` candidate shortlist via inverted bi/trigram postings (not a full 6,236-verse n-gram scan); cap Levenshtein shortlist at 320.
2. **Sticky ayah grace** — require 3 consecutive weak hops **or** >1.5 s of mismatch before dropping lock / allowing global reacquire.
3. **Locked neighborhood** — while mid-surah, score only `[CurrentAyah−1, CurrentAyah+2]`; do not fire Global Search while current-verse words still hold.
4. **Min transcript** — Global Search needs ≥3 words or ≥10 compact characters (block `الله` / `لم يلد` false locks).
5. **Locality bias** — same-surah prior over distant mushaf hits; sequential advance at **0.65+**.

## Checks

- Units: no mid-surah `bestJoint03Match` on weak hops; short `الله` stays on lock; HUD `Locked: Ayahs N–M` uses ±1/+2 window; sequential 112:1→2.
- `npm test` + `npm run typecheck` + Mac `npm run test:replay -- all` (honest N/14).
- Tip product bar: famous-short Ikhlas ordered advance when fixtures present.

## Limits

No `ready` flip. Do not commit wav/mp3. Same-PR `HANDOFF.md` tip + ratchet locks.
