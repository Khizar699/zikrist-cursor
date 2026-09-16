# Live-feel checklist (manual)

Use when clips exist under `~/Desktop/zikrist-imam-clips/` or live mic.

**Not a substitute for headless Mac verify.** Premade automated standards: `algo/PRODUCT-BAR.md` (Agent verify loop) + `algo/RATCHET.md` (growing locks). Cursor always-on: `.cursor/rules/zikrist-recognition-ratchet.mdc`.

**Regression floor:** `npm run test:replay -- all` = **14/14** when claiming green (honest N/14 if red).  
**Product bar:** first lock alone is not enough; verses must **advance** while audio continues.

| # | Check | Pass | Soft | Fail |
|---|--------|------|------|------|
| 1 | Cold start time-to-first-correct-lock | | | |
| 2 | Mid-surah cold start locks mid-ayah (not forced ayah 1 / wrong surah) | | | |
| 3 | **After lock, next ayahs commit in order** while recitation continues (not stuck on first ayah / 1:2) | | | |
| 4 | Arabic + English feel real-time with audio (display tracks commits, not predictions) | | | |
| 5 | Mid-ayah pause → resume same ayah | | | |
| 6 | Surah switch / Fatiha→body handoff reacquires cleanly | | | |
| 7 | Non-famous / outside last-20 cold start eventually locks (may be slower) | | | |
| 8 | Noise / bleed: hold or soft miss, not surah thrash | | | |
| 9 | After liturgy (when salah lands): tilawah still OK | | | |

Do **not** claim imam-ready until named suites are `status: ready` with Mac notes **and** follow/handoff product-bar concerns for those clips are honest-green. Short 2–3 ayah ready sequences ≠ full prayer follow.
