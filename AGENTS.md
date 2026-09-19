# Zikrist

Offline Quran mushaf follower for iPhone and Android.

**Goal:** hear recitation through the microphone and show the matching Arabic verse on screen. Lock `[surah:ayah]` as soon as the audio allows, paint that ayah’s canonical Arabic, and keep following as the reciter continues.

That is the product. Translation, packs, accounts, and cloud are later. They are a lookup after the verse is already known — not a second recognizer, and not current work.

## How to work here

Read the code and the failure in front of you. Decide from the audio and the mushaf, not from a queue or a prior session’s playbook.

- Stack: React Native, Expo native builds, TypeScript. Expo Go cannot run inference.
- Engine: `@tilawa/core` + ONNX for transcription; `src/core/follower.ts` owns verse following.
- Do not invent ayah labels. Founder labels live in `prompts/real-imam/LABELS.md` and `labels.json`.
- Do not commit `artifacts/` wav/mp3.
- Do not claim a match the app did not make.

## Checks

- `npm test` — in-memory follower and content checks (no network / pack-download tests).
- `npm run typecheck`
- `npm run test:replay -- all` — acoustic replay when fixtures are present (`npm run setup -- --fixtures`).
- After any change under `src/core/follower.ts`, `src/core/tracking/`, `src/core/expected-tape.ts`, `src/core/continuation-gate.ts`, `src/services/listening.ts`, `src/core/debug-hud.ts`, or the pipeline tests listed in `scripts/export-pipeline.mjs`, run `npm run pipeline:export` so `zikrist_pipeline_export.txt` stays current for review (implementation + regression specs).

Setup: [SETUP.md](SETUP.md).
