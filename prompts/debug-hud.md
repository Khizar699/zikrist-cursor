# Simulator Debug HUD (recitation pipeline)

## Goal

Add a compact, translucent **Debug HUD** on the listening screen so Simulator recitation can show live Tilawa ASR, inference/match latency, lock vs candidate, score, and search space. Diagnose tracking, latency, and surah-switch stalls without covering the bottom waveform pill or a top-right settings/control.

## Scope

Inspected: `src/App.tsx`, `src/ui/{ListeningControl,SyncedVersePanes,theme}.tsx`, `src/services/{listening,model,storage}.ts`, `src/core/{follower,recognition-clocks,types}.ts`, Tilawa timings in `patches/@tilawa+core+0.1.0.patch`, `HANDOFF.md`, `VALIDATION.md`.

Display + local diagnostics only. Do not retune follower lock thresholds, continuation-gate, or Tilawa locate. Do not flip `ready`. Do not commit wav/mov. Scores stay similarity scores, not percent certainty. No remote telemetry of transcripts, tokens, or verse ids.

## Placement

- In-flow card under the Dynamic Island / safe area, above the Arabic stage (`DEBUG_HUD_OVERLAYS_ARABIC = false`). Same compact dark panel, white monospace 10–11px, `pointerEvents: 'none'`. Quran text must not sit behind the card.
- Toggle: Settings sheet (footer text link, not a top-right gear) with a Debug HUD switch. Default on in `__DEV__` when the preference is unset; off in release until enabled.

## Pipeline fields

| Field | Source |
|---|---|
| Inference ms | Tilawa `onnxMs + decodeMs` |
| Match ms | Tilawa `locateMs` plus monotonic time around Zikrist alignment / lock rules |
| Buf ms | Duration of the audio window last sent to Tilawa (`samples / 16 kHz`) |
| Lock vs candidate | `RecitationFollower` lock vs mushaf-next or champion under evaluation |
| Mode | `TRACKING` while following the neighborhood; `ACQUIRING` on first lock; `GLOBAL` on reacquire / Global Search |
| Match score | Similarity used this hop (not a calibrated probability) |
| Misses | Consecutive weak hops / `LOCK_GRACE_FAILS` (3) before dropping lock |
| Search space | `Global Search` while acquiring/reacquiring/locating; `Locked: Ayahs N–M` while following the neighborhood |
| Partial ASR | Raw Tilawa `result.text` (unnormalized greedy decode), last HUD line |

Line layout:

```
Inf [X]ms  Match [X]ms  Buf [X]ms
Lock [S:A]  Cand [S:A]  Mode [TRACKING]
Score [0.00]  Misses [0/3]
Space [Active Range / Global]
ASR: [Raw Arabic text]
```

## Update path

Separate debug store (not `ListeningState`). Throttle UI notifies (~120ms). Verse carousel must not re-render on every inference tick.

## Acceptance

- HUD visible in Simulator `__DEV__` during Listen; Settings can hide it.
- Units lock formatters (buf / mode / misses / ASR last), search-space labels, throttle (latest vs published), in-flow HUD (`DEBUG_HUD_OVERLAYS_ARABIC = false`), and a follower snapshot after 112:1 lock plus misses on two weak hops.
- `npm test` + `npm run typecheck`. No matcher retune. Honest N/14 if replay is run.
- Same-PR `HANDOFF.md` tip bump. `VALIDATION.md`: clocks may appear on the optional HUD.

## Manual

`npm run ios` — Listen, recite Fatiha/Ikhlas; confirm HUD under the island **above** the Arabic (no verse text behind the card), waveform still hittable, panes do not stutter. Not a physical-device claim.
