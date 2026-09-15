# Fill: fatiha-then-takbeer → ready

Read `_SHARED.md` first.

## Goal

EveryAyah Fatiha 1:2–7 **then** takbeer liturgy WAV. After 1:7, takbeer must lock as **liturgy**, not a wrong Quran ayah. Gate `quran-then-liturgy`.

## Expect

- Quran first: 1:2–7
- Then `expect_phrase_ids: ["takbeer"]`

## Success

Mac `test:replay -- fatiha-then-takbeer` PASS; `all` 14/14; no wrong-ayah commit for takbeer.
