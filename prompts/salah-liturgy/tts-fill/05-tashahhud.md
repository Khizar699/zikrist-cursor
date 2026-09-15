# Fill: liturgy-tashahhud → ready

Read `_SHARED.md` first.

## Goal

WAV for `liturgy-tashahhud` locking `tashahhud` (Ibn Masʿūd pack wording). `allow_partial_liturgy: true` — document if only a milestone locks; prefer full phrase when TTS allows.

## Success

Write continuity docs in this same PR: `HANDOFF.md` tip (always); `VALIDATION.md` / queue status when applicable (`prompts/_SHARED-HANDOFF.md`).

Mac `test:replay -- liturgy-tashahhud` PASS under documented partial/full rule; `all` 14/14; no matcher retune.
