# Live-feel checklist (manual Sim QA)

## Goal

Manual checklist for founder / Sim QA when clips or a live reciter are available. **Not** a 15th automated `test:replay -- all` suite. No algorithm work in a docs-only pass.

Automated Quran gate remains `npm run test:replay -- all` = 14/14. Salah liturgy is a separate track; row 7 is N/A until matcher/display exist.

Copy-paste grid: `prompts/real-imam/LIVE-FEEL.md`.

## Checklist themes

1. Time-to-first-correct-lock (cold + mid-surah)
2. Scroll/display sync feels live (Arabic + English) — qualitative, not a claimed acoustic latency
3. Pause mid-ayah → resume without wrong surah flash
4. Surah switch / next surah in a session
5. Noise / bleed: hold or soft miss, not surah thrash
6. After liturgy (when salah matcher lands): takbeer/thana then tilawah still OK
7. Never claim “imam-ready” until named suites have on-disk WAV + notes in `artifacts/qa-runs/`

## Constraints

Manual only. Scores stay similarity scores. Not a mosque, battery, or locked-screen measurement unless those rows are actually exercised on a physical phone.
