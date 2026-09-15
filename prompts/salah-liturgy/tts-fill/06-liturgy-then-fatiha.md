# Fill: liturgy-then-fatiha → ready

Read `_SHARED.md` first. Prefer landing **after** `liturgy-takbeer` + `liturgy-thana` single-suite fills exist (reuse those liturgy WAVs or regenerate only the liturgy prefix here).

## Goal

Concat / playlist: liturgy (`takbeer` then `thana`) **then** EveryAyah Fatiha 1:2–7 WAVs. Gate `liturgy-then-quran`.

## Expect

- Liturgy: `takbeer`, `thana`
- Quran: 1:2–7 ordered (EveryAyah only for Quran half — `quran_clip_placement: after`)

## Forbidden

- Replacing Fatiha with non-EveryAyah without documenting why
- Matcher / follower retune

## Success

Mac `test:replay -- liturgy-then-fatiha` PASS; `all` 14/14.
