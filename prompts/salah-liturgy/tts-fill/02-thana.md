# Fill: liturgy-thana → ready

Read `_SHARED.md` first.

## Goal

WAV for `liturgy-thana` locking `thana` (full Hanafi istiftah from pack). No Quran verse locks.

## Expect

`expect_phrase_ids: ["thana"]`, empty `expect_quran`, gate `liturgy-phrase`.

## Success

Also bump `HANDOFF.md` in this same PR.

Mac `test:replay -- liturgy-thana` PASS; `all` 14/14; no matcher retune.

## Mac

Founder Mac: `edge-tts` HTTP 403. Working path (same as takbeer):

```sh
export PATH="/tmp/ffmpeg-static:$PATH"   # or any ffmpeg on PATH
npm run liturgy:tts -- liturgy-thana --engine say
```

Voice: **Majed** (`ar_001`). Manifest `clip_path` keeps a stable filename; `say` writes that dest. Verify `test:replay -- liturgy-thana` PASS + `all` 14/14 before merge.
