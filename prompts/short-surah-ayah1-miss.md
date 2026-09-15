# Short surahs must lock ayah 1 before ayah 2+

## Goal

On kawthar / asr / quraysh replay, first lock must be **ayah 1** of that surah (body after Basmala alignment as designed), not skip into 2 or 3.

## Last Sim QA (9e55c92 / night-report-2152)

| Suite | failureMode | firstLock |
| --- | --- | --- |
| kawthar | sequence_break_at_0_got_108:2_expected_108:1 | 108:2@9.5s |
| asr | sequence_break_at_0_got_103:2_expected_103:1 | 103:2@6.25s |
| quraysh | sequence_break_at_0_got_106:3_expected_106:1 | 106:3@16.75s |

Ikhlas+Falaq GREEN — ayah-1 path works for some shorts; fix the miss pattern without breaking them.

## Constraints

- One concern: **short-surah ayah-1 miss** on acquire/follow start.
- Offline; real ONNX + follower. Do not expand fixtures.
- Read follower ayah-1 / Basmala body matching from 9e55c92; inspect why 108/103/106 skip 1.
- Keep Fatiha work separate if still failing (other prompt).

## Success criteria

1. test:replay kawthar → 108:1 then 108:2–3
2. test:replay asr → 103:1 then 103:2–3
3. test:replay quraysh → 106:1 then 106:2–4
4. ikhlas + falaq stay GREEN; npm test/typecheck/lint pass; refresh JSON

## Deliverable

Commands, JSON paths, files changed, next slice.
