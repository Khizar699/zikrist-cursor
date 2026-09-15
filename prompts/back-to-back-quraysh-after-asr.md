# Back-to-back: after Asr, start Quraysh 106:1

## Goal

`npm run test:replay -- back-to-back` (Asr then Quraysh concat) must complete **103:1–3** then **106:1–4**. Standalone asr + quraysh are GREEN — this is the **surah transition** after Asr ends.

## Baseline (night-report-2242 @eacf963)

- FAIL back-to-back: `stall_missing_106:1_after_3_matches` (asr OK, no Quraysh)
- Preserve standalone asr + quraysh GREEN

## Constraints

- One concern: **Asr→Quraysh transition** (bounded next-surah pool / fresh locate after last ayah).
- Offline; real ONNX + follower.
- Read replay-back-to-back.json, follower.ts end-of-surah path.
- Keep Basmala-echo 55:1 guard; do not retune Nas/Baqarah in this session.

## Success criteria

1. test:replay back-to-back → 103:1–3 then 106:1–4
2. asr + quraysh standalone stay GREEN
3. npm test pass; open PR (do not merge)

## Inspected (after Nas #3 on main)

- `src/core/follower.ts` last-ayah path: `shortLastAyahFollow` / 5 s accumulate apply while **waiting for** a short last ayah of the current surah (114:5→114:6). They do not fire on 103:3, whose mushaf-next is 104:1.
- 103:3 can lock before 82% coverage (replay: 9.25 s of a 12.5 s clip), so `alreadyComplete` is false when 106:1 starts. Mid-surah mismatch then waits six hops and misses the short 106:1 clip.
- Mushaf-next after 103:3 is 104:1, not 106:1. Shared Basmala leftover must not lock Humazah.

## Files

- `src/core/follower.ts` — leftover after a last-ayah suffix; unexplained leftover on a last ayah pools/locates even before 82% coverage; keep-window reacquire onto the 4 s acquire window when leftover cannot lock yet. Nas last-ayah window and jump guard left intact.
- `tests/follower.test.ts` — leftover 106:1 after 103:3; aged-out opening; Basmala leftover does not lock 104:1; leftover that cannot lock yet cold-starts acquire.
- `README.md`, `VALIDATION.md`, this prompt.

## Architecture / security

- Acquire / follow / reacquire unchanged as phases. Tilawa remains transcribe + index only.
- Predictions still do not display or enter history. Offline only. No uploads, analytics, or lock-bar retunes.

## Checks / device

Headless ONNX replay and unit tests. Not a physical-device, mosque, or battery claim.

## Result

Linux/x64 ONNX after rebase onto Nas #3 (`802bc66`):

- `npm test` 115/115; `npm run typecheck` pass. Lint still reports the pre-existing unused `openingScore` warning.
- `back-to-back` PASS: 103:1@1s, 103:2@8.75s, 103:3@9.25s, 106:1@23s, 106:2@27s, 106:3@31s, 106:4@40.25s; `failureMode` null; `wrongSurahRate` 0.
- Standalone `asr`, `quraysh`, `fatiha`, `nas` PASS (Nas 114:1–6 including 114:6@33.75). Not a physical-device claim.
