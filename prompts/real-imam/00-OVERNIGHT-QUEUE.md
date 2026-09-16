# Real-imam overnight pack (scaffold only)

**Parallel to salah liturgy** — do not block on clips. Founder will drop recitation videos into `~/Desktop/zikrist-imam-clips/` later.

**Hard gate every session:** Mac `npm run test:replay -- all` stays **14/14** (Quran synthetic fixtures). Soft optional: `prompts/nas-no-post-end-jump.md`. **Continuity docs:** bump `HANDOFF.md` tip in the same PR; update `VALIDATION.md` and queue status when they apply (`prompts/_SHARED-HANDOFF.md`).

## HANDOFF.md (required every PR)

Founder rule: update root `HANDOFF.md` **in the same PR** — what landed, open tracks, gates, restore cmds. A session PR without a HANDOFF bump is **incomplete**.

**P0 elsewhere:** `prompts/salah-liturgy/` (01-corpus in flight). This pack is harness/docs prep only until clips exist.

## Label-fill

**Label-fill:** **01**+#**02** done on main (Subayyal + Qiyam sibling ready). Mid-ayah-pause still blocked; Qunut≠Quran. Queue: `label-fill/00-QUEUE.md`.

**Algo:** founder-clip pack — `prompts/real-imam/algo/00-QUEUE.md`. **01** (masjid-e-nabi **25:69 ≠ 2:1**) is **P0 residual** — Mac `08bce85` still first-locks **2:1@1s** (want **25:69**); jump restored this revision; do not flip noise-bleed `ready`; **do not merge as 25:69 success**. **Do not launch 02** until founder says. Liturgy TTS `tts-fill/03-ruku.md` remains parallel.

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

Suite ids, naming, and `~/Desktop/zikrist-imam-clips/` are defined above and in `01-fixture-scaffold.md` / `FIXTURES.md`. Founder-verified labels (`LABELS.md`, `labels.json`) are ground truth; ignore hypothesized probe locks. Friends restore audio with `npm run fixtures:imam` (GitHub Release zip; see `HANDOFF.md`). The replay runner reads `prompts/real-imam/manifest.stub.json` — `imam-mid-surah-cold` and sibling `imam-mid-surah-cold-qiyam` are `ready`; other suites stay `stub` (see `MANIFEST-NOTE.md`).

```bash
npm run fixtures:imam                # GitHub Release zip → artifacts/recitation/imam/ (also copies Qiyam under the sibling folder)
npm run test:replay -- all           # hard gate: original 14 only
npm run test:replay -- imam-mid-surah-cold        # ready: Subayyal 4:129–130; must PASS after restore (not skip)
npm run test:replay -- imam-mid-surah-cold-qiyam  # ready: Ya-Sin 36:16–18; must PASS after restore (not skip)
npm run test:replay -- real-imam     # ready scores if WAV present; stubs SKIP with missing_fixture (not PASS)
```

Audio staging (gitignored): `artifacts/recitation/imam/<suite-id>/<qari-or-source>/`. No silent STUB WAVs.

