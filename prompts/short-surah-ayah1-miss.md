# Short surahs: lock ayah 1; Asr must not false-lock 51:53

## Goal

kawthar / asr / quraysh replay must first-lock the correct surah **ayah 1**, then follow in order. Asr must never first-lock **51:53**.

## Last Sim QA (52f4cb4)

| Suite | failureMode | firstLock |
| --- | --- | --- |
| kawthar | sequence_break…108:2 expected 108:1 | 108:2@9.5s |
| quraysh | sequence_break…106:3 expected 106:1 | 106:3@16.75s |
| asr | sequence_break…51:53 expected 103:1 | **51:53@14.25s** (wrong surah) |

Keep Fatiha + Ikhlas GREEN; restore Falaq is a separate prompt if still failing.

## Constraints

- One concern: **short-surah open** (ayah-1 miss + Asr wrong-surah).
- Offline; real ONNX + follower. Unique-token rescue / ayah-1 body matching without distant champions.
- Read follower.ts, replay-{kawthar,asr,quraysh}.json.

## Success criteria

1. kawthar → 108:1–3
2. asr → 103:1–3; never 51:53
3. quraysh → 106:1–4
4. fatiha + ikhlas GREEN; npm test/typecheck/lint; refresh JSON

## Deliverable

Commands, JSON paths, files changed, next slice.
