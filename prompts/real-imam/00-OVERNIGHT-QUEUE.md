# Real-imam overnight pack (scaffold only)

**Parallel to salah liturgy** — do not block on clips. Founder will drop recitation videos into `~/Desktop/zikrist-imam-clips/` later.

**Hard gate every session:** Mac `npm run test:replay -- all` stays **14/14** (Quran synthetic fixtures). Soft optional: `prompts/nas-no-post-end-jump.md`.

**P0 elsewhere:** `prompts/salah-liturgy/` (01-corpus in flight). This pack is harness/docs prep only until clips exist.

Launch **one session at a time**:

1. `01-fixture-scaffold.md` — dirs, naming, empty stubs, manifest schema
2. `02-mid-surah-cold-start.md` — suite + expectations (stub audio OK)
3. `03-mid-ayah-pause-resume.md`
4. `04-surah-switch.md`
5. `05-noise-speaker-bleed.md`
6. `06-multi-qari-placeholder.md`
7. `07-live-feel-checklist.md` — manual Sim QA checklist (no new algorithm)

Do not mega-merge algorithm retunes with harness scaffolding.

## Harness registration (do not duplicate these prompts)

Suite ids, naming, and `~/Desktop/zikrist-imam-clips/` are defined above and in `01-fixture-scaffold.md` / `FIXTURES.md`. The replay runner reads `prompts/real-imam/manifest.stub.json`.

```bash
npm run test:replay -- all           # hard gate: original 14 only
npm run test:replay -- real-imam     # stub suites SKIP with missing_fixture (not PASS)
```

Audio staging (gitignored): convert source media to **16 kHz mono PCM16 WAV** (replay does not read MP3), then place under `artifacts/recitation/imam/<suite-id>/<qari-or-source>/`. No silent STUB WAVs. Until files exist, `npm run test:replay -- real-imam` **skips** with `missing_fixture` (not PASS).

