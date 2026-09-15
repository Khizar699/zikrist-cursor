# Fill: liturgy-english-negative → ready

Read `_SHARED.md` first.

## Goal

Dedicated **non-Arabic / English conversation** clip for `liturgy-english-negative`. Gate `no-quran-no-liturgy`: no verse_match and no liturgy lock.

## Forbidden

- Marking ready by pointing at Quran suite `english-negative.wav` without a liturgy-pack decision (prompt forbids reuse as liturgy ready PASS)
- Matcher retune

## Success

Also bump `HANDOFF.md` in this same PR.

Mac `test:replay -- liturgy-english-negative` PASS; `all` 14/14; new clip under `artifacts/recitation/liturgy/liturgy-english-negative/`.
