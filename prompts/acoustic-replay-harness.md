# Headless acoustic replay harness + Al-Fatihah fixtures

## Status (2026-09-15 ~21:30 BST)

- LANDED: `npm run test:replay` → `tsx scripts/replay.ts`
- LANDED: Al-Fatihah clips `artifacts/recitation/001001.wav`…`001007.wav` (+ mp3)
- LANDED: JSON under `artifacts/qa-runs/replay-<suite>.json` with `matches`, `firstLockSeconds`, `clocks`, `failureMode`
- Default suites: `fatiha`, `ikhlas`, `nas` (or pass wav paths)
- Uses real ONNX (`onnxruntime-node`) + `RecitationFollower` + `ContinuationGate` (live path)
- CURRENT GATE: Fatiha/Ikhlas still **fail** acoustic acceptance (false early locks). Harness is green as tooling; locate reliability is the next Cursor session.

## Goal


Commit a headless fixture harness Sim QA can run unattended (no founder mic, no Simulator UI audio) that feeds EveryAyah recitation through the real ONNX + follower path and writes machine-readable JSON. Add Al-Fatihah 1:1–1:7 fixtures in the same style as existing Ikhlas/Nas clips. Optional: re-baseline Ikhlas 112:1–4 and Nas 114:1–6 through the same harness.

## Last session / what Sim QA proved (2026-09-15 ~21:01 BST)

- PASS: `npm test` 85/85 (includes Ibrahim 14:39/14:40 Fatiha guards), typecheck, lint, `assets:verify`.
- BLOCKED acoustic re-measure: no committed replay harness (only stale `artifacts/native-replay-*.json` + `benchmark-*.json`).
- BLOCKED Fatiha acoustic: `artifacts/recitation` has Ikhlas 112 + Nas 114 + english-negative only — no `00100x` Fatiha clips.
- Sim has the app + Metro, but cannot ingest another app’s audio; overnight path must be fixture → matcher.

Stale observation only (do not treat as current pass): prior native Ikhlas replay locked 112:1@4.0s → 2@5.5 → 3@7.5 → 4@10.0 on 13.1s audio.

## Constraints

- Offline recognition path only once assets are present (`npm run assets:download` / verify as needed).
- Real ONNX + existing follower (`src/core/follower.ts` and the live Tilawa adapter) — do not fake matches.
- Feed audio as consecutive ~250 ms chunks (match prior desktop replay style).
- One concern this session: harness + Fatiha fixtures (+ optional Ikhlas/Nas re-baseline). Do not polish UI.
- Scores remain similarity scores, not calibrated confidence.
- No physical-device accuracy claims. No Expo Go.
- Private local capture only; harness must not upload audio.
- Read `AGENTS.md` and `VALIDATION.md` before changing recognition code. Prefer a thin Node/tsx script under `scripts/` + `npm run test:replay` over pulling Tilawa tracker internals into the live mic path.

## Area to touch

- New script(s) under `scripts/` (and maybe thin helpers under `src/` if needed for shared decode/locate)
- `package.json` script `test:replay` (or equivalent name — document the exact command)
- `artifacts/recitation/` — add Al-Fatihah EveryAyah/Alafasy-style clips for 1:1–1:7 (wav and/or mp3 consistent with existing 112/114 naming)
- `prompts/acoustic-replay-harness.md`, `README.md`, `VALIDATION.md` — document how to run and what JSON means
- Tests only if they lock harness contracts without requiring GPU/mic

## Out of scope

- UI shell / typography polish
- Live-mic Simulator QA (Sim QA owns that)
- Retuning ONNX model weights
- Mega-refactors of follower unrelated to exposing a headless feed

## Success criteria (JSON gate for Sim QA)

Harness writes JSON shaped like:

```json
{
  "matches": [{"surah": 1, "ayah": 2, "audioSeconds": 1.25, "score": 0.0}],
  "firstLockSeconds": 0.0,
  "clocks": {},
  "failureMode": null
}
```

Acceptance on Al-Fatihah fixture run:

1. First lock = **1:2** (Alhamdulillah / Rabbil Alameen path), **never** 14:39 or 14:40.
2. Then **1:3 … 1:7** in order, each with `audioSeconds`.
3. On wrong surah/ayah or stall, set exact `failureMode` string (not a silent empty matches list).
4. Command is documented and runnable as `npm run test:replay` (or the name you choose — report it).
5. Optional same harness: Ikhlas 112:1–4 and Nas 114:1–6 re-baseline JSON for overnight greening.
6. `npm run typecheck`, `npm run lint`, `npm test` still pass. Update VALIDATION.md with what was and was not measured.

## Deliverable

End the session with: exact run command, sample JSON path, files changed, what proved, what failed, and the next narrow slice if anything remains.
