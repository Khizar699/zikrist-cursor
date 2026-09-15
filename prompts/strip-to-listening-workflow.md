# Strip Zikrist to the live listening workflow

## Goal

Keep only the measurable recognition path: microphone capture, verse location, Arabic + translation display, and stop. Remove features, files, diagnostics, and packages that are not required for that path or for the algorithms that support it.

## Scope

In:

- Live capture, 16 kHz mono PCM, serialized inference, acquire/follow/reacquire, continuation guard, sequential display, passage window, Basmala hold, translation pack activation, listen/stop UI.
- Tests for those algorithms. Asset download/verify. Native run scripts. Tilawa/ONNX and the listen control.

Out:

- Session history persistence, local audio saving, auto-listen, fixture replay, desktop benchmark, unused diagnostic fields, unused fonts/packages, Amiri leftovers.

## Inspected

`src/App.tsx`, `src/services/{listening,storage,content,model,replay}.ts`, `src/core/*`, `src/ui/*`, `package.json`, `app.json`, `README.md`, `VALIDATION.md`, `assets/manifest.json`.

## Assumptions

- English still auto-installs. A previously saved Urdu pack may remain the active language; there is still no language picker.
- Locked-screen continuation of an already-started session stays (Android notification + keep-awake).
- Predictions still must not become confirmed matches. Sequential next-ayah display is visual only.

## Files

Delete: `src/services/replay.ts`, `src/core/wav.ts`, `scripts/benchmark.ts`, unused Amiri license/manifest entries.

Slim: listening, storage/schema, types, App, model, content, display-hold, passage, package.json, app.json, notices, README, VALIDATION.

## Architecture / security

No audio files. No session/occurrence tables. Microphone permission copy must not mention recording. Keep backup-exclusion plugin for remaining private files (settings, packs).

## Acceptance

- UI: listen, locate, show verse + translation, stop.
- No history APIs, replay, save-audio, or unused native packages in app code.
- `npm run typecheck`, `lint`, `test`, `assets:verify`.

## Checks / device

Automated checks above. Physical microphone/lock-screen tests are still required separately; this pass does not claim them.
