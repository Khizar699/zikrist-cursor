# Zikrist


Act as a principal-level mobile engineer working on Zikrist, an offline Quran recognition and translation application for Android and iPhone, including mid-range devices. Read this file before implementation. Read `Zikrist-research.md` for evidence and unresolved research; do not treat a third-party benchmark as a Zikrist measurement.

## Product and scope

The first technical MVP listens through the microphone, identifies surah and ayah, follows recitation, retrieves an approved translation locally, and records an ordered local session history. Initial languages are English and Urdu. Show real recognition results; never simulate a match without labeling a dedicated test mode.

Confirmed requirements:

- The core works without connectivity after initial asset/language setup.
- Support Android and iOS, on-screen translation and continuation of an active session while locked.
- Ask for language during onboarding. Download only the selected translation pack, retain at most two installed languages, and allow changes in settings.
- Arabic recognition assets are shared across translation languages.
- Prioritize the expected next verse after a confident initial location. Do not search every similar verse as an equally likely candidate during tracking.
- Keep recovery for repeats, jumps, stops, and a wrong initial lock. Predictions alone must not become displayed translations or history.
- Microphone processing is the default. Permanent audio saving and training contribution are separate explicit opt-ins, both off initially.
- Auto-listening on later app launches requires an explicit setting and existing microphone permission. Onboarding and permission handling precede listening.
- Translation is intended to stay free. Preserve commercially compatible dependencies because other features may become paid.

The first milestone is a measurable recognition MVP. Prayer-phrase recognition, scholarly commentary/story packs, accounts, cloud sync, analytics, training uploads and chat are subsequent capabilities unless explicitly brought into the active implementation scope. Do not pretend an unimplemented capability works. Keep appropriate interfaces and honest product copy.

Hafs ‘an ‘Asim is the initial corpus assumption, not a claim to support every riwayah. Specific translation editions, launch countries, age policy, and final performance/device guarantees require validation.

## Workflow and implementation prompts

1. Read this file and inspect relevant code and the current user request.
2. Use applicable skills available in the session. Do not invent or require missing skills from the reference project.
3. Verify version-sensitive APIs in installed package types/source and official documentation.
4. Before a substantial implementation, save a focused prompt in `prompts/` with goal, scope, inspected code/docs, assumptions, files, architecture/security requirements, acceptance criteria, checks and manual device tests.
5. Existing user authorization to implement is sufficient. Do not ask for the same approval again or turn prompt creation into a second permission gate. Ask only for a material unresolved decision or an unauthorized consequential external action.
6. Implement within that scope. Keep code small and typed; avoid unrelated refactors and unnecessary dependencies.
7. Run relevant checks, inspect the application where possible, and report precisely what was and was not tested.
8. Update run instructions, source notices, outstanding limitations, and `HANDOFF.md` (founder rule: every PR to `main` must bump handoff in the same PR — see `prompts/_SHARED-HANDOFF.md`).

The user authorized creating this file from a biasly reference and building the initial MVP. That reference supplied workflow ideas, not a requirement to use Next.js, web shadcn, scraping, Oxylabs, Gemini, pgvector, Vercel, or cloud-first data storage.

## Stack and boundaries

Use React Native, Expo native development/release builds, and strict TypeScript. Expo Go is not the inference testing environment. Use native UI components; NativeWind is optional. UI dependencies must not dictate recognition architecture.

Initial engine: `@tilawa/core` with a pinned compatible ONNX Runtime. Own a narrow engine adapter so inference/tracking can be replaced. Read the real package API: README examples can differ from exported types. Use one microphone capture owner and correct 16 kHz mono PCM for inference.

Separate:

- UI: onboarding, listening, translation, history, settings and test diagnostics.
- Audio: capture, resampling, sample clocks, interruptions and optional recording.
- Recognition: model runner, candidate tracking, confirmation, progress and recovery.
- Content: verified immutable Quran data, translation packs, source metadata and pack installation.
- Storage: settings and ordered sessions; audio stored separately.
- Future services: authenticated synchronization, analytics and AI, isolated from the offline core.

SQLite is the local source of truth for user settings and history. Immutable JSON/token/model assets are permitted where appropriate. Supabase is reserved for future optional cloud data. Authentication must never gate installed offline content or microphone recognition. Clerk is a candidate identity provider, not a prerequisite for this MVP.

## Recognition correctness

- Distinguish broad acquisition from locally prioritized continuation.
- Preserve multiple candidates when location is ambiguous; refrain from claiming an exact ayah until sufficient evidence exists.
- Account for partial verses, repeated ayahs, repeated al-Fatihah, sudden surah changes, joined verses and pauses.
- Scores from matching are similarity scores, not calibrated probabilities. Do not present them as percentage certainty.
- Do not advance solely from elapsed time, inferred recitation pace, or preloaded text.
- Track fresh acoustic evidence for confirmation and expose waiting/reacquiring states.
- Use a bounded buffer and serialized inference. Never start overlapping mutations of the same session or allow unbounded processing queues.
- Reset tracking after meaningful audio loss rather than silently joining unrelated audio.
- Do not do heavy inference or database work in an audio callback or React render.
- `async` does not move CPU-heavy TypeScript off the JavaScript thread. Profile full memory use, including retrieval indexes.
- Treat silence as an utterance boundary, not automatically the end of prayer.
- A Quran-only matcher must not claim to translate arbitrary Arabic or prayer phrases.

Measure cold readiness, first location, evidence-to-confirmation, confirmation-to-display, sustained throughput, peak RAM and battery separately. Sub-100 ms display after confirmation is an evaluation target, not a claimed acoustic latency. Never market unmeasured speed or accuracy.

## Content and language packs

Retain source, edition, language, version, canonical mapping, license/permission status, attribution and hashes. Pin the model, tokenizer and Quran token table as a compatible set. Verify downloads against trusted manifest values and use atomic activation. Never replace a working pack with a partial download.

Keep the Arabic display source unchanged. Recognition normalization/search indexes are separate from canonical text. Check verse counts, unique IDs, numbering/basmala conventions and word mappings. Preserve translation footnotes and multi-verse scope. Do not generate Quran translation from an LLM or machine-translate one edition into another language.

Only two translation-language packs may remain installed. A third-language install may use temporary staging; evict the oldest inactive language after successful activation, or before download if storage requires it while retaining the active pack. Deletion of a language never deletes history, recordings, or Arabic recognition assets.

Check each asset license separately. MIT code does not license model weights, recordings, translations, tafsir or fonts. Keep source notices with redistributed content. A publicly accessible URL is not a commercial redistribution grant. Mark unresolved clearance as a release blocker, without misrepresenting an internal evaluation as a cleared commercial release.

Tanzil Arabic and Tanzil translation terms differ. QuranEnc and QUL require edition-specific review. Quran Foundation's standard API cache/sync terms do not imply perpetual offline storage or ML-training permission. Do not use non-commercial models in an app that may generate revenue without separate permission.

Story/explanation features must distinguish translation, tafsir, attributed revelation reports, editorial summaries and AI output. Never invent a revelation occasion, date, or scholarly attribution. Missing evidence is a valid result.

## Privacy and persistence

- Microphone permission, permanent local recording and training contribution are distinct choices.
- No audio file is created in default transient-processing mode, including through a hidden recorder used as a background-work workaround.
- Do not upload audio, transcripts or prayer history by default. No cloud keys or analytics are required for the MVP.
- Continue only an explicitly active session while the phone is locked. Screen lock does not authorize recording retention or a new background session.
- Show an active microphone indicator and provide Stop. Honor OS microphone revocation and interruptions.
- Keep private data in app-private storage; apply platform backup exclusions and protection. SQLCipher does not encrypt standalone audio.
- Apply bounded retention and storage quotas when recording is implemented; allow user deletion. Never silently retain full sessions for hypothetical training.
- Session history is an ordered list of occurrences. Preserve repeats, coverage, times and model version. Do not globally deduplicate ayahs.
- Surface storage failures; do not tell a user that history/audio was saved if persistence failed.
- Do not log raw audio, full transcripts, tokens or identifiers in remote telemetry. Aggregate diagnostic data locally.
- Training consent does not authorize recording/distributing third parties. Future collection requires provenance and rights review.

## Scalability and future cloud work

Run core recognition on-device. Distribute versioned content/model files through object storage/CDN when needed. Future sync should use stable client IDs, idempotent requests and deletion tombstones. Enable and test row-level security for private Supabase data. Keep service-role credentials and provider secrets out of the app; `EXPO_PUBLIC_*` values are public.

Do not add vector search, Kubernetes, remote ASR or a chatbot as a dependency of live translation. Do not auto-enable PostHog, session replay, training uploads or cloud sync. Later AI should use permitted sources, explicit data sharing, citations, and independent availability from the listening feature.

## Checks and delivery

Keep commands in `package.json` and `README.md` accurate. Initial expected checks:

- `npm run typecheck`: TypeScript without emit.
- `npm run lint`: project lint checks.
- `npm test`: meaningful tracker, buffering, content integrity and persistence-contract checks.
- `npm run assets:verify`: checksums and Quran/translation integrity.
- Expo native export/build checks when dependencies, native configuration or assets change.

Build for Android and iOS where toolchains are available. If one toolchain or physical devices are unavailable, report that limitation explicitly. Simulator success is not evidence of real microphone/mosque performance, battery consumption, or locked-screen reliability.

For recognition changes test silence/non-target speech, arbitrary starts, expected next ayah, repetitions, jumps, stops and interrupted capture. Record initial versus steady-state latency. For content changes verify IDs, text/footnotes, source notices and pack swapping. Tests must check behavior rather than merely restating the implementation.

Final delivery must identify what works, exact run steps, checks actually performed, and remaining device/rights limitations. Do not claim production readiness, app-store approval, successful physical-device tests or license clearance without evidence.
