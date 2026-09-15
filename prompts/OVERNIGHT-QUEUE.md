# Overnight algorithm queue (post-5674f3e expand score 7/14)

Harness is done. Root-cause order (one session each) — fixing parents also clears inherited suite fails:

1. **nas-last-ayah-stall.md** — complete 114:6 (unblocks nas only)
2. **kawthar-last-ayah-stall-108-3.md** — complete 108:3 (**also clears `jump`**)
3. **asr ayah-1** — lock 103:1 before 103:2 (**also clears `back-to-back`**); use/update `asr-false-lock-51-53.md` → now skip-103:1 not 51:53
4. **quraysh** finish 106:3–4 (after 106:1–2)
5. **longer-ayah1-miss-2-1.md** — Baqarah 2:1 first lock

Regression gates every session: fatiha, ikhlas, falaq, english-negative, basmala-hold, stall-after-lock.
