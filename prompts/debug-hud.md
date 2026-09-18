# Simulator Debug HUD (recitation pipeline)

## Goal

Add a compact, translucent **Debug HUD** on the listening screen so Simulator recitation can show live Tilawa ASR, inference/match latency, lock vs candidate, score, and search space. Diagnose tracking, latency, and surah-switch stalls without covering the bottom waveform pill or a top-right settings/control.

## Scope

Inspected: `src/App.tsx`, `src/ui/{ListeningControl,SyncedVersePanes,theme}.tsx`, `src/services/{listening,model,storage}.ts`, `src/core/{follower,recognition-clocks,types}.ts`, Tilawa timings in `patches/@tilawa+core+0.1.0.patch`, `HANDOFF.md`, `VALIDATION.md`.

Display + local diagnostics only. Do not retune follower lock thresholds, continuation-gate, or Tilawa locate. Do not flip `ready`. Do not commit wav/mov. Scores stay similarity scores, not percent certainty. No remote telemetry of transcripts, tokens, or verse ids.

## Placement

- Overlay: `position: 'absolute'`, pinned under the Dynamic Island / status bar (`top: 60`, `left: 16`, `right: 80`) so it does not sit on the waveform pill or a top-right control.
- Semi-transparent dark panel, white monospace 10–11px, `pointerEvents: 'none'`.
- Toggle: Settings sheet (footer text link, not a top-right gear) with a Debug HUD switch. Default on in `__DEV__` when the preference is unset; off in release until enabled.

## Pipeline fields

| Field | Source |
|---|---|
| Partial ASR | Raw Tilawa `result.text` (unnormalized greedy decode) |
| Inference ms | Tilawa `onnxMs + decodeMs` (`Date.now()` already in the session patch) |
| Match ms | Tilawa `locateMs` plus monotonic time around Zikrist alignment / lock rules |
| Lock vs candidate | `RecitationFollower` lock vs mushaf-next or champion under evaluation |
| Match score | Similarity used this hop (not a calibrated probability) |
| Search space | `Global Search` while acquiring/reacquiring/locating; `Locked: Ayahs N–M` while following the neighborhood |

## Update path

Separate debug store (not `ListeningState`). Throttle UI notifies (~120ms). Verse carousel must not re-render on every inference tick.

## Acceptance

- HUD visible in Simulator `__DEV__` during Listen; Settings can hide it.
- Units lock formatters, search-space labels, throttle (latest vs published), and a follower snapshot after 1:2 lock.
- `npm test` + `npm run typecheck`. No matcher retune. Honest N/14 if replay is run.
- Same-PR `HANDOFF.md` tip bump. `VALIDATION.md`: clocks may appear on the optional HUD.

## Manual

`npm run ios` — Listen, recite Fatiha/Ikhlas; confirm HUD under the island, waveform and any top-right control still hittable, panes do not stutter. Not a physical-device claim.
