# No full-mushaf locate while following (freeze + handoff)

## Goal

Cut 2500 ms matching freezes, false Global Search fallbacks, and Fatiha→Ikhlas/Nas lockups after sticky-lock landed.

## Scope

1. **`follow()` never locates the mushaf** — no synchronous `matchFromTranscript(..., true)` / `lockFromTranscript(..., true)` while `phase === 'following'`. Neighborhood `[current−1, current+2]`, then `lockFromNextSurahPool()` (Al-Fatiha, Juz 30, last 20). Unconstrained Global Search only after `startReacquire()`.
2. **Madd / CTC runs** — `expected-tape` collapses 3+ identical letters before `tokenExplainedBy` / `distinctiveUnexplained` so `holdsLock` does not drop on `ييي` / `ااا`.
3. **Last-ayah handoff** — at `atLastAyah`, score `handoffCandidateSurahs` immediately. Short openings (`قل هو الله احد`) commit at ≥0.65 without 3+ long distinctive words.
4. **Grace AND** — `lockGraceExpired()` needs 3 consecutive failed hops **and** >1500 ms. One garbled hop keeps the lock.

## Checks

- Units: no `bestJoint03Match` on last-ayah leftover; madd keeps `holdsLock`; Fatiha→112:1; 3 hops under 1.5 s stay following.
- `npm test` + `npm run typecheck` + Mac `npm run test:replay -- all` (honest N/14).
- Tip product bar: famous-short Ikhlas ordered advance when fixtures present.

## Limits

No `ready` flip. Do not commit wav/mp3. Same-PR `HANDOFF.md` tip + ratchet locks.
