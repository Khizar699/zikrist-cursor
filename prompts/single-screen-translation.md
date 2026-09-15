# Single-screen live translation

## Goal

Make the MVP useful as a translation surface: one screen, no settings/history/language chrome. Show confirmed Arabic and English in a calm, synced layout. Hold a verse until the next ayah is confirmed. Listening is a realtime waveform that morphs into a stop circle.

## Scope

Inspected: `AGENTS.md`, `src/App.tsx`, `src/ui/theme.ts`, `src/services/listening.ts`, `src/services/content.ts`, `src/core/continuation-gate.ts`, `assets/content/quran-display.json` (Tanzil Uthmani), reference screenshot (centered Arabic + serif translation) and waveform still.

In: presentation UI, hold-on-screen policy, plain-Arabic display transform, English pack auto-prepare, README.

Out: deleting recognition/storage/history machinery; prayer-phrase recognition; language switcher; showing unconfirmed/prefetched verses; replacing Tanzil source bytes.

## Assumptions

- English is the only translation for this UI pass; activate it without onboarding.
- Canonical Uthmani JSON stays byte-identical; the screen strips extra Quranic signs for reading.
- Tracker still resets after audio loss; the last confirmed verse stays visible.
- Prefetch remains cache-only. Display changes only on a confirmed different ayah (expected next or recovered jump).
- Microphone still requires an explicit start (circle). Auto-listen stays off.
- No new native modules. Waveform uses Reanimated + Views.

## Files

`src/App.tsx`, `src/ui/{theme,fonts,SyncedVersePanes,ListeningControl}.ts(x)`, `src/core/{arabic-display,display-hold}.ts`, `src/services/listening.ts`, `src/services/content.ts`, `tests/{arabic-display,display-hold}.test.ts`, `README.md`, `VALIDATION.md`, `eslint.config.cjs`.

## Architecture / security

- One capture owner, 16 kHz mono, no audio files in default mode, no uploads.
- Do not run inference or SQLite in render or the audio callback.
- Private storage unchanged. History still recorded locally; it is not shown.

## Acceptance

- App opens on a single translation canvas. No tabs, settings, history, onboarding, or language picker.
- Top half Arabic / bottom half translation, no visible divider, scroll positions linked.
- Arabic is centered plain (tashkeel kept, wasla/pause/small Quranic signs removed). Translation uses a large muted serif.
- Confirmed verse stays until a different ayah is confirmed; prefetched next is not shown early; silence/reacquire does not blank the screen.
- Idle: circle starts listening. Listening: live waveform. Tap bar: morph to circle and stop.
- Typecheck, lint, unit tests. Simulator is not a mosque/mic claim.

## Checks / device tests

`npm run typecheck`, `npm run lint`, `npm run test`. Manual: start/stop morph, long ayah scroll sync, hold across pause, advance only on next confirmed ayah. Physical-device accuracy remains unclaimed.
