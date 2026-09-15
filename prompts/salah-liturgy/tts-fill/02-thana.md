# Fill: liturgy-thana → ready

Read `_SHARED.md` first.

## Goal

WAV for `liturgy-thana` locking `thana` (full Hanafi istiftah from pack). No Quran verse locks.

## Expect

`expect_phrase_ids: ["thana"]`, empty `expect_quran`, gate `liturgy-phrase`.

## Success

Mac `test:replay -- liturgy-thana` PASS; `all` 14/14; no matcher retune.

## Mac

If edge-tts 403: `npm run liturgy:tts -- liturgy-thana --engine say` (document voice). Verify `test:replay -- liturgy-thana` PASS + `all` 14/14 before merge.
