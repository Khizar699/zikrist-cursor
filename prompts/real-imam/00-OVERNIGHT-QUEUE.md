# Real-imam overnight pack (scaffold)

**Not the Quran hard gate.** Mac `npm run test:replay -- all` stays the original **14/14** EveryAyah suites.

**Not salah liturgy.** Liturgy is a separate track (`prompts/salah-liturgy/`). This pack is live-tilawah / imam-recitation coverage once founder drops clips.

**No real audio in-repo yet.** Founder drops source media in `~/Desktop/zikrist-imam-clips/`. Convert into `fixtures/real-imam/clips/` (gitignored WAV/MP3). Do not invent silent STUB audio. Until files exist, `npm run test:replay -- real-imam` reports `missing_fixture`.

## Commands

```bash
npm run test:replay -- all              # original 14 only (hard gate)
npm run test:replay -- real-imam        # pending pack → missing_fixture until clips
npm run test:replay -- --include-pending  # 14 + pending (will fail until clips)
npm run test:replay -- --list
```

Layout, clip ids, expected-locks schema, suite registration: `fixtures/real-imam/README.md`.

## Queue (one session at a time, after clips exist)

Harness registration is in `prompts/real-imam-coverage-pack.md` (this scaffold). After WAV lands, launch **one** of:

1. `02-mid-surah-cold-start.md`
2. `03-mid-ayah-pause-resume.md`
3. `04-surah-switch.md`
4. `05-noise-speaker-bleed.md`
5. `06-multi-qari-placeholder.md`
6. `07-live-feel-checklist.md` — manual Sim QA / device, not an automated 15th suite

Do not mega-merge follower retunes with dropping audio. Honest `failureMode` after a real clip is a valid result.

`01-fixture-scaffold.md` is the layout contract (implemented under `fixtures/real-imam/`).
