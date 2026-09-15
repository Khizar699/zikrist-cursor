# Zikrist

An offline Quran recognition and translation MVP for iOS and Android. This is a technical evaluation build, not a finished production application.

The app is a single live-translation screen: microphone capture, on-device Tilawa / ONNX recognition, and a dual-pane Arabic + English (or previously installed Urdu) passage. After the first lock, surrounding ayahs are already on screen; the focused ayah is full opacity and neighbors stay dim. It does not include session history, accounts, cloud sync, analytics, training uploads, prayer-phrase recognition, stories, chat, in-app settings, or local audio saving.

## Run this workspace

```sh
cd zikrist-cursor
npm run ios
```

For a connected iPhone, use `npm run ios -- --device`. Xcode signing and a development team must be configured for that device. A simulator is useful for interface and native integration checks; it does not establish physical microphone, battery, or locked-screen reliability.

For Android, install Android Studio's SDK, an emulator or connected phone, and the JDK required by the generated Gradle project, then run:

```sh
npm run android
```

**Use a native build, not Expo Go.** ONNX Runtime and the audio recorder are native modules. `npm start` starts Metro for an already-installed development build; it cannot install those native modules by itself.

## Set up a fresh checkout

Requirements: Node 22.13 or later, npm, and the appropriate native toolchain. iOS requires macOS, Xcode, and CocoaPods 1.16.2 (a recent Ruby is recommended). This workspace's launch script can use its project-local `.tooling` CocoaPods installation if present; that directory is not committed or required on other machines.

```sh
npm ci
npm run assets:download
npm run assets:verify
npm run ios
```

The model and recognition tables are approximately 104 MB on disk, before native runtime and application overhead. They are excluded from Git and restored from pinned URLs with SHA-256 verification. The application bundles these assets. This UI pass auto-prepares the English translation (about 1.2 MB) on first launch; a previously installed Urdu pack is still used if that is the saved language. At most two language packs are retained. Internet is needed for initial language installation and development-server loading; a release build with an installed pack performs recognition without a server.

To test without Metro, build a release configuration, install the language while online, then disconnect networking:

```sh
npm run ios -- --configuration Release
```

## Try the MVP

1. Allow the first-launch English pack download to finish (or use a previously installed language). There is no language picker in this build.
2. Tap the circle at the bottom, allow microphone access, and play an audible recitation from another device or speaker. The app does not capture another app's digital audio stream. While listening, the circle expands into a live waveform; tap the bar to stop.
3. Begin anywhere in the Quran. Shared openings such as `قُلْ` appear as heard Arabic words without naming an ayah or showing a translation; the full verse appears once a unique continuation confirms it (Al-Ikhlas from `هُوَ`, not a long lookalike such as 10:16). First location needs a unique stretch of recitation (often about a second once the opening is distinguishable). The shared Basmala is not enough to name a surah. Al-Fatihah should lock from Alhamdulillah (1:2), not from 1:3 (the Basmala tail) or a later ayah already in the same window. `الحمد لله` alone is also shared with Ibrahim 14:39, so 1:2 waits for `رب` and must not display 14:39/14:40. After that lock, 1:3 (Ar-Rahman) must still be able to take over; those two words are not enough to keep the screen on 1:2. After 1:5, unique 1:6 opening words must take over even when the overlapping 1.2 s window still contains the 1:5 tail. An-Nas and Al-Falaq stay unresolved until the distinguishing words, including a later short ayah such as Falaq 2 or An-Nas 2–4. After lock, following uses about 1.2 s of audio every 0.4 s (about 3× overlap) and scores the current ayah, the previous ayah, and unique post-Basmala words of the mushaf-next ayah. After a surah finishes, remaining later short surahs and Al-Fatihah are scored before a full-Quran locate, so Kawthar can be followed by Ikhlas without treating Al-Baqarah as the default. A salah prior file only breaks close ties; it does not hide the rest of the mushaf. Bismillah after Al-Fatihah does not keep Al-Baqarah as the neighborhood. A global search runs if that neighborhood stops explaining the audio. Short ayahs such as An-Nas 2–3 are scored as present in the listening window so a long unrelated ayah cannot take the screen. After lock, the current surah and the next surah are loaded into memory, and each pane shows the previous, current, and next ayahs in the same surah. Neighbors stay at 10% opacity. The focused translation moves only after a confirmed `verse_match`, not from coverage. The first ayah of the next surah is not shown from coverage or Basmala alone. Finishing An-Nas and starting Al-Fatihah is treated as a new location, not as a following surah. Bismillah after Al-Fatihah does not continue into Al-Baqarah. Bismillah after a finished surah does not lock Al-Fatihah 1:1. A short pause keeps the last verse on screen; a stop of about ten seconds searches again without joining that silence to the next recitation.
4. Audio is not saved. Sessions have a one-hour MVP limit. Training contribution is not enabled.
5. Test manual screen locking during an active session on a physical phone. Microphone access does not imply consent to retain audio.

The microphone is off until you tap the circle. The app does not infer that prayer has ended from a short pause. End a session by tapping the waveform. If interrupted by the operating system, the session ends and must be started again.

Stopping discards pending inference results. A final fragment that has not yet been confirmed may not appear.

## Verification commands

```sh
npm run typecheck
npm run lint
npm test
npm run assets:verify
npm run export
npm audit
```

The tests cover serialized/bounded capture processing, acquire/follow/reacquire verse tracking (including Al-Fatihah locking from 1:2, Falaq after 1:7, An-Nas staying off a long unrelated ayah, Al-Fatihah not locking Ibrahim 14:39/14:40 from shared Alhamdulillah, Kawthar then a later short surah, leftover Quraysh 106:1 after Asr 103:3 even when that last ayah locked before 82% coverage, a 103:3 interior token remains in the window, or a 103:3 tail token follows 106:1 in decode order, leftover crumbs that do not re-lock 103:1 until Quraysh tokens can lock 106:1, leftover Basmala after that last ayah not locking mushaf-next, a salah prior that cannot override a clearer acoustic match, and Ikhlas not first-locking a long `قُلْ` lookalike such as 10:16), live first-match display versus silence-flush/jump guards, sequential helpers, held-verse display, confirmed-match ordering, language-pack eviction, and equivalence of Tilawa's patched search against the original algorithm, including a cap so short queries do not score all 6,236 verses.

See [VALIDATION.md](VALIDATION.md) for observed results and remaining tests. A score of 0.9 is a matching score, not a calibrated 90% confidence probability. Model-runtime timing is not microphone-to-screen latency.

## Architecture

- `src/services/listening.ts`: one capture owner, lifecycle, interruptions, native background notification, recognition and display coordination.
- `src/services/model.ts`: lazy native assets, ONNX runtime, replaceable Tilawa adapter.
- `src/core/follower.ts`: live acquire / follow / reacquire. Tilawa supplies transcription and the Quran index; it does not own following. Follow uses about 1.2 s of audio every 0.4 s (about 3× overlap). After a short last ayah of the current surah (≤ 4 body words), follow grows to about 5 s; leftover penultimate audio is trimmed to a short seed before the next batch is appended. After a finished last ayah, leftover tokens that do not explain the current body are pooled/located as a new recitation even before 82% coverage; if they cannot lock yet, follow keeps the window and the next hops use the 4 s acquire window. Shared Basmala leftover still does not lock mushaf-next. Shared openings can emit heard Arabic words without a verse claim.
- `src/core/salah-prior.ts`: editable salah ranking file. Tie-break only; predictions are not translations.
- `src/core/recognition-clocks.ts`: in-memory ONNX / decode / locate / queue timings. Not shown in the UI; not sent anywhere.
- `src/core/`: bounded audio queue, capture/pause policy, continuation guard, sequential helpers, passage window, confirmed-match timeline, pack policy, SQLite schema.
- `src/services/content.ts`: immutable Arabic display, verified and staged translation downloads, verse lookup and current-plus-next surah preload.
- `src/services/storage.ts`: local language setting and installed pack records.
- `src/App.tsx`, `src/ui/`: single translation screen, dual Arabic/translation verse lists, growing heard-word prefix until confirm, morphing listen control.
- `plugins/with-private-storage.cjs`: backup exclusions / iOS file protection, pinned native runtime and early FFmpeg disable configuration.

Inference is native but Tilawa's decoder and retrieval execute in JavaScript. Their CPU and memory use still need physical-device profiling. The queue never runs concurrent inference and resets after dropped audio. It does not claim to eliminate the native library's own callback delivery overhead.

Live display stores accepted `verse_match` events in memory for the active session only. Tilawa's retrospective `final_sequence` is intentionally not used to rewrite the screen, since it can deduplicate repetitions and include a different best path.

## Dependencies and content rights

Exact packages are locked in `package-lock.json`. The Tilawa 0.1.0 package uses the v0.2.0 asset set; those are different version schemes. A reproducible MIT-licensed patch adopts the upstream search-memory optimization from commit `0856cd1491a08c3c437f52add6a07ca22acc3183`, returns locate results below score 0.8 for Zikrist to apply its own lock bar, caps short-query candidates, and warms span tables at model load; see [patches/README.md](patches/README.md).

The code license, model weights, Arabic text, translations, fonts, and evaluation audio have separate terms. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [Zikrist-research.md](Zikrist-research.md). Translation-edition redistribution approval and model training/weight provenance review remain public-release requirements. This repo does not assert that all commercial rights are cleared.

Read [AGENTS.md](AGENTS.md) before extending the implementation. The focused cleanup for this listening-only pass is in [prompts/strip-to-listening-workflow.md](prompts/strip-to-listening-workflow.md).

## Acoustic replay (Sim QA)

Headless faster-than-live fixture replay through the live follower path (ONNX CPU + `RecitationFollower` + `ContinuationGate`). Not phone/mic latency. Not Tilawa's streaming tracker.

Restore EveryAyah/Alafasy 16 kHz mono WAV fixtures (gitignored under `artifacts/recitation/`, SSSAAA names like `108001.wav`):

```bash
npm run fixtures:recitation
npm run test:replay -- --check-fixtures
```

Suite commands:

```bash
npm run test:replay                 # all suites (same as -- all)
npm run test:replay -- all
npm run test:replay -- core         # fatiha + ikhlas + nas
npm run test:replay -- fatiha
npm run test:replay -- ikhlas
npm run test:replay -- nas
npm run test:replay -- kawthar
npm run test:replay -- falaq
npm run test:replay -- asr
npm run test:replay -- quraysh
npm run test:replay -- longer       # Al-Baqarah 2:1–5
npm run test:replay -- jump         # Kawthar then Ikhlas
npm run test:replay -- english-negative
npm run test:replay -- basmala-hold
npm run test:replay -- back-to-back # Asr then Quraysh
npm run test:replay -- cold-start-mid
npm run test:replay -- stall-after-lock
npm run test:replay -- --list
```

Each suite writes `artifacts/qa-runs/replay-<suite>.json` with `matches[{surah,ayah,audioSeconds,score}]`, `firstLockSeconds`, `clocks`, `failureMode`, `wrongSurahRate`, `wrongSurahCount`, and `firstLockWrongSurah`. `english-negative` PASSes only when no verse commits. `basmala-hold` PASSes only when `001001` alone locks neither 1:1 nor any other verse. Honest `failureMode` strings are expected when the current follower misses a suite — this harness does not retune acquire/follow.

Requires `onnxruntime-node` (devDependency), pinned model assets (`npm run assets:download`), and the WAV fixtures. Cloud/Linux agents can unit-test gates without ONNX; acoustic scoring is for a machine that already has the model + clips (typically Sim QA on Mac).

