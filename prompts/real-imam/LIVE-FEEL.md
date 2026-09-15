# Live-feel checklist (manual)

Use when clips exist under `~/Desktop/zikrist-imam-clips/` / `fixtures/real-imam/clips/` or with live mic. Automated Quran gate remains `npm run test:replay -- all` = **14/14**. Salah liturgy is a **separate** track.

| # | Check | Pass | Soft | Fail |
|---|--------|------|------|------|
| 1 | Cold start time-to-first-correct-lock | | | |
| 2 | Mid-surah cold start locks mid-ayah (not forced ayah 1 / wrong surah) | | | |
| 3 | Arabic + English feel in step with audio (qualitative; not a latency SLA) | | | |
| 4 | Mid-ayah pause → resume same ayah | | | |
| 5 | Surah switch / next surah reacquires cleanly | | | |
| 6 | Noise / bleed: hold or soft miss, not surah thrash | | | |
| 7 | After liturgy matcher (when it lands): tilawah still OK | | | |

Do **not** claim imam-ready until `fixtures/real-imam/suites/*.json` clips are on disk and `artifacts/qa-runs/replay-imam-*.json` has been written from real audio. Similarity scores are not percentage certainty.
