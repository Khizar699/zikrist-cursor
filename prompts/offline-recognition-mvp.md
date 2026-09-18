# Offline recognition MVP

> **Historical prompt.** The current product slice is **mushaf follow**, not live translation. See `AGENTS.md` and `prompts/mushaf-first-mvp.md`. Do not implement language-pack onboarding, English/Urdu display, or history UI from this file until Tip says mushaf tracking is confident.

## Authorization and goal

The user approved building the MVP and supplied an AGENTS.md reference. Create Zikrist's project instructions and implement a real offline mobile pipeline: microphone → Quran localization/tracking → local English/Urdu translation, with history and diagnostics. Existing approval covers this implementation.

## Inspected material

- Empty application repository containing `Zikrist-research.md`.
- Supplied biasly instruction reference, adapted for mobile rather than copied literally.
- Tilawa 0.1.0 API/source and v0.2.0 model metadata.
- Current Expo, ONNX Runtime and audio package documentation; installed package APIs must be checked before use.
- Local Xcode and iOS simulator exist; Android SDK is not yet found.

No application-specific skill is required for this initial native mobile task. Use official package docs and installed types; no missing biasly skills are assumed.

## Scope and decisions

- React Native/Expo with TypeScript and native builds; keep dependencies narrow.
- Implement a quiet, readable interface with onboarding, listening, history, settings and diagnostic detail.
- Use Tilawa as an adapter-backed candidate engine. Verify model files, input format and package types.
- Implement genuine live PCM capture with a bounded serialized inference queue and observable error states.
- Prioritize the next verse after lock; maintain repeated-verse and jump recovery. Display confirmed events only.
- Download one language during setup from a documented source, preserve attribution/version/footnotes and use atomic install. English and Urdu choices; two-language cap.
- Persist ordered local sessions and preferences.
- Default audio is transient. Implement retention only if a single microphone path can safely support it; otherwise expose it as unavailable without a misleading toggle. No training uploads.
- No accounts, Supabase provisioning, analytics, AI stories, fabricated Quran/prayer-phrase recognition, or deployment.

## Likely files and architecture

`AGENTS.md`, `prompts/`, `README.md`, `package.json`, Expo/Metro/TypeScript config, `src/audio`, `src/recognition`, `src/content`, `src/storage`, `src/components`, `src/screens`, `scripts`, `tests`, and licensed `assets`/notices. Generated native build directories and large reproducible model files may be ignored in Git and restored by documented commands.

## Visual interpretation

Create a restrained prayer companion: warm ivory background, deep forest green primary controls, muted gold accents, generous breathing room, readable Arabic and translation typography, an unobtrusive waveform driven by real input, and a fixed clearly labeled listening control. Support narrow phone screens, safe areas, dynamic type and Urdu RTL. Avoid synthetic populated history or fake confidence results. Diagnostics belong in a dedicated expandable/testing view.

## Security and correctness

Permission precedes capture. Recording and contribution are separately consented, off by default. Never persist raw audio merely to obtain background privileges. No network during inference. Settings/history failures are surfaced. Downloads use HTTPS, input validation and checksums where authoritative values exist. Preserve canonical Quran and licensed translations. Release clearance is tracked separately from evaluation use.

## Acceptance criteria

1. Native application builds on the available iOS toolchain and JavaScript exports for Android.
2. No mock recognition: real acoustic model accepts microphone PCM and emits Quran matches.
3. Confirmed matches render canonical Arabic, surah/ayah and installed translation; ambiguous input shows waiting.
4. Capture can stop cleanly, with no overlapping inference or late events mutating a stopped session.
5. Sessions preserve repeated occurrences and survive restart.
6. English/Urdu setup and settings handle download errors and retain working content.
7. Default capture writes no audio; permissions and retention behavior are clear.
8. Tests cover buffering/recovery, corpus integrity and ordered-event behavior. Type/lint checks pass.
9. Document measured checks and unverified physical-device/background/mosque performance honestly.

## Checks and manual testing

Run typecheck, lint, behavior tests, asset verification, native export, iOS build and simulator inspection where available. If useful, add a command-line model benchmark using an actual rights-identified audio fixture. This is an integration check, not a mobile accuracy benchmark.

Manual device test: install a native release/development build, select one language and finish setup, grant microphone permission, recite or play a known passage from another device, verify surah/ayah and translation, repeat an ayah, jump to another surah, stop, inspect history, restart offline, and repeat. Test screen lock/unlock and OS interruptions separately. Do not mark real-device acceptance complete using a simulator alone.
