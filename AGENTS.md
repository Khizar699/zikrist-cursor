# Zikrist


Act as a principal-level mobile engineer working on Zikrist, an offline Quran **mushaf follower** for Android and iPhone, including mid-range devices. Read this file before implementation. Read `Zikrist-research.md` for evidence and unresolved research; do not treat a third-party benchmark as a Zikrist measurement. That research file still discusses a later translation product — it is **not** the current MVP.

## Product and scope

**Phase 1 (sole product goal):** rock-solid, low-latency, real-time **Arabic mushaf tracking** during live salah recitation. Listen through the microphone, lock the recited `[surah:ayah]` as soon as the audio allows, paint that ayah’s **canonical Arabic**, and follow monotonically as the imam continues (repeats, jumps, breath pauses, mid-surah starts, surah handoffs). Show real recognition results; never simulate a match without labeling a dedicated test mode.

**Phase 2 (translation):** demoted. Once Arabic alignment is **flawless**, translation is a **1-to-1 static lookup** of an approved edition keyed by the already-confirmed `[surah:ayah]`. It is not a second recognizer, not a live decoder, and not a reason to touch the follower. **Do not spend engineering effort on translation logic, packs, onboarding, or dual-pane UX until Phase 1 is confident** (`prompts/mushaf-first-mvp.md`).

Confirmed Phase 1 requirements:

- The core works without connectivity after initial recognition-asset setup (model + Arabic mushaf). No translation download is required to listen.
- Support Android and iOS, on-screen **Arabic mushaf**, and continuation of an active session while locked.
- After a confident lock, track inside a tight neighborhood `[current − 1, current + 2]`. Do not search every similar verse as an equally likely candidate during tracking.
- Keep recovery for repeats, jumps, stops, and a wrong initial lock. Predictions alone must not become the displayed ayah or history.
- Microphone processing is the default. Permanent audio saving and training contribution are separate explicit opt-ins, both off initially.
- Auto-listening on later app launches requires an explicit setting and existing microphone permission. Onboarding and permission handling precede listening.
- Preserve commercially compatible dependencies because other features may become paid.

**Phase 2 and later** (keep parked code; do not treat as current work):

- Approved on-screen translation under the ayah (English, then Urdu) as a `[surah:ayah]` lookup after lock.
- Language picker / two installed translation packs / pack eviction as a user feature.
- Session-history UI, prayer-phrase product polish, scholarly commentary/story packs, accounts, cloud sync, analytics, training uploads, and chat.

Do not pretend an unimplemented capability works. Keep appropriate interfaces and honest product copy. Hafs ‘an ‘Asim is the **display and index** corpus assumption, not a claim to support every riwayah. Acoustic flexibility for live tajweed cadence (madd, ghunnah, pauses) is Phase 1; shipping additional official qira’at corpora is not. Launch countries, age policy, and final performance/device guarantees require validation.

## Core engineering priorities (Phase 1)

All active work is the **acoustic-to-mushaf alignment engine** (`src/core/follower.ts`, continuation gate, capture queue). Do not open translation, network, or pack-install sessions against this list.

1. **Real-time tracking and pacing.** Monotonic verse progression after lock. Follow scores `[current − 1, current + 2]` only. A confirmed hop’s match-to-display target is **p95 < 50 ms** (evaluation target after confirmation — not a claimed first-lock, ONNX, or microphone-to-screen latency). Never market an unmeasured number.
2. **Tajweed and madd normalization.** Stretched vowels (e.g. CTC `الضاااالين`), nasalization, and breath pauses must not look like a new ayah, a mismatch, or a drop to Global Search.
3. **Recitation-style resiliency.** Cadence differences across common salah recitation (madd length, ghunnah, wasl/waqf) must not fragment CTC tokens into a lost lock. This is acoustic robustness on the Hafs index, not a second riwayah product.
4. **Predictable prayer state machine.** Surah-to-surah handoff is restricted to **ayah 1** (ayah **2** when ayah 1 is the shared Basmala) of salah-prior / leftover-pool surahs. Refuse phantom mid-surah jumps (e.g. **109:6 → 105:5**, **114:6 → 4:142**).
5. **Audio pipeline stability.** Bounded capture buffers, serialized inference, microphone-jitter tolerance, and seamless recovery from imam breath pauses. A short pause is not the end of prayer; a long stop reacquires without joining unrelated audio.

## Workflow and implementation prompts

**Execution style:** Zero conversational preamble, zero meta-announcements, zero doc-reading recitations (e.g., never say "I'll read Tip state and product docs..."). Immediately provide the direct code modifications, file writes, test runs, or terminal commands.

0. **Silently** read `HANDOFF.md` **Tip state** (and **Dictation for successor bots**) before implementing. Do not announce this read, recite Tip, or confirm that continuity rules loaded. Local Cursor Agent/Composer also loads `.cursor/rules/zikrist-continuity.mdc` and `.cursor/rules/zikrist-recognition-ratchet.mdc` (`alwaysApply`) — also silently.
1. Silently read this file and inspect relevant code and the current user request. Do not recite product law or list the files you opened.
2. Use applicable skills available in the session. Do not invent or require missing skills from the reference project.
3. Verify version-sensitive APIs in installed package types/source and official documentation.
4. Before a substantial implementation, save a focused prompt in `prompts/` with goal, scope, inspected code/docs, assumptions, files, architecture/security requirements, acceptance criteria, checks and manual device tests.
5. Existing user authorization to implement is sufficient. Do not ask for the same approval again or turn prompt creation into a second permission gate. Ask only for a material unresolved decision or an unauthorized consequential external action.
6. Implement within that scope. Keep code small and typed; avoid unrelated refactors and unnecessary dependencies.
7. Run relevant checks, inspect the application where possible, and report precisely what was and was not tested. For recognition/follower/Tilawa changes on Mac: run the Agent verify loop in `prompts/real-imam/algo/PRODUCT-BAR.md` yourself; do not substitute founder iOS vibe-testing.
8. Update run instructions, source notices, outstanding limitations, and **continuity docs** in the same PR (`prompts/_SHARED-HANDOFF.md`). **Your session is incomplete without a `HANDOFF.md` tip bump.** Also update `VALIDATION.md` when verify paths or Mac-green results change, and queue status when a queue moves. Recognition fixes must **ratchet-lock** (unit and/or ready expect) per `prompts/real-imam/algo/RATCHET.md` so the next Cursor session inherits a larger permanent suite.

The user authorized creating this file from a biasly reference and building the initial MVP. That reference supplied workflow ideas, not a requirement to use Next.js, web shadcn, scraping, Oxylabs, Gemini, pgvector, Vercel, or cloud-first data storage.

## Stack and boundaries

Use React Native, Expo native development/release builds, and strict TypeScript. Expo Go is not the inference testing environment. Use native UI components; NativeWind is optional. UI dependencies must not dictate recognition architecture.

Initial engine: `@tilawa/core` with a pinned compatible ONNX Runtime. Own a narrow engine adapter so inference/tracking can be replaced. Read the real package API: README examples can differ from exported types. Use one microphone capture owner and correct 16 kHz mono PCM for inference.

Separate:

- UI: listening (Arabic mushaf stage), settings/diagnostics. Translation panes stay unpainted (`SHOW_TRANSLATION_PANE`).
- Audio: capture, resampling, sample clocks, interruptions and optional recording.
- Recognition: model runner, candidate tracking, confirmation, progress and recovery.
- Content: verified immutable Quran Arabic (display + recognition indexes). Translation-pack machinery is parked, not a listen gate (`MUSHAF_ONLY_MVP`).
- Storage: settings; audio stored separately. History persistence may exist without a history UI.
- Future services: authenticated synchronization, analytics and AI, isolated from the offline core.

SQLite is the local source of truth for user settings. Immutable JSON/token/model assets are permitted where appropriate. Supabase is reserved for future optional cloud data. Authentication must never gate installed offline content or microphone recognition. Clerk is a candidate identity provider, not a prerequisite for this MVP.

## Recognition correctness

- Distinguish broad acquisition from locally prioritized continuation (`[current − 1, current + 2]` after lock).
- Preserve multiple candidates when location is ambiguous; refrain from claiming an exact ayah until sufficient evidence exists.
- Account for partial verses, repeated ayahs, repeated al-Fatihah, sudden surah changes, joined verses, madd elongations, and breath pauses.
- Scores from matching are similarity scores, not calibrated probabilities. Do not present them as percentage certainty.
- Do not advance solely from elapsed time, inferred recitation pace, or preloaded text.
- Track fresh acoustic evidence for confirmation and expose waiting/reacquiring states.
- Use a bounded buffer and serialized inference. Never start overlapping mutations of the same session or allow unbounded processing queues.
- Reset tracking after meaningful audio loss rather than silently joining unrelated audio.
- Do not do heavy inference or database work in an audio callback or React render.
- `async` does not move CPU-heavy TypeScript off the JavaScript thread. Profile full memory use, including retrieval indexes.
- Treat silence as an utterance boundary, not automatically the end of prayer.
- A Quran-only matcher must not claim to translate arbitrary Arabic or prayer phrases.

Measure cold readiness, first location, evidence-to-confirmation, confirmation-to-display, sustained throughput, peak RAM and battery separately. The **p95 < 50 ms** figure is a match-to-display evaluation target after confirmation, not a claimed acoustic or first-lock latency. Never market unmeasured speed or accuracy.

## Content (Phase 1 Arabic; Phase 2 is a lookup)

Retain source, edition, version, canonical mapping, license/permission status, attribution and hashes for **Arabic** display and recognition assets. Pin the model, tokenizer and Quran token table as a compatible set. Verify downloads against trusted manifest values and use atomic activation. Never replace a working pack with a partial download.

Keep the Arabic display source unchanged. Recognition normalization/search indexes are separate from canonical text. Check verse counts, unique IDs, numbering/basmala conventions and word mappings. Do not display normalized recognition text as the canonical Quran.

**Phase 2 translation law** (do not implement until Arabic tracking is flawless):

- Translation is a static `[surah:ayah]` lookup of an approved edition. No second matcher, no live decode of English/Urdu, no LLM translation.
- English and Urdu approved editions; at most two translation-language packs installed; Arabic recognition assets shared across languages.
- Preserve translation footnotes and multi-verse scope. Do not generate Quran translation from an LLM or machine-translate one edition into another language.
- Tanzil Arabic and Tanzil translation terms differ. QuranEnc and QUL require edition-specific review.

Check each asset license separately. MIT code does not license model weights, recordings, translations, tafsir or fonts. Keep source notices with redistributed content. A publicly accessible URL is not a commercial redistribution grant. Mark unresolved clearance as a release blocker, without misrepresenting an internal evaluation as a cleared commercial release.

Story/explanation features must distinguish translation, tafsir, attributed revelation reports, editorial summaries and AI output. Never invent a revelation occasion, date, or scholarly attribution. Missing evidence is a valid result.

## Privacy and persistence

- Microphone permission, permanent local recording and training contribution are distinct choices.
- No audio file is created in default transient-processing mode, including through a hidden recorder used as a background-work workaround.
- Do not upload audio, transcripts or prayer history by default. No cloud keys or analytics are required for the MVP.
- Continue only an explicitly active session while the phone is locked. Screen lock does not authorize recording retention or a new background session.
- Show an active microphone indicator and provide Stop. Honor OS microphone revocation and interruptions.
- Keep private data in app-private storage; apply platform backup exclusions and protection. SQLCipher does not encrypt standalone audio.
- Apply bounded retention and storage quotas when recording is implemented; allow user deletion. Never silently retain full sessions for hypothetical training.
- Session history, when shown, is an ordered list of occurrences. Preserve repeats, coverage, times and model version. Do not globally deduplicate ayahs.
- Surface storage failures; do not tell a user that history/audio was saved if persistence failed.
- Do not log raw audio, full transcripts, tokens or identifiers in remote telemetry. Aggregate diagnostic data locally.
- Training consent does not authorize recording/distributing third parties. Future collection requires provenance and rights review.

## Scalability and future cloud work

Run core recognition on-device. Distribute versioned content/model files through object storage/CDN when needed. Future sync should use stable client IDs, idempotent requests and deletion tombstones. Enable and test row-level security for private Supabase data. Keep service-role credentials and provider secrets out of the app; `EXPO_PUBLIC_*` values are public.

Do not add vector search, Kubernetes, remote ASR or a chatbot as a dependency of live listening. Do not auto-enable PostHog, session replay, training uploads or cloud sync. Later AI should use permitted sources, explicit data sharing, citations, and independent availability from the listening feature.

## Checks and delivery

Keep commands in `package.json` and `README.md` accurate. Initial expected checks:

- `npm run typecheck`: TypeScript without emit.
- `npm run lint`: project lint checks.
- `npm test`: in-memory mushaf tracker, gate, capture-buffer, and Arabic content-integrity checks. **Do not add** network, SQLite translation schema, or multi-language pack download/activate dependencies to this default suite.
- `npm run assets:verify`: checksums and Quran (and parked translation-file) integrity. Pack-file hashes are not a Phase 1 product bar.
- Expo native export/build checks when dependencies, native configuration or assets change.

**Default `npm test` priority (Phase 1):**

1. Monotonic verse-following under synthetic and live Arabic token streams (`tests/mushaf-tracking.test.ts`, `tests/follower.test.ts`).
2. Surah-boundary handoff that enters **ayah 1** (ayah **2** only when ayah 1 is the shared Basmala) of the next salah-prior surah — refuse mid-surah phantoms.
3. CTC letter repetitions, madd elongations, and phonetic-cousin matches that must keep the lock (not Global Search).

Recognition continuity (bots / overnight): Mac `npm run test:replay -- all` = **14/14** is the **regression floor**, not the product finish line. Algo and follower sessions must also meet the Tip **product bar** in `prompts/real-imam/algo/PRODUCT-BAR.md` (correct lock plus ordered advance **and the matching Arabic mushaf** on continuing audio for the Tip clip). Tilawa locate speed and Zikrist follow/handoff are separate concerns — do not treat famous-short EveryAyah green as prayer-follow or all-surah coverage.

**Continuous ratchet:** `prompts/real-imam/algo/RATCHET.md`. Every claimed fix must add or tighten a permanent lock (unit test and/or ready replay expect) in the same change set so the next daily launch cannot silently reintroduce the bug. Known fails in `HANDOFF.md` only shrink when locked green. Do not weaken expects without a stricter replacement.

Build for Android and iOS where toolchains are available. If one toolchain or physical devices are unavailable, report that limitation explicitly. Simulator success is not evidence of real microphone/mosque performance, battery consumption, or locked-screen reliability.

For recognition changes test silence/non-target speech, arbitrary starts, expected next ayah, repetitions, madd/pause, jumps, stops and interrupted capture. Record initial versus steady-state latency. For content changes verify IDs, Arabic text, source notices. Tests must check behavior rather than merely restating the implementation.

Final delivery must identify what works, exact run steps, checks actually performed, and remaining device/rights limitations. Do not claim production readiness, app-store approval, successful physical-device tests or license clearance without evidence.
