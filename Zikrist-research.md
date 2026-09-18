# Zikrist feasibility and architecture research

> **Current product MVP (Phase 1):** live **mushaf follow** — microphone → correct `[surah:ayah]` → canonical Arabic on screen → monotonic ordered advance inside `[current − 1, current + 2]`. **Phase 2 translation** is a static `[surah:ayah]` lookup after that alignment is flawless. See `AGENTS.md` and `prompts/mushaf-first-mvp.md`. The rest of this file remains research, including a later translation product; do not treat those paragraphs as the active first-build scope.

Zikrist is technically plausible as an offline Quran recognition and translation-retrieval application. The recommended next investment is a narrowly scoped recognition prototype on physical Android and iPhone devices, including mid-range hardware. A dependable production release is not yet justified by the available model benchmarks. The largest uncertainties are live recognition in mosque acoustics, sustained mobile performance, content redistribution rights, and whether the live reading experience helps worshippers in practice.

React Native with Expo is a reasonable application foundation. Tilawa is the leading initial recognition candidate for this stack, subject to measurement and an asset-provenance review. Supabase can support optional accounts and synchronization later. Neither authentication nor an internet connection should be required to start a listening session or review already downloaded content.

This assessment covers the first feature: live listening, translation display, prayer phrases, local session history, optional audio retention, and source-based explanations. Android and iPhone support, including mid-range devices, is confirmed. Both visible live translation and locked-phone recording are required. English and Urdu are the launch translation languages. First-run onboarding should ask for the preferred language and download only that pack; settings should support changing languages while retaining at most two installed translation-language packs. Hafs ‘an ‘Asim remains a provisional evaluation assumption. Launch countries and minimum device specifications remain open.

Live microphone processing is the default; local audio saving and training contribution are separate opt-ins. Translation is intended to remain free. Surah stories and explanations are also intended to be free, with possible paid enhancements or cost-bearing features later; final monetization details remain open. Dependencies must therefore permit a potentially commercial application even when the feature using them is free.

The source review is current to 14 September 2026. Tilawa source observations refer to commit `ec5cdc72c1c48ba29866ca2e3197d6b9a0e2e793`; its model release examined was `v0.2.0`. No mobile inference, battery, thermal, or mosque accuracy benchmark has been run for Zikrist. Published measurements below are attributed to their authors; engineering targets are proposals.

**Product feasibility and the latency requirement**

The core operation should be `microphone → recognize Quran location → retrieve approved translation`. It does not require generating a new translation of the audio. Once the verse identity is known, the corresponding Arabic and translated text can be retrieved locally. This is a useful reduction in complexity and keeps the religious text stable and auditable.

The Quran is a small, fixed search corpus, but sound does not uniquely identify a location immediately. A text analysis of Tilawa’s 6,236 records, using its `text_clean` field with only whitespace and BOM cleanup, found that 2,930 of 6,234 verses containing at least two words shared their initial two-word sequence with another verse: 47.0%. The complete text at 55:13 occurred at 31 verse locations. This is an ambiguity illustration, not an acoustic benchmark. It shows why an exact location cannot always be known from a short opening, even with perfect transcription.[^1]

An application that starts in the middle of a repeated passage must retain multiple candidate locations. It can wait for a distinguishing continuation, use previously confirmed context, or mark the location unresolved. Showing the correct text with an uncertain verse number is a different capability from confidently locating a specific occurrence. The interface and history should preserve that distinction.

Separate five clocks when specifying performance:

| Measurement | Start and end | Initial treatment |
|---|---|---|
| Cold readiness | App opened → microphone and model ready | Measure model loading, index construction, permissions, and first inference separately |
| First localization | Audible recitation begins → correct stable verse location | 400–1,000 ms is an aspiration for some inputs, not a general guarantee |
| Evidence delay | Distinguishing speech occurs → enough audio/context exists to decide | Inherent in the signal; cannot be removed by database caching |
| Tracking response | Sufficient new evidence → confirmed next location | Benchmark a provisional 300–800 ms range; revise from actual results |
| Display response | Confirmed recognition event → translated text appears | A p95 below 100 ms is a reasonable prototype target, not an achieved result |

Preloading improves the final step. It does not eliminate acoustic inference or evidence delay. If a model processes every 250 ms, preloading cannot make every acoustic transition appear in 80 ms. Likewise, asking the recognizer to run more often can increase backlog, power use, and wrong early decisions.

The proposed acquisition-versus-tracking split is sound. Initial acquisition searches broadly; tracking favors a small neighborhood. However, “the imam will continue to the next ayah” must remain a hypothesis. Repeats, corrections, skipped passages, surah changes, and stops must remain possible. Pace estimation should smooth progress and prepare content, never authorize an unconfirmed verse.

For the first interface, display the full approved translation of a confirmed ayah, with restrained Arabic progress highlighting. Long ayahs may need readable scrolling or professionally reviewed phrase segmentation. Arabic words and translated words are not one-to-one; spreading English or Urdu words uniformly over Arabic timing will often distort meaning. Word glosses should be presented as glosses, separately from an idiomatic verse translation.

The practical product question still needs field validation: can people read and understand the display at the reciter’s speed and from their intended phone position? A good recognition score does not establish that. Conduct supervised listening trials outside obligatory prayer first, then permission-based mosque trials. Include people who understand little Arabic, imams, and qualified religious advisers. Review use during salah with relevant advisers; the application should not claim a universal religious ruling about looking at a phone during prayer.

**Tilawa assessment**

Tilawa supplies more than an acoustic model. Its TypeScript package includes Quran retrieval, CTC decoding and rescoring, a recitation tracker, and word-progress events; the application supplies the ONNX runtime. The documented model accepts 16 kHz mono audio. The repository describes the code as MIT and the NVIDIA-derived model as CC BY 4.0.[^2]

Its public API has a useful separation between the inference runner and the recognition session. This makes it practical to replace the model or runtime without rewriting the whole interface. The current source exposes `transcribe`, `feed`, `reset`, and configuration updates. It still leaves microphone capture, lifecycle handling, durable storage, translation content, privacy, and application error recovery to the integrator.[^3]

The source defaults matter more than the headline latency. The balanced preset inherits a 2-second discovery trigger, uses a 250 ms tracking trigger and 150 ms audio chunk setting, and allows a 12-second tracking window. The aggressive preset reduces discovery to 1.5 seconds. These are scheduling and buffering settings, not total response-time guarantees.[^4]

The advertised perfect score comes from a 53-sample full-file benchmark with test-time speed augmentation. The research notes say the live browser uses the model without those extra passes because of cost. They also distinguish final corrected sequences from raw live emissions and identify older streaming tables as historical results from a previous model. Those historical results should not be attributed to the current model. The evidence does not establish current end-to-end mobile streaming quality.[^5]

The NVIDIA base model card explicitly describes the model as non-streaming. A wrapper can repeatedly evaluate growing or overlapping windows, but that differs from a streaming encoder that carries state forward. The card identifies noise sensitivity and licenses the model under CC BY 4.0 for commercial and non-commercial use.[^6]

There is an actionable mobile concern in open PR #18: its author reports a global span index using approximately 688 MB of retained heap before a proposed reduction to 42 MB, and reports expensive repeated text-search allocations. Those are contributor measurements, not independently reproduced phone results, and the PR was open when checked. Measure the shipping package; do not assume its optimizations are already available.[^7]

An open issue also questions the exported model’s embedded acoustic preprocessing. This is an unverified report worth testing, not proof that the export is incorrect.[^8] The documented `config: "balanced"` example also differs from the inspected public source type, which accepts a partial configuration object. Pin a tested SDK revision and validate actual exported types rather than copying examples without compilation.[^2][^3]

The npm package metadata reported `@tilawa/core` version `0.1.0`; the model asset release was `v0.2.0`. These identifiers describe different artifacts. Record them separately, along with the runtime, tokenizer, Quran index, and normalizer versions.[^9]

| Initial model-side asset | Observed release size | Role |
|---|---:|---|
| `fastconformer_full_mixed.onnx` | 88.31 MB | Acoustic inference; mixed int4/int8 export |
| `quran_ctc_tokens.json` | 12.21 MB | Quran candidate token sequences |
| `quran.json` | 3.19 MB | Verse records used by the recognizer |
| `vocab.json` | 21.1 KB | Output vocabulary |
| `export_metadata.json` | 1.1 KB | Hashes, blank token, provenance, export contract |
| `tokenizer.model` | 254.8 KB | Retain for reproducible rebuilding; not required by the documented JSON-based runtime path |

The first five total approximately 103.73 MB, before the application, ONNX runtime, fonts, translations, or any retained audio. These are file sizes, not peak RAM. The release metadata provides hashes for several artifacts, including model SHA-256 `4767182cd92975869f81a7e32700b14ca2b04e8dc97a15ff220a8697f4639488`.[^10]

**Recommendation:** use Tilawa for the first feasibility prototype, behind a replaceable recognition interface. Do not designate it the final production engine until it passes real-device and held-out audio tests. Keep a focused path for moving expensive indexing or tracking into native code if profiling demonstrates that this is needed. Do not begin by rewriting everything.

**Model alternatives and licensing**

| Candidate | Value to Zikrist | Limitation and decision |
|---|---|---|
| Tilawa with its packaged FastConformer export | Closest initial fit for React Native and Quran location tracking | Preferred prototype; mobile performance and provenance need validation |
| Official NVIDIA Arabic FastConformer | Clearly documented upstream model and commercial license | Non-streaming; useful reference when reproducing exports or comparing quantization[^6] |
| Tarteel `whisper-base-ar-quran` with `whisper.cpp` | Independent Quran-adapted baseline and mobile-capable C/C++ runtime | Model card declares Apache 2.0 but leaves training-data details incomplete; runtime is MIT. Benchmark accuracy, conversion, and latency rather than assuming a drop-in tracker[^11][^12] |
| `sherpa-onnx` | Offline native speech runtime with Android/iOS support, streaming and non-streaming infrastructure | Apache 2.0 runtime; it is not itself a Quran model. A suitable separately licensed model and application adapter are still required[^13] |
| Muno459 Quran phoneme Zipformer | Relevant streaming, phoneme-based approach | Published conditions restrict it to free applications and prohibit app revenue, including ads and subscriptions. Exclude from a commercially flexible baseline unless separately licensed[^14] |
| Muno459 Quran FastConformer family | Useful evidence of Quran specialization and benchmark methodology | Custom/gated licensing and model-specific terms need review; do not inherit the NVIDIA license assumption for later fine-tunes[^15] |

No examined alternative is established as universally superior for Zikrist’s exact combination of mosque acoustics, mid-range Android/iPhone hardware, live verse tracking, and commercial freedom. Leaderboard word error rate is not the same metric as the number of wrong verse translations displayed during a prayer. Results using full recordings must not be ranked as directly equivalent to causal live recognition.

For a later purpose-built model, the technically relevant direction is a small streaming CTC or transducer encoder, trained or distilled using rights-cleared Quran audio and mosque conditions, coupled to an explicit Quran tracker. A general local chatbot is unnecessary for live recognition. Model training tools such as PyTorch or NeMo belong in a separate development environment, not in the phone application.

Treat licensing as a chain: application code, runtime, base model, fine-tune, conversion/export contributions, tokenizer, Quran text, translations, audio, fonts, and training datasets. One repository’s MIT license does not cover all of these. Tilawa’s export metadata names Cyberistic’s repository; that repository did not expose a repository-level license in the inspected metadata/tree. This leaves copying its scripts or independent contributions unresolved, without negating NVIDIA’s explicit base-model grant. Confirm the released artifact’s provenance and notices, or reproduce it using clearly licensed tooling.[^10][^16]

**Recommended application stack**

| Proposed tool | Assessment | Recommended use |
|---|---|---|
| Cursor with Grok | Keep if productive for the team | Development assistant; not a runtime dependency. Human review and physical-device evidence remain necessary |
| React Native + Expo + TypeScript | Keep | Application shell, navigation, accessibility, storage, and native integrations |
| Expo Go | Insufficient for this build | Use development builds and release builds with required native libraries; Expo supports custom native code through its development-build workflow[^17] |
| NativeWind | Reasonable optional styling choice | Keep if it speeds up the team; pin a compatible NativeWind/Expo/React Native combination[^18] |
| shadcn/ui | Change the mobile choice | Its web components are not a direct native component library. Consider React Native Reusables, an MIT project implementing a similar approach for React Native, or simple native components[^19] |
| Supabase | Keep for optional cloud features | Postgres, private storage, authorized sync endpoints, and later account-linked data |
| Clerk | Valid but optional | Choose Clerk when its identity features justify a second service. Otherwise Supabase Auth reduces vendors; do not implement two competing login systems |
| PostHog | Reasonable later | Explicit, minimal telemetry after privacy decisions; no dependency in the listening path |

Clerk has a supported Supabase integration. Its Expo offline-support guide is explicitly experimental and concerns cached authentication resources. That should not determine whether local Quran recognition works. A guest profile must remain functional when tokens expire, the user signs out, or both services are unavailable.[^20][^21]

The most important missing dependency is a reliable **microphone-to-PCM path**. The current Expo Audio documentation includes a native `AudioStream` for microphone PCM, so older advice that Expo Audio only supports recording files is no longer sufficient. Verify that API in the exact Expo version selected. It also documents microphone permissions, persistent recording locations, and background recording configuration.[^22]

Software Mansion’s MIT `react-native-audio-api` is another strong capture candidate. Its recorder supports buffer callbacks, including a documented 16 kHz mono example, and file recording. Compare interruption behavior, resampling, buffer delivery, power consumption, and simultaneous recognition/retention. Select one microphone owner; avoid competing recorders from different libraries.[^23]

Use `onnxruntime-react-native` first for the Tilawa runner. The exact mixed-quantization operators must work in the chosen native build. Establish a CPU baseline before experimenting with acceleration. ONNX Runtime warns that accelerator performance depends on both model and device; unsupported operations and graph partitioning can reduce performance. Verify execution-provider availability through the actual React Native binding rather than assuming every native provider is exposed.[^24][^25]

Use `expo-sqlite` for local session metadata and approved content. It supports bundled databases, full-text extensions, and optional SQLCipher builds. SQLCipher can protect private database records; it does not encrypt standalone audio files. Public Quran assets and private history should have separate storage policies.[^26]

Additional components should be chosen for a concrete need:

| Component | Initial choice or candidate | When needed |
|---|---|---|
| Model/content files | Expo asset and file-system facilities | Prototype and production |
| Small secrets and encryption keys | OS secure storage through `expo-secure-store` | Private retention or account tokens |
| Voice activity detection | Simple calibrated signal gate first; evaluate MIT Silero VAD if it improves results | Optional, evidence-driven[^27] |
| Local schema/migrations | SQL migrations; optional Drizzle | Once session and content schemas stabilize |
| Package/content validation | Typed interfaces plus schema validation | Before accepting downloaded packs |
| State management | A small explicit state machine | Required behavior; no mandatory state-machine package |
| Crash diagnosis | One native-capable crash-reporting solution, selected during prototype | Before external testing; scrub audio and religious history |
| Automated checks | Type checking, unit tests for tracker logic, instrumented audio replay, mobile end-to-end tests | Alongside the recognition prototype |
| Model experimentation | Separate Python environment with ONNX tooling; PyTorch/NeMo only when needed | Re-exporting, quantization, or training |

Do not install a vector database, server GPU inference stack, Kubernetes cluster, full Quran audio catalog, or on-device LLM for the first feature. These are not prerequisites for matching a small fixed corpus. Avoid pulling in abandoned audio/FFmpeg wrappers merely to format recordings; use supported platform encoders and assess any codec library separately.

Native dependencies also need compatibility checks for current React Native architecture, Android ABI and 16 KB memory pages, minimum OS versions, and release packaging. Google’s Android guidance makes 16 KB compatibility relevant to native libraries in Play-distributed applications targeting modern Android.[^28]

**Offline content sources and rights**

The content pipeline should produce versioned local packs before release. Production phones should not call a public Quran API for each heard word or verse. A translation’s presence on a website is not permission to redistribute it. Review the exact edition, source, permission, modification rules, update obligations, and commercial scope.

| Source | Useful material | Offline and licensing assessment |
|---|---|---|
| Tanzil | Verified Arabic text and Quran metadata | Strong Arabic-source candidate. Published terms permit verbatim distribution with attribution and notice, prohibit changing the text, and require linking to Tanzil. Preserve source text exactly[^29] |
| Tanzil translations | Downloadable translations in many languages | Published collection terms specify non-commercial use; other uses require translator/publisher permission. Do not treat these as having the Arabic text’s license[^30] |
| QUL, by Tarteel | Translations, word glosses, tafsir, fonts, scripts, metadata, timings, surah information, similar passages | Particularly useful download hub. Its FAQ supports commercial use subject to each resource’s terms and offers JSON/SQLite translation exports. Its stated resource scope is Hafs[^31][^32] |
| QuranEnc | Translations, footnotes, selected Arabic explanations, downloadable SQLite/CSV/XML | Strong candidate for an initial translation pack. The API exposes edition/version data and verse text with footnotes. Confirm current edition-specific commercial and offline terms[^33][^34] |
| Quran Foundation / Quran.com | Broad translation, tafsir, recitation, word-level and structural content | Standard terms require a sync at least every seven days for eligible Content Sync retention; other storage is limited unless expressly permitted. Seek explicit terms for long-term offline distribution[^35] |
| Altafsir | Classical tafsir and commissioned translations, including al-Wahidi’s Asbab al-Nuzul | Valuable scholarly source. No blanket commercial offline redistribution grant was verified; obtain the relevant edition’s permission[^36] |
| Quranic Arabic Corpus | Morphology, syntax and linguistic annotation | Published download terms combine GPL language with additional verbatim/attribution conditions. Review obligations for the exact data before embedding; not essential to v1[^37] |
| AlQuran Cloud | Convenient text/audio/translation endpoints | Aggregator with underlying rights-holder interests and stated limitations; convenience is not a clean grant for every commercial asset[^38] |
| fawazahmed0/quran-api | Broad translation catalog and convenient formats | Useful discovery/comparison resource. Do not assume repository licensing supplies every translator’s permission[^39] |
| Amiri / Amiri Quran | Unicode Arabic typography | OFL-1.1 font source; include required notices and validate Quranic marks on both platforms[^40] |
| HadeethEnc / Sunnah.com | Hadith references, translations and explanations | Useful sources for prayer phrases and contextual references; verify reuse rights independently before offline distribution[^41][^42] |

QuranEnc’s legacy published conditions allow downloading and republication with unchanged content, publisher/source attribution, version and transcript information, corrections and updates, and restrictions on inappropriate advertising. Its current site advertises download formats and links to terms. Confirm how those conditions apply to the chosen editions, a paid application, long offline intervals, and any phrase segmentation before release; the legacy page alone should not be treated as a perpetual commercial agreement.[^34][^43]

Quran Foundation additionally restricts using its content or user data for machine-learning models without written consent. Its terms distinguish ordinary app use from selling or separately redistributing content/data. Do not build a bulk content mirror or training corpus under the assumption that API credentials cover those uses.[^35]

Recommended sourcing order: obtain canonical Arabic from Tanzil; choose one readable, reviewed launch translation for each of English and Urdu from QuranEnc or QUL with documented rights; add one appropriately licensed tafsir source; source a small prayer-phrase dictionary with religious review. Offer both launch languages but download only the selected language to each phone. Add other language options incrementally as permissions and quality review are completed.

Potential English editions to evaluate include Rowwad, Noor International, Saheeh International, and The Clear Quran. These are candidate editions, not a finding that each is available under acceptable redistribution terms. Select Urdu and other editions with fluent reviewers. Readability during recitation is a separate acceptance criterion from completeness or reputation.

Maintain a pack manifest with `resource_id`, edition, translator/author, language, riwayah, numbering scheme, source URL, version, license text or permission reference, attribution, checksum, minimum compatible app version, and review status. Preserve footnotes, multi-ayah coverage, and correction history. A source update must not silently attach a translation to the wrong verse.

Keep canonical display Arabic byte-preserved. Build recognition tokens and search features separately, with mappings back to canonical verse/word identifiers. Do not display normalized recognition text as the canonical Quran. Confirm that the proposed derived index complies with the source’s restrictions. Take special care with basmala conventions, Uthmani spelling, verse numbering, merged translation units, and tokenizer boundaries.

QUL’s prerecorded word timestamps can help validate alignment against those particular recordings. They cannot set the timing of an unknown live imam. Live timing must come from the incoming audio.[^31]

The Arabic model and canonical Quran are shared baseline assets, independent of translation language. Onboarding language selection should be separate from optional account creation so the local experience need not depend on login. Download the selected translation, reviewed prayer-phrase meanings, and whichever offline explanatory material is included in that language pack. Clearly show its size and readiness before the first listening session. With download-on-selection, the honest product promise is offline use after initial content setup; a language that has never been downloaded cannot work offline.

Keep at most two installed translation-language packs. For a change to a third language, validate free space, download into staging, verify authenticity and completeness, activate the new pack atomically, and evict the least recently used inactive language. Temporary staging can exceed the final two-pack storage footprint; if space is insufficient, remove an inactive pack first while preserving the current one, or explain that the change cannot complete. If a network failure interrupts the download, keep the current language working.

Language eviction must not delete prayer history, personal recordings, or the shared recognition model. History should store canonical verse and phrase references, and render them in an installed language. Removing a language can also remove its unneeded commentary and search indexes. Pending downloads, pack licenses, version migrations, and optional larger tafsir packs need the same two-language accounting and clear storage controls.

**Prayer phrases and session boundaries**

Tilawa’s Quran-only retrieval is not a complete prayer recognizer. Add an explicitly separate phrase lexicon and recognition path. Initial candidates include takbir, tasmi‘, tahmid, tasbih in bowing and prostration, tashahhud, salawat, and the concluding salam. The Arabic forms, accepted variants, translations, and religious references need review. “All Arabic used in prayer” is unbounded because supplications can vary; define the launch coverage.

Evaluate constrained phrase recognition from the same acoustic output before training another model. If short formulas are poorly recognized, a small dedicated phrase model may be justified. Either approach needs negative examples: ordinary speech, a Quran passage containing similar words, announcements, overlapping congregation responses, and silence.

Do not infer a prayer phrase merely from its expected place in the ritual. Use prayer state as a weak prior. Distinguish “heard” from “expected,” especially for quietly spoken parts that a phone may not capture. The microphone cannot identify words absent from the signal.

Separate a short utterance boundary from the end of a whole session. Silence between verses, during bowing/prostration, or through quiet prayer portions should not repeatedly close the history. Use inactivity with context, recognized end cues where reliable, and a simple Stop control. End detection should remain correctable.

A session is an ordered timeline of occurrences, not a set of unique ayahs. Repeated al-Fatihah across rak‘ahs, repeated ayahs, jumps, and partial verses need separate entries. Suggested records include occurrence ID, verse or phrase ID, start/end time, partial coverage, confidence state, model version, and any associated consented audio segment. Final review can correct uncertain matches, but must not conceal how often the live display was wrong during evaluation.

**Proposed device architecture**

Use the following bounded pipeline:

1. A single native capture owner timestamps samples, handles route changes and interruptions, and delivers correctly resampled mono PCM.
2. A bounded audio buffer provides recent context to inference. Model loading and recognition-index construction happen once per active engine lifecycle, not every verse.
3. A signal gate reduces unnecessary inference while preserving enough lead-in and tail audio to avoid clipping soft beginnings or long vowels.
4. Broad retrieval maintains several candidate locations until evidence supports a stable lock.
5. Local tracking scores continuation, repeat, pause, and jump alternatives. It returns to broad retrieval when evidence disagrees.
6. A prayer-phrase path competes with Quran candidates and an explicit unknown/non-target state.
7. A confirmation layer emits compact events to the interface. Only confirmed evidence advances the main translation.
8. Local content retrieval prepares the current and nearby translations. Rich commentary can be loaded on demand after listening.
9. A local event store records ordered recognized occurrences. Optional audio writing consumes the same captured stream under a separate retention policy.
10. Optional synchronization processes a durable queue later, with retries and no effect on live recognition.

Suggested state names are `READY`, `ACQUIRING`, `TRACKING_QURAN`, `TRACKING_PHRASE`, `PAUSED`, `REACQUIRING`, and `STOPPED`. These describe software behavior, not religious judgments. Include a visibly uncertain state in the product rather than forcing every input to match something.

The audio callback must not perform slow database operations, React updates, or heavy matching work. JavaScript `async` does not make CPU-heavy TypeScript run on a separate thread. Measure the entire path, and put heavy work in a suitable dedicated execution context or native module if necessary. Send UI events, not full waveform buffers, through React state.

Prevent concurrent mutation of the same recognizer session and unbounded inference queues. If processing falls behind, use a documented buffering/coalescing strategy with timestamp continuity and explicit detection of lost audio. A correct-looking interface delayed by several seconds is still a failed live experience.

Favor calibrated abstention. A similarity score named `confidence`, including a value of 0.99, is not automatically a 99% probability of correctness. Choose thresholds on a held-out corpus, evaluate errors at those thresholds, and record both precision and coverage. Limit prediction-based animations to styling; they must not create historical claims that words were heard.

**Audio retention, privacy, and model improvement**

There are three different permissions: using the microphone for the current session, retaining audio locally, and contributing audio for later training. The confirmed default is transient processing with optional local retention and a separate contribution choice. Enabling one opt-in must not silently enable the other.

First launch needs microphone permission and a clear explanation. After an explicit setting has been enabled, opening the app can start the intended listening mode. Keep a visible listening indicator and an immediate Stop control. Apple’s review rules require explicit consent and an indication when recording user activity.[^44]

Locked-screen recording requires platform-specific lifecycle work. Android restricts starting microphone foreground services from the background, particularly with while-in-use permissions; start the session from a visible user action and test continuation separately. Background capture permission does not by itself prove that the chosen inference and JavaScript execution path will run reliably while locked.[^45]

Screen lock should continue an already active session; it must not silently turn on permanent audio retention. When saving is enabled, the recorder should write durable segments and recover safely from interruptions. Test immediate return to live translation after unlocking. Prefer continuous local recognition if it meets the power and lifecycle requirements; if locked mode instead defers recognition until afterward, that tradeoff must be explicit and cannot depend on stored audio when the user has declined saving. A dedicated native recognition service may be necessary for reliable continuous processing. React Native remains suitable for the interface even if this subsystem needs Swift/Kotlin/C++ work.

Personal prayer history and recordings may reveal religious beliefs. UK ICO guidance treats data revealing religious beliefs as special category data; if relevant to the launch jurisdiction and processing, identify both the lawful basis and applicable additional condition. The controller’s location and launch markets remain undecided. A user’s microphone permission is not automatically permission from an imam or bystanders to distribute their recordings or train a commercial model.[^46]

For retained audio, use application-private storage, platform data protection, a retention limit, a storage quota, deletion controls, and explicit backup exclusions unless backup is intended. Encrypt private audio with a vetted streaming/file-encryption implementation when the threat model requires it, using protected keys. Avoid large plaintext temporary files. Do not claim SQLCipher protects files outside its database.

Approximate storage, calculated without container overhead:

| Encoding | One hour | Ten hours |
|---|---:|---:|
| 16 kHz mono, 16-bit PCM | 115.2 MB | 1.152 GB |
| 16 kHz mono, float32 PCM | 230.4 MB | 2.304 GB |
| Speech codec at 24 kbit/s | 10.8 MB | 108 MB |
| Speech codec at 32 kbit/s | 14.4 MB | 144 MB |

Compressed audio may be sufficient for personal replay, but training quality and compression effects need validation. Use rights-cleared high-quality source recordings for the benchmark and an explicit policy for contributed training clips. Avoid retaining full hours by default merely because future training might be useful.

Saving audio on a device does not improve centrally shipped models by itself. An improvement pipeline needs authorized transfer, provenance, consent version, human-verified labels, segmentation, quality checks, deduplication, separate speaker/venue/device train and test splits, and reproducible model releases. Never treat the recognizer’s own verse prediction as unquestionable ground truth; doing so reinforces its mistakes.

EveryAyah is a useful studio-audio dataset whose Hugging Face card declares CC BY 4.0; verify the underlying recording provenance for the intended use.[^47] Tarteel tlog has gated access and terms that must be reviewed before use.[^48] Quran-Lab’s 600-clip benchmark includes phone recordings and published evaluation restrictions; it is an evaluation resource, not an unrestricted app asset or training pool.[^49]

Do not promise that removing a training sample erases its influence from every already distributed model. Define deletion and consent-withdrawal behavior for raw data, future training datasets, backups, and model releases accurately. Avoid on-device self-training or federated learning in v1; both add substantial validation and operational complexity.

**Session explanations and later AI features**

Separate the following content types in the interface and data model:

| Content | What can be shown reliably |
|---|---|
| Translation | The named translator’s approved text and footnotes |
| Tafsir | A sourced commentary passage, potentially covering multiple ayahs |
| Revelation context | Attributed reports with reference, scope, and review status |
| Surah introduction | Broad themes, classification, and historical discussion from a named source |
| Editorial explanation | A reviewed summary identified as an explanation |
| Future AI response | A clearly labeled answer grounded in permitted sources, with citations and uncertainty |

Al-Wahidi’s Asbab al-Nuzul is an important candidate reference, available through Altafsir in an English translation by Mokrane Guezzou, but it is not a complete dated narrative for every verse. Treat reports and differing interpretations as attributed scholarship, not a single automatically reconstructed story.[^36]

The safe content behavior for missing evidence is “No specific revelation report is available in this source.” Do not invent a date, incident, or causal story to fill a blank. “When it came” may be a general period rather than an exact date; the absence of precise information is a valid answer.

Use a qualified editorial reviewer and preserve source-edition/page or passage references. A story associated with an entire passage must not be repeated as a distinct historical event for each ayah. An AI-generated summary requires permission to process the source through that service and a review policy; access to tafsir text does not inherently include machine-learning or third-party-processing rights.

Later online chat can be a separate service that receives only the selected verses and explicitly approved context. It should not receive microphone audio or full listening history by default. Public Quran text, private history, and paid services should be separate trust boundaries. Live recognition remains available when chat is down.

**Scaling to a million users**

On-device inference is the principal scalability advantage. A million phones do not require a million concurrent server recognition sessions. Cloud load comes from accounts, optional history sync, model/content distribution, contributed recordings, and later chat.

Start with a modular application and a modest cloud service, rather than a distributed system designed around a hypothetical million-user workload. Use Supabase for account-linked records and authorization; immutable model/content packs belong in object storage behind a CDN. Use signed, versioned manifests, integrity checks, atomic installation, and a last-known-good rollback. The verification key must be trusted independently of a downloaded manifest; a checksum alone does not authenticate its publisher.

For optional history sync, use stable client-generated IDs and idempotent writes. Append session occurrences; define conflict behavior for user edits and deletion tombstones. Claim guest history into an account only through an explicit flow. Authorization must prevent one account reading another’s prayer history or recordings. Supabase’s production guidance emphasizes row-level security and operational preparation; using the service does not configure these correctly by itself.[^50]

Keep audio out of Postgres rows. Store private recordings as objects with authorization and retention policies, and store metadata separately. Database backup coverage must be checked separately from object-file backup coverage; Supabase documents that database backups do not include the actual Storage objects.[^51]

Illustrative capacity arithmetic: one million separate downloads of a 104 MB pack is about 104 TB transferred before caching/compression effects. If 100,000 consenting contributors each uploaded one hour per day at 24 kbit/s, ingress would be approximately 1.08 TB/day. These are scenarios, not expected adoption or vendor quotes. Distribution and indiscriminate retention can dominate costs even when inference is free of server compute.

PostHog supports React Native, offline queuing, opt-out controls, and filtering. Use an explicit allowlist of aggregate diagnostics: model version, device performance bucket, initialization failures, latency histograms, and crash counts. Do not send every word, ayah, prayer timestamp, recording path, or raw transcript by default. Disable automatic capture and session replay on sensitive screens. Sample and aggregate performance metrics locally.[^52]

Set offline defaults for any feature flags. No remote setting or expired authentication token should silently break the local core. Use staged releases for model changes, corpus regression checks, and rollback based on both false-display rate and performance. Million-user readiness also requires support, incident response, deletion workflows, and content correction operations—not just a database choice.

**Validation plan before production implementation**

The first prototype should contain only capture, model loading, localization, tracking, a basic local translation view, and instrumentation. Test in release mode on physical phones; desktop timings, Expo Go, and a simulator are insufficient to accept the performance requirements.

| Gate | Evidence required | Failure response |
|---|---|---|
| Runtime compatibility | Exact model loads and produces stable outputs on supported Android/iPhone builds | Change export/runtime or narrow device scope |
| Broad localization | Correct verse or honest ambiguity on unseen reciters and mid-verse starts | Improve retrieval/recognition; keep manual surah selection as an optional aid |
| Live tracking | Correct repeats, jumps, stops, and phrase transitions | Correct state machine; do not disguise errors with predictive display |
| Sustained operation | 30–60 minute sessions, screen-on and locked, with bounded RAM, no growing queue, acceptable heat/battery | Optimize measured bottleneck, reduce duty cycle, or reconsider engine |
| Content integrity | Correct verse mapping, typography, footnotes, hashes, licenses, and review | Block affected pack until corrected |
| Offline reliability | Selected pack works offline after initial setup; cold restart after weeks offline; no auth dependency | Fix pack completeness or remove hidden network dependency |
| User benefit | Participants can follow meaning comfortably; review history is useful | Adjust presentation or initial use case |

Build an independently labeled evaluation set with mosque loudspeakers, distance and reverberation, fans, clothing obstruction, overlapping voices, natural pauses, different recitation speeds, quiet audio, and poor microphone placement. Include unknown speech and silence, not only positive Quran clips. Use unseen reciters and venues; prerecorded clean recitations are only one stratum.

Include specifically adversarial sequences: a shared opening followed by a different verse, repeated refrains, joining two verses without a pause, a long ayah with an internal pause, a restart mid-ayah, an abrupt surah change, interrupted recording, microphone revocation, a phone call, Bluetooth route change, low storage, process restart, and silence during prayer movements. Unsupported riwayat should be evaluated as unsupported, not silently “corrected” to Hafs.

Report live verse precision, coverage/recall, wrong displays per hour, first-location latency, transition latency, recovery time after jumps, skipped/partial verse handling, and phrase false alarms. Measure p50/p95/p99 rather than averages alone. Report cold and warm start separately. Track the peak combined memory of the model, native runtime, JavaScript heap, indexes, and buffers.

Suggested initial acceptance targets, to be negotiated after baseline measurement: p95 confirmation-to-display below 100 ms, no unbounded backlog, and very high live-display precision with visible abstention. A provisional 99.5% precision target can guide development, but is not sufficient by itself: it must be paired with useful coverage and a low wrong-display rate over long sessions. A system that emits almost nothing can appear precise while being useless.

Small benchmarks cannot certify rare error rates. As a rough independent-event heuristic, zero observed errors in 600 trials still permits an upper 95% error-rate bound near 0.5%; real session errors are correlated, making per-session evaluation essential. A 53-clip perfect result is promising evidence to investigate, not a production warranty.

Before external beta, finalize content and model notices; test deletion and retention; verify the required locked-phone behavior; test denied permissions, interrupted initial pack setup, and onboarding while offline; and confirm that a missing optional pack does not leave the user with an apparently broken microphone experience. A never-downloaded language should show that setup requires connectivity. An optional explicit “start from this surah” control may reduce acquisition uncertainty without being required for normal use.

**Decisions and acquisition order**

The smallest justified technical purchase/download set is the native mobile toolchain, a development-build project, one capture implementation, ONNX Runtime, the pinned Tilawa SDK and matching assets, canonical Quran text, one licensed translation per launch language, and a Unicode Quran-capable font. A GPU training environment is not required to discover whether this product works.

Before installation, record candidate versions and licenses, then select a known-compatible combination through a small build. Use the release metadata and checksums; retain dependency lockfiles and a software/asset inventory. Download model assets from the authoritative release rather than a convenient unverified mirror. Bundle the baseline model/content for a strict first-launch-offline claim; otherwise describe the necessary initial download explicitly. Apple requires disclosure and a prompt when initial functionality depends on additional resource downloads.[^44]

Next acquire rights-cleared evaluation recordings and create the benchmark harness. Add phrase coverage and session history after basic localization is measurable. Add reviewed explanation packs after the licensing and editorial structure is clear. Add accounts, cloud sync, analytics, and optional chat after the offline path works independently.

Outstanding decisions are: the specific English and Urdu translation editions; Hafs-only versus additional riwayat; minimum RAM/OS/device class; allowable model download and audio-storage limits; detailed monetization; intended launch countries and age groups; and the budget for native/ML engineering and scholarly review. The confirmed cross-platform requirement, visible and locked-phone modes, two-language pack limit, and separate audio opt-ins should remain the baseline while these are resolved.

The recommendation is to proceed with validation, retaining React Native and Expo, replacing the direct web shadcn choice, keeping authentication optional, and treating Tilawa as a candidate engine. The project should advance to production implementation only after its live recognition, content rights, and user experience are demonstrated under the intended conditions.

**Sources and references**

All links were reviewed for this assessment on 14 September 2026. Repository code and source terms may change; pin exact artifacts and retain the applicable notices when making release decisions.

[^1]: Yazin Sai / Tilawa. [Quran records at inspected commit](https://github.com/yazinsai/tilawa/blob/ec5cdc72c1c48ba29866ca2e3197d6b9a0e2e793/web/frontend/public/quran.json). Original text-prefix count calculation described above.
[^2]: Yazin Sai / Tilawa. [Repository and README](https://github.com/yazinsai/tilawa). Package scope, model description, example usage, and license declarations.
[^3]: Tilawa. [Public session implementation](https://github.com/yazinsai/tilawa/blob/ec5cdc72c1c48ba29866ca2e3197d6b9a0e2e793/packages/core/src/index.ts).
[^4]: Tilawa. [Streaming configuration and defaults](https://github.com/yazinsai/tilawa/blob/ec5cdc72c1c48ba29866ca2e3197d6b9a0e2e793/packages/core/src/types.ts).
[^5]: Tilawa. [Experiment and benchmark notes](https://github.com/yazinsai/tilawa/blob/ec5cdc72c1c48ba29866ca2e3197d6b9a0e2e793/lab/EXPERIMENTS.md).
[^6]: NVIDIA. [Arabic FastConformer Hybrid Large PCD model card](https://huggingface.co/nvidia/stt_ar_fastconformer_hybrid_large_pcd_v1.0).
[^7]: Sheheryar Pirzada. [Tilawa PR #18: retrieval allocation and memory optimization](https://github.com/yazinsai/tilawa/pull/18). Open proposal; author-reported measurements.
[^8]: Tilawa contributor issue. [Issue #19: embedded preprocessing report](https://github.com/yazinsai/tilawa/issues/19). Unverified concern.
[^9]: Tilawa. [Package metadata](https://github.com/yazinsai/tilawa/blob/ec5cdc72c1c48ba29866ca2e3197d6b9a0e2e793/packages/core/package.json); [npm registry record](https://registry.npmjs.org/@tilawa/core/latest).
[^10]: Tilawa. [Release v0.2.0](https://github.com/yazinsai/tilawa/releases/tag/v0.2.0), 30 June 2026; [export metadata](https://github.com/yazinsai/tilawa/releases/download/v0.2.0/export_metadata.json). File sizes and supplied checksums.
[^11]: Tarteel AI. [whisper-base-ar-quran model card](https://huggingface.co/tarteel-ai/whisper-base-ar-quran).
[^12]: ggml-org. [whisper.cpp](https://github.com/ggml-org/whisper.cpp).
[^13]: k2-fsa. [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx).
[^14]: Muno459. [Quran phoneme Zipformer model and usage agreement](https://huggingface.co/Muno459/zipformer_p-quran).
[^15]: Muno459. [FastConformer Quran model card](https://huggingface.co/Muno459/fastconformer-quran).
[^16]: Cyberistic. [offline-quran-validation repository](https://github.com/Cyberistic/offline-quran-validation); [GitHub repository metadata](https://api.github.com/repos/Cyberistic/offline-quran-validation).
[^17]: Expo. [FAQ: custom native code and development builds](https://docs.expo.dev/faq/).
[^18]: NativeWind. [Installation](https://www.nativewind.dev/docs/getting-started/installation).
[^19]: Founded Labs. [React Native Reusables](https://github.com/founded-labs/react-native-reusables); shadcn. [Introduction](https://ui.shadcn.com/docs).
[^20]: Supabase. [Clerk third-party authentication integration](https://supabase.com/docs/guides/auth/third-party/clerk).
[^21]: Clerk. [Enable offline support in Expo, experimental](https://clerk.com/docs/guides/development/offline-support).
[^22]: Expo. [Expo Audio documentation](https://docs.expo.dev/versions/latest/sdk/audio/). Current versioned API must be checked against the selected SDK.
[^23]: Software Mansion. [AudioRecorder documentation](https://docs.swmansion.com/react-native-audio-api/docs/inputs/audio-recorder/); [repository and license](https://github.com/software-mansion/react-native-audio-api).
[^24]: ONNX Runtime. [React Native integration](https://onnxruntime.ai/docs/get-started/with-javascript/react-native.html).
[^25]: ONNX Runtime. [Deploy on mobile](https://onnxruntime.ai/docs/tutorials/mobile/).
[^26]: Expo. [SQLite, bundled databases, SQLCipher and integrations](https://docs.expo.dev/versions/latest/sdk/sqlite/).
[^27]: Silero. [Silero VAD](https://github.com/snakers4/silero-vad).
[^28]: Android Developers. [Support 16 KB page sizes](https://developer.android.com/guide/practices/page-sizes).
[^29]: Tanzil Project. [Quran text license](https://tanzil.net/docs/Text_License).
[^30]: Tanzil Project. [Translation repository and terms](https://tanzil.net/trans/).
[^31]: Tarteel / QUL. [Quranic Universal Library resources](https://qul.tarteel.ai/).
[^32]: Tarteel / QUL. [FAQ: formats, commercial use, rights and Hafs scope](https://qul.tarteel.ai/faq).
[^33]: QuranEnc. [Developer API](https://quranenc.com/en/home/api).
[^34]: QuranEnc. [Current catalog and download formats](https://quranenc.com/en/home).
[^35]: Quran Foundation. [Developer Terms of Service](https://api-docs.quran.foundation/legal/developer-terms/); [developer FAQ](https://api-docs.quran.foundation/docs/tutorials/faq/).
[^36]: Altafsir / Royal Aal al-Bayt Institute. [Project and commissioned translations](https://www.altafsir.com/); al-Wahidi, translated by Mokrane Guezzou. [Asbab al-Nuzul](https://www.altafsir.com/Books/Asbab%20Al-Nuzul%20by%20Al-Wahidi.pdf).
[^37]: Kais Dukes / Quranic Arabic Corpus. [Data download and terms](https://corpus.quran.com/download/).
[^38]: Islamic Network. [AlQuran Cloud terms](https://alquran.cloud/terms-and-conditions), updated 14 June 2026.
[^39]: Fawaz Ahmed. [Quran API repository](https://github.com/fawazahmed0/quran-api).
[^40]: Amiri Project. [Amiri font repository and OFL license](https://github.com/aliftype/amiri).
[^41]: HadeethEnc. [Encyclopedia of Translated Prophetic Hadiths](https://hadeethenc.com/en/home).
[^42]: Sunnah.com. [About and source context](https://sunnah.com/about).
[^43]: QuranEnc. [Legacy site, Terms and Policies](https://old.quranenc.com/en/home). Reconfirm current applicability for selected editions.
[^44]: Apple. [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), especially 2.5.14 and 4.2.3.
[^45]: Android Developers. [Background foreground-service restrictions](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start).
[^46]: UK Information Commissioner’s Office. [What is special category data?](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data/).
[^47]: Tarteel AI. [EveryAyah dataset](https://huggingface.co/datasets/tarteel-ai/everyayah).
[^48]: Tarteel AI. [tlog dataset](https://huggingface.co/datasets/tarteel-ai/tlog).
[^49]: Quran-Lab. [Quranic ASR benchmark](https://huggingface.co/datasets/Quran-Lab/quranic-asr-benchmark), including 15 August 2026 reference corrections and access terms.
[^50]: Supabase. [Production checklist](https://supabase.com/docs/guides/deployment/going-into-prod).
[^51]: Supabase. [Database backups](https://supabase.com/docs/guides/platform/backups).
[^52]: PostHog. [React Native SDK documentation](https://posthog.com/docs/libraries/react-native).
