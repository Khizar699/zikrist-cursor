# Queue post-eacf963 (10/14)

1. **nas-last-ayah-stall.md** — finish 114:6; never jump 7:1 (merged #3)
2. **longer-ayah1-miss-2-1.md** — Baqarah 2:1 first (agent in flight)
3. **jump-ikhlas-after-kawthar.md** — after 108:3 lock 112:1–4
4. **back-to-back-quraysh-after-asr.md** — after 103:3 lock 106:1–4 (PR in flight)

Gates every session: fatiha, ikhlas, falaq, asr, kawthar, quraysh, english-negative, basmala-hold, cold-start-mid, stall-after-lock.


**Continuity docs:** bump `HANDOFF.md` tip in the same PR; update `VALIDATION.md` and queue status when they apply (`prompts/_SHARED-HANDOFF.md`).

## Next priority (founder)
Salah liturgy overnight: `prompts/salah-liturgy/00-OVERNIGHT-QUEUE.md` (after 14/14 Quran). Soft optional: `prompts/nas-no-post-end-jump.md`.


## Parallel (scaffold): real-imam
`prompts/real-imam/00-OVERNIGHT-QUEUE.md` — stubs until clips in `~/Desktop/zikrist-imam-clips/`. Harness: `npm run test:replay -- real-imam` skips (`missing_fixture`, not PASS). Default `all` stays 14. Does not block salah liturgy P0.

## HANDOFF.md (required every PR)

Founder rule: update root `HANDOFF.md` **in the same PR** — what landed, open tracks, gates, restore cmds. A session PR without a HANDOFF bump is **incomplete**.
