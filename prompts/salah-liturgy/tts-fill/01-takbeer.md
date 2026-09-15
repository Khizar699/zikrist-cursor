# Fill: liturgy-takbeer → ready

Read `prompts/salah-liturgy/tts-fill/_SHARED.md` first.

## Goal

Produce 16 kHz mono WAV for suite `liturgy-takbeer` that locks phrase id `takbeer` and **no** Quran `verse_match`. Flip manifest row to `status: ready`.

## Expect

- `expect_phrase_ids`: `["takbeer"]`
- `expect_quran`: `[]`
- Gate: `liturgy-phrase`

## Out of scope

Other suites; matcher retune; UI; imam clips.

## Success

1. Mac: `npm run test:replay -- liturgy-takbeer` PASS (not skip)
2. Mac: `npm run test:replay -- all` still **14/14**
3. Other liturgy stubs may still skip
4. WAV gitignored; manifest updated for this suite only

## Deliverable

Write continuity docs in this same PR: `HANDOFF.md` tip (always); `VALIDATION.md` / queue status when applicable (`prompts/_SHARED-HANDOFF.md`).

Clip path, Mac JSON snippet (`phraseId`, `failureMode`), license note.
