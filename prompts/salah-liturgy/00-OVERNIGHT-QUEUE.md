# Salah liturgy overnight queue (post-14/14 Quran)

Founder priority before real-imam expansion: recognize + show Arabic/English for **salah liturgy** heard around tilawah.

**Hard gate every session:** `npm run test:replay -- all` stays **14/14** on Mac (fffa1f6 baseline). Soft optional: `nas-no-post-end-jump.md`.

Launch **one session at a time**:

1. `01-corpus.md` — immutable phrase pack + English glosses + hashes
2. `02-matcher.md` — offline detect/lock path parallel to Quran follower (no false Quran commits)
3. `03-display.md` — single-screen Arabic + English when liturgy locks
4. `04-replay-suites.md` — headless fixtures + Sim QA gates

Do not mega-merge corpus + matcher + UI in one Cursor session.


## After 03-display
`04-replay-suites.md` + `manifest.stub.json` — stub liturgy replay pack (skip not PASS); Quran all stays 14.

Harness: `npm run test:replay -- liturgy` (alias `salah-liturgy`) skips remaining stubs with `missing_fixture` (not PASS). Ready suites (`liturgy-takbeer`, `liturgy-thana`) need generated WAV. Default `all` stays 14. Staging: `artifacts/recitation/liturgy/<suite-id>/`. Do not commit evaluation audio.


## Next: TTS / clip-fill (stubs → ready)
`prompts/salah-liturgy/tts-fill/00-QUEUE.md` — one suite per session. No imam fill until founder labels locks. Soft: `nas-no-post-end-jump.md`.

`01-takbeer.md`: suite `liturgy-takbeer` is manifest-ready. Mac generates WAV (`npm run liturgy:tts -- liturgy-takbeer`) then `npm run test:replay -- liturgy-takbeer` must PASS; `all` stays 14/14.

`02-thana.md`: suite `liturgy-thana` is manifest-ready. Mac generates WAV (`npm run liturgy:tts -- liturgy-thana`; `--engine say` if edge-tts 403) then `npm run test:replay -- liturgy-thana` must PASS; `all` stays 14/14.
