# Faster live translation display

> **Deferred as a translation prompt.** Keep the recognition speed work; do not treat painted translation as the session goal. Current MVP: lock + follow + Arabic mushaf (`prompts/mushaf-first-mvp.md`).

## Goal

Live listening should show the confirmed verse translation as recitation is identified, with first location aimed at about 1–2 seconds of audible Quran. Do not display unconfirmed candidates as translation or history.

## Scope

Inspected: `src/services/listening.ts`, `src/services/model.ts`, `src/core/continuation-gate.ts`, `src/core/audio-queue.ts`, `@tilawa/core` tracker/session, VALIDATION.md (desktop first location at 4.0 s).

Root causes:

1. Discovery used a 2 s trigger and 2 repeat cycles, so Tilawa rarely committed before ~4 s of speech.
2. ContinuationGate also held the *first* live `verse_match`, adding another 0.5 s+ of voiced progress after Tilawa had already confirmed.
3. Checking an unexpected jump cleared `current`, so the translation disappeared during following.
4. The audio callback notified React on every 250 ms buffer, competing with serialized inference on the JS thread.

Keep the jump guard (the 74:29 trailing-silence false commit). Keep serialized/bounded capture. Never seed verses.

## Files

`src/core/streaming.ts`, `src/core/continuation-gate.ts`, `src/services/{model,listening,content,replay}.ts`, `scripts/benchmark.ts`, `tests/continuation-gate.test.ts`, `VALIDATION.md`, `README.md`.

## Acceptance

- First *voiced* Tilawa `verse_match` can display immediately; silence-flush first matches and unexpected jumps still need fresh voiced progress.
- Expected next verse remains the fast path.
- Jump checks must not blank a confirmed translation.
- Live streaming config: ~1 s discovery trigger, 1 repeat cycle, 0.25 s tracking trigger, `deferred_confirm`.
- Audio-callback UI updates are throttled. Capture-gap detection ignores small timestamp jitter.
- Tests cover the gate cases. Typecheck/lint/tests run. Simulator is not a physical-device latency claim.
