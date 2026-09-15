# Expand headless replay suites + fixtures

## Session plan (2026-09-15)

### Goal

Grow `npm run test:replay` coverage beyond Fatiha / Ikhlas / Nas so Sim QA can overnight-score locate+follow on more surahs and edge cases. Add EveryAyah/Alafasy-style fixtures under `artifacts/recitation/` (SSSAAA naming like `108001.wav`) and wire named suites that write the same JSON shape, plus `wrongSurahRate`.

### Scope (one concern)

Harness suite wiring, fixture download/conversion, concat/silence/trim helpers, and docs only. **Do not** retune `RecitationFollower`, acquire/follow thresholds, ContinuationGate, or model weights.

### Inspected

- `scripts/replay.ts` already names `fatiha`, `ikhlas`, `nas`, `kawthar`, `falaq`, `asr`, `quraysh`; default argv-empty list is those seven. Core gates: Fatiha 1:2–1:7 (Ibrahim 14:39/14:40 first-lock special case), Ikhlas 112:1–4, Nas 114:1–6.
- `artifacts/` is gitignored. This checkout had **no** WAVs on disk; do not assume Sim QA’s tree is empty. Restore via `npm run fixtures:recitation` (EveryAyah Alafasy MP3 → 16 kHz mono PCM16 WAV).
- JSON today: `matches[{surah,ayah,audioSeconds,score}]`, `firstLockSeconds`, `clocks`, `failureMode`. Missing `wrongSurahRate`.
- Live-mic feed skips unvoiced frames **inside** the clip (`index < audio.length`) and still feeds trailing pad. Stall silence must be **trailing pad that is fed**, not mid-clip zeros (those would be skipped).

### Assumptions

- `longer` = Al-Baqarah **2:1–5** (`002001`–`002005`), not Mulk 67:1–3.
- `jump` = Kawthar then Ikhlas. `back-to-back` = Asr then Quraysh (distinct from jump).
- `english-negative` inverted gate: PASS only if **no** verse commits; `failureMode` if any lock.
- `basmala-hold`: `001001` alone must not lock 1:1 or any other verse.
- `cold-start-mid`: trim first 0.75 s of `002002.wav` (unique longer ayah).
- `stall-after-lock`: `112002` + 4 s trailing silence that **is** fed; keep last verse / no jump.
- Honest `failureMode` is success for this session if the current algorithm fails a suite.
- Evaluation audio stays gitignored; the download script is the committed fixture path.

### Files

- `scripts/replay-suites.ts` (blueprints, gates, PCM helpers, `wrongSurahRate`)
- `scripts/replay.ts` (ONNX + follower feed; suite CLI)
- `scripts/download-recitation-fixtures.ts`
- `tests/replay-suites.test.ts`
- `package.json`, `README.md`, `VALIDATION.md`, `THIRD_PARTY_NOTICES.md`
- This prompt

### Architecture / security

- Real ONNX CPU + `RecitationFollower` + `ContinuationGate` (same as live). No fake matches.
- One serialized feed loop; no overlapping session mutation.
- Evaluation clips are not app assets and are not uploaded. EveryAyah URL ≠ redistribution grant.
- Private local capture only; harness writes `artifacts/qa-runs/` only.

### Acceptance

1. `npm run test:replay -- <name>` writes `artifacts/qa-runs/replay-<name>.json` including `wrongSurahRate`.
2. Default / `all` runs core + new suites; `core` keeps fatiha/ikhlas/nas.
3. Fixtures downloadable for every suite; inverted/hold/stall gates as specified.
4. `npm test`, `npm run typecheck`, `npm run lint` pass.
5. No follower/threshold edits.

### Checks / manual

- Unit tests for gates, SSSAAA names, trim/concat (no ONNX).
- `--check-fixtures` for presence without inference.
- Optional real `test:replay` if model + WAVs are present; report honest `failureMode`.
- Cloud/Linux agents without `assets/model/*.onnx` still ship harness + `tests/replay-suites.test.ts`. Acoustic overnight scoring is Sim QA on Mac.
- Not a physical-phone or mosque measurement.

---

## Original prompt

## Goal

Grow `npm run test:replay` coverage beyond Fatiha / Ikhlas / Nas so Sim QA can overnight-score locate+follow on more surahs and edge cases. Add EveryAyah/Alafasy-style fixtures under `artifacts/recitation/` (SSSAAAayah naming like `108001.wav`) and wire named suites that write the same JSON shape.

## Last session / context

- Harness exists: `npm run test:replay` → `tsx scripts/replay.ts`; core Fatiha `001001`–`001007`, Ikhlas `112*`, Nas `114*` present.
- CYCLE 2 (false-early-acquire) may be landing in parallel — do **not** retune acquire/follow algorithm in this session. If a suite fails acoustically, still ship fixtures + suite runners with honest `failureMode`.
- Sim QA scores only; this session owns fixtures + harness suite wiring + docs.

## Constraints

- Offline recognition path; real ONNX + RecitationFollower (same as live). Do not fake matches.
- One concern: **expand suites/fixtures**. No UI polish. No model weight retuning. No phone/mic latency claims.
- Keep existing core suites: fatiha 1:2–1:7 gate, ikhlas 112:1–4, nas 114:1–6.
- Naming: SSSAAA (e.g. `108001.wav` / `.mp3`) consistent with existing clips.
- JSON per suite: `matches[{surah,ayah,audioSeconds,score}]`, `firstLockSeconds`, `clocks`, `failureMode`, plus `wrongSurahRate` or count of wrong-surah first locks.
- Read `AGENTS.md`, `VALIDATION.md`, `scripts/replay.ts`, existing `artifacts/qa-runs/replay-*.json`.

## Suites to add

1. `kawthar` — 108:1–3  
2. `falaq` — 113:1–5  
3. `asr` — 103:1–3  
4. `quraysh` — 106:1–4  
5. `longer` — baqarah 2:1–5 **or** mulk 67:1–3 (pick one; document)  
6. `jump` — kawthar then ikhlas (concatenated audio)  
7. `english-negative` — expect **no** verse locks; `failureMode` if any verse commits  
8. `basmala-hold` — `001001` alone must **not** lock 1:1 or a wrong surah  
9. `back-to-back` — e.g. asr→quraysh or kawthar→ikhlas  
10. `cold-start-mid` (if feasible) — trim first ~0.5–1s of a unique ayah clip  
11. `stall-after-lock` — after first correct lock, insert ~3–5s silence; must keep last verse / not jump  

## Area to touch

- `artifacts/recitation/` — new clips  
- `scripts/replay.ts` (+ helpers if needed) — suite names, concat/silence/trim, default all-suites run  
- `package.json` only if script flags need documenting  
- `README.md` / `VALIDATION.md` — `npm run test:replay -- <suite>` and default all-suites  
- `prompts/expand-replay-suites.md`

## Out of scope

- Fixing false early acquire / follower bugs (CYCLE 2 / later algorithm prompts)  
- Live-mic Simulator work  
- UI

## Success criteria

1. Each new suite runnable: `npm run test:replay -- <name>` writes JSON under `artifacts/qa-runs/`.  
2. Default / all-suites command documented and runs core + new suites.  
3. Fixtures present for every suite that needs audio; english-negative + basmala-hold + stall-after-lock behave as specified in harness expectations (even if algorithm currently fails — report via `failureMode`).  
4. `npm test`, `npm run typecheck`, `npm run lint` still pass.  
5. Deliverable: suite list, commands, sample JSON paths, what proved/failed, next slice for algorithm prompts.

## Deliverable

Exact commands + files changed + note which suites are fixture-ready for Sim QA scoring tonight.
