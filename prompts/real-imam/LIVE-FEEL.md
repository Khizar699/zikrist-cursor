# Live-feel checklist (manual)

Use when clips exist under `~/Desktop/zikrist-imam-clips/` or live mic. Automated Quran gate remains `npm run test:replay -- all` = 14/14.

| # | Check | Pass | Soft | Fail |
|---|--------|------|------|------|
| 1 | Cold start time-to-first-correct-lock | | | |
| 2 | Mid-surah cold start locks mid-ayah (not forced ayah 1 / wrong surah) | | | |
| 3 | Arabic + English feel real-time with audio | | | |
| 4 | Mid-ayah pause → resume same ayah | | | |
| 5 | Surah switch / next surah reacquires cleanly | | | |
| 6 | Noise / bleed: hold or soft miss, not surah thrash | | | |
| 7 | After liturgy (when salah lands): tilawah still OK | | | |

Do **not** claim imam-ready until `artifacts/recitation/imam/manifest.json` entries are `status: ready` with Mac notes.
