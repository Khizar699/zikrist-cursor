# Liturgy TTS / clip-fill queue (flip stubs → ready)

**Depends on:** main `87f65f3`+ (01–04 landed). Manifest: `prompts/salah-liturgy/manifest.stub.json`.

**Hard gate every session:** Mac `npm run test:replay -- all` = **14/14**. Soft optional only: `prompts/nas-no-post-end-jump.md`. **HANDOFF:** bump `HANDOFF.md` in the same PR (`prompts/_SHARED-HANDOFF.md`).

## HANDOFF.md (required every PR)

Founder rule: update root `HANDOFF.md` **in the same PR** — what landed, open tracks, gates, restore cmds. A session PR without a HANDOFF bump is **incomplete**.

**Rules**
- **One suite per Cursor session** — do not mega-fill all clips
- **No** matcher / follower / UI retune — harness + audio + manifest `status: ready` only
- Audio stays **gitignored** under `artifacts/recitation/liturgy/<suite-id>/`
- Never invent silent fake WAVs that would PASS
- EveryAyah WAVs only for the **Quran half** of mixed suites
- Imam clip labeling is **out of scope** until founder pins expected locks

**Launch order**

1. `01-takbeer.md` — **landed:** manifest ready; Mac generates WAV then scores
2. `02-thana.md` — **this session / landing:** manifest ready; Mac `say` Majed (`--engine say`, ffmpeg on PATH) writes the stable clip_path
3. `03-ruku.md`
4. `04-sujood.md`
5. `05-tashahhud.md`
6. `06-liturgy-then-fatiha.md` (needs takbeer+thana clips ready or generate both liturgy halves here only)
7. `07-fatiha-then-takbeer.md`
8. `08-english-negative.md` (dedicated clip — do **not** reuse Quran `english-negative.wav` as liturgy ready)

After each: `npm run test:replay -- <suite_id>` PASS on Mac; other liturgy stubs may still skip; `all` stays 14/14.
