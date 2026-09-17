# Zikrist

An offline Quran recognition and translation MVP for iOS and Android. This is a technical evaluation build, not a finished production application.

## Continuing from GitHub / Cursor

Friends and new bots: [HANDOFF.md](HANDOFF.md) **Tip state**, then **Bot start protocol** (`AGENTS.md` → the one prompt Tip names).

**Terminal commands in order:** see **[SETUP.md](SETUP.md)** (copy-paste checklist).

**First clone (app on simulator):**

```sh
npm ci          # or npm i
npm run setup   # downloads ~104 MB gitignored ONNX model + verifies
npm run ios     # Expo prebuild + native build (not Expo Go)
```

**Recognition / overnight bots** also need evaluation audio (gitignored, not LFS):

```sh
npm run setup -- --fixtures
# same as: fixtures:recitation + fixtures:imam
```

**Open this folder in Cursor** — Agent/Composer always loads:

- [AGENTS.md](AGENTS.md) (via handoff protocol)
- [.cursor/rules/zikrist-continuity.mdc](.cursor/rules/zikrist-continuity.mdc)
- [.cursor/rules/zikrist-recognition-ratchet.mdc](.cursor/rules/zikrist-recognition-ratchet.mdc) — premade test suite, dual bar, **growing** regression corpus

Still bump `HANDOFF.md` every PR. Recognition work: run the Mac **Agent verify loop** yourself ([prompts/real-imam/algo/PRODUCT-BAR.md](prompts/real-imam/algo/PRODUCT-BAR.md)); lock every fix into permanent tests ([prompts/real-imam/algo/RATCHET.md](prompts/real-imam/algo/RATCHET.md)). Founder iOS preview is optional smoke — not the gate. Pack index: [prompts/real-imam/algo/README.md](prompts/real-imam/algo/README.md).

The app is a single live-translation screen: microphone capture, on-device Tilawa / ONNX recognition, and a dual-pane Arabic + English (or previously installed Urdu) passage. After the first lock, surrounding ayahs are already on screen; the focused ayah is full opacity and neighbors stay dim. It does not include session history, accounts, cloud sync, analytics, training uploads, stories, chat, in-app settings, or local audio saving.

An offline **salah liturgy phrase pack** (`assets/content/salah-liturgy.json`) ships Arabic + English glosses, IDs, categories, and SHA-256 row hashes for Phase 1 formulas (takbeer, thana, istiʿadha, ruku/sujood tasbih, rising from ruku, tashahhud, darood Ibrahimiyyah, amin, tasleem). English is labeled a liturgy/prayer gloss, not a Quran translation. A separate matcher (`src/core/salah-liturgy-matcher.ts`) scores Tilawa transcript tokens against that pack and emits `kind: 'salah_liturgy'` locks. The listening screen then looks up that pack row and shows **Arabic + the pack English gloss**, labeled Prayer / liturgy so it is not presented as a Quran ayah. Quran dual-pane passage follow still takes over on the next `verse_match`. This v1 set is a common mosque subset, not every madhhab variant, and is not claimed imam-ready. Qunoot and a separate liturgy Basmala row stay deferred. Verify the pack with `npm run liturgy:verify` (also hooked from `npm run assets:verify`). Headless liturgy replay is registered (`npm run test:replay -- liturgy`); `liturgy-takbeer` and `liturgy-thana` are `status: ready` after generating their gitignored WAVs (`npm run liturgy:tts -- liturgy-takbeer` / `liturgy-thana`) and remaining suites skip with `missing_fixture` (not a PASS). Quran replay `npm run test:replay -- all` remains the 14-suite regression gate. Matcher thresholds were not retuned for this harness pass.

## Run this workspace

After `npm run setup` (once per machine):

```sh
cd zikrist-cursor
npm run ios
```

`npm run ios` refuses to start if the ONNX model is missing — that usually means `npm run setup` was skipped.
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
npm run setup
npm run ios
```

`npm run setup` downloads the pinned recognition model (~104 MB, gitignored), verifies checksums, and fails early if a leftover `ios/` tree is missing the microphone privacy string or looks like a stock `org.name.Zikrist` template (fix: `npx expo prebuild --platform ios --clean`). Add `--fixtures` when you need Mac replay audio.

Friends restoring **evaluation audio** only: `npm run fixtures:recitation` then `npm run fixtures:imam`. Liturgy TTS wavs: ffmpeg on `PATH` then `npm run liturgy:tts -- <id> --engine say` (Mac Majed). New agents: the top of `HANDOFF.md` is the no-history briefing.

The model and recognition tables are approximately 104 MB on disk, before native runtime and application overhead. They are excluded from Git and restored from pinned URLs with SHA-256 verification. The application bundles these assets. This UI pass auto-prepares the English translation (about 1.2 MB) on first launch; a previously installed Urdu pack is still used if that is the saved language. At most two language packs are retained. Internet is needed for initial language installation and development-server loading; a release build with an installed pack performs recognition without a server.

To test without Metro, build a release configuration, install the language while online, then disconnect networking:

```sh
npm run ios -- --configuration Release
```

## Try the MVP

1. Allow the first-launch English pack download to finish (or use a previously installed language). There is no language picker in this build.
2. Tap the circle at the bottom, allow microphone access, and play an audible recitation from another device or speaker. The app does not capture another app's digital audio stream. While listening, the circle expands into a live waveform; tap the bar to stop.
3. Begin anywhere in the Quran. Shared openings such as `قُلْ` appear as heard Arabic words without naming an ayah or showing a translation; the full verse appears once a unique continuation confirms it (Al-Ikhlas from `هُوَ`, not a long lookalike such as 10:16). First location needs a unique stretch of recitation (often about a second once the opening is distinguishable). The shared Basmala is not enough to name a surah. Al-Fatihah should lock from Alhamdulillah (1:2), not from 1:3 (the Basmala tail) or a later ayah already in the same window. `الحمد لله` alone is also shared with Ibrahim 14:39, so 1:2 waits for `رب` and must not display 14:39/14:40. After that lock, 1:3 (Ar-Rahman) must still be able to take over; those two words are not enough to keep the screen on 1:2. After 1:5, unique 1:6 opening words must take over even when the overlapping 1.2 s window still contains the 1:5 tail. An-Nas and Al-Falaq stay unresolved until the distinguishing words, including a later short ayah such as Falaq 2 or An-Nas 2–4. After lock, following uses about 1.2 s of audio every 0.4 s (about 3× overlap) and scores the current ayah, the previous ayah, and unique post-Basmala words of the mushaf-next ayah. After a surah finishes, remaining later short surahs and Al-Fatihah are scored before a full-Quran locate, so Kawthar can be followed by Ikhlas without treating Al-Baqarah as the default. A salah prior file only breaks close ties; it does not hide the rest of the mushaf. Bismillah after Al-Fatihah does not keep Al-Baqarah as the neighborhood. A global search runs if that neighborhood stops explaining the audio. Short ayahs such as An-Nas 2–3 are scored as present in the listening window so a long unrelated ayah cannot take the screen. After lock, the current surah and the next surah are loaded into memory, and each pane shows the previous, current, and next ayahs in the same surah. Neighbors stay at 10% opacity. The focused translation moves only after a confirmed `verse_match`, not from coverage. The first ayah of the next surah is not shown from coverage or Basmala alone. Finishing An-Nas and starting Al-Fatihah is treated as a new location, not as a following surah. Bismillah after Al-Fatihah does not continue into Al-Baqarah. Bismillah after a finished surah does not lock Al-Fatihah 1:1. A short pause keeps the last verse on screen; a stop of about ten seconds searches again without joining that silence to the next recitation. If the matcher locks a salah liturgy phrase (for example takbeer, thana, or ruku tasbih), the same screen shows that phrase’s Arabic and pack English gloss under a Prayer / liturgy label instead of an ayah; the next confirmed ayah restores the dual-pane passage. This is not full madhhab coverage.
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

### Recognition regression (Mac — premade suite)

After `npm run fixtures:recitation` and `npm run fixtures:imam` (ffmpeg on `PATH`):

```sh
npm test
npm run typecheck
npm run test:replay -- all                    # floor: 14 EveryAyah-style suites; record honest N/14
npm run test:replay -- imam-mid-surah-cold    # ready mosque; must PASS
npm run test:replay -- imam-mid-surah-cold-qiyam
npm run test:coverage -- --list               # Tier A sample (scoreboard)
npm run test:coverage -- --dry-run            # fixture presence only
npm run findings:report                       # open finding_ids for Tip
# Tip / product-bar clip example (current handoff concern):
npx tsx scripts/replay.ts \
  artifacts/recitation/imam/imam-multi-qari/qari-a/imam-multi-qari__hafiz-usama__001-027-015__raw.wav
```

**Standards:** [PRODUCT-BAR.md](prompts/real-imam/algo/PRODUCT-BAR.md) · [RATCHET.md](prompts/real-imam/algo/RATCHET.md) · [COVERAGE.md](prompts/real-imam/algo/COVERAGE.md) · findings [`prompts/real-imam/findings/`](prompts/real-imam/findings/) · tip known-fails in [HANDOFF.md](HANDOFF.md). `all` green ≠ prayer-follow or all-surah coverage. Linux ONNX is not the Mac floor gate.

To add a liturgy phrase later: append a row in `assets/content/salah-liturgy.json` with the eight required fields; set `arabic_recognition_normalized` via `normalizeLiturgyArabic`; set `sha256` to SHA-256 of `id`, `category`, `arabic_uthmani`, `arabic_recognition_normalized`, `english`, `source_note`, and `license_status` joined by newlines; then run `npm run liturgy:verify`. Do not put contested qunoot in the live list. Liturgy replay: generate takbeer/thana WAV on Mac with `npm run liturgy:tts -- liturgy-takbeer` or `npm run liturgy:tts -- liturgy-thana --engine say` (founder Mac: edge-tts 403; `say` Majed `ar_001`; ffmpeg on PATH e.g. `/tmp/ffmpeg-static`; same dest as clip_path), then `npm run test:replay -- liturgy-takbeer` / `liturgy-thana` (ready path; not skip). Other liturgy suites still skip until filled; see `prompts/salah-liturgy/04-replay-suites.md`.

The tests cover serialized/bounded capture processing, acquire/follow/reacquire verse tracking (including Al-Fatihah locking from 1:2, Falaq after 1:7, An-Nas staying off a long unrelated ayah, Al-Fatihah not locking Ibrahim 14:39/14:40 from shared Alhamdulillah, Kawthar then a later short surah, leftover Quraysh 106:1 after Asr 103:3 even when that last ayah locked before 82% coverage, a 103:3 interior token remains in the window, or a 103:3 tail token follows 106:1 in decode order, leftover crumbs that do not re-lock 103:1 until Quraysh tokens can lock 106:1, leftover Basmala after that last ayah not locking mushaf-next, a salah prior that cannot override a clearer acoustic match, Ikhlas not first-locking a long `قُلْ` lookalike such as 10:16, An-Nisa 4:129 not first-locking Fussilat 41:34 from a shared `ول-/تست-` prefix, and Ya-Sin 36:16 not first-locking short An-Naba 78:4 from a shared `علم` root), salah liturgy token locks (takbeer, thana, ruku/sujood, tashahhud, darood, salam) versus Quran-like negatives, liturgy on-screen pack gloss (takbeer / thana / ruku) that yields to a later `verse_match` passage, live first-match display versus silence-flush/jump guards, sequential helpers, held-verse display, confirmed-match ordering, language-pack eviction, and equivalence of Tilawa's patched search against the original algorithm, including a cap so short queries do not score all 6,236 verses.

See [VALIDATION.md](VALIDATION.md) for observed results and remaining tests. A score of 0.9 is a matching score, not a calibrated 90% confidence probability. Model-runtime timing is not microphone-to-screen latency.

## Architecture

- `src/services/listening.ts`: one capture owner, lifecycle, interruptions, native background notification, recognition and display coordination.
- `src/services/model.ts`: lazy native assets, ONNX runtime, replaceable Tilawa adapter.
- `src/core/follower.ts`: live acquire / follow / reacquire. Tilawa supplies transcription and the Quran index; it does not own following. First lock keeps about 8 s so a trailing ayah-1 muqattaʿāt token (`الم`) is not slid off; reacquire stays 4 s. Follow uses about 1.2 s of audio every 0.4 s (about 3× overlap). After a short last ayah of the current surah (≤ 4 body words), follow grows to about 5 s; leftover penultimate audio is trimmed to a short seed before the next batch is appended. After a finished last ayah, leftover tokens that do not explain the current body are pooled/located as a new recitation even before 82% coverage; if they cannot lock yet, follow keeps the window and the next hops use the 4 s acquire window. Shared Basmala leftover still does not lock mushaf-next. Shared openings can emit heard Arabic words without a verse claim. Exact post-Basmala muqattaʿāt may first-lock ayah 1 without waiting for ayah 2; Basmala-echo `الرحمن` still does not name 55:1. Mid-surah cold acquire refuses a short distant champion that leaves distinctive tokens unexplained (`يعلم` is not `كلا سيعلمون`) and holds a long ayah whose unique token is still confusable (`تستوي` / `تستطيعوا`) until a later body word.
- `src/core/salah-prior.ts`: editable salah **surah ranking** file (not liturgy text). Tie-break only; predictions are not translations.
- `src/core/salah-liturgy.ts` + `assets/content/salah-liturgy.json`: versioned offline liturgy phrase pack (schema, hashes).
- `src/core/salah-liturgy-matcher.ts`: offline liturgy detector on the same transcript tokens as `RecitationFollower`. Emits `{ kind: 'salah_liturgy'; phraseId; category; atMs; confidence? }` — not a `verse_match`. Short phrases (takbeer, amin, short jamiʿ bayn) need isolation / not-mid-ayah evidence. Live listening drops Quran commits for that hop when liturgy locks.
- `src/core/salah-liturgy-display.ts`: pack-row lookup for on-screen Arabic + liturgy-gloss English. Scores are not shown as percent certainty. Unknown ids show nothing (no invented English).
- `src/core/recognition-clocks.ts`: in-memory ONNX / decode / locate / queue timings. Not shown in the UI; not sent anywhere.
- `src/core/`: bounded audio queue, capture/pause policy, continuation guard, sequential helpers, passage window, confirmed-match timeline, pack policy, SQLite schema.
- `src/services/content.ts`: immutable Arabic display, verified and staged translation downloads, verse lookup and current-plus-next surah preload.
- `src/services/storage.ts`: local language setting and installed pack records.
- `src/App.tsx`, `src/ui/`: single translation screen, dual Arabic/translation verse lists, Prayer / liturgy panes for a locked salah phrase, growing heard-word prefix until confirm, morphing listen control.
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
npm run fixtures:imam              # GitHub Release zip → artifacts/recitation/imam/ (see HANDOFF.md)
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
npm run test:replay -- real-imam                  # ready Subayyal + Qiyam (need restored WAV); other stubs skip missing_fixture (not PASS)
npm run test:replay -- imam-mid-surah-cold        # ready: Subayyal 4:129–130; must PASS after npm run fixtures:imam
npm run test:replay -- imam-mid-surah-cold-qiyam  # ready: Qiyam 36:16–18; must PASS after npm run fixtures:imam
npm run liturgy:tts -- liturgy-takbeer     # Mac: 16 kHz mono PCM16 from pack Arabic (edge-tts ar-SA-HamedNeural -25%, or say+ffmpeg)
npm run liturgy:tts -- liturgy-thana --engine say  # Mac after edge-tts 403: ffmpeg on PATH (e.g. /tmp/ffmpeg-static); say Majed ar_001; same dest as clip_path
npm run test:replay -- liturgy-takbeer     # ready liturgy suite (generate WAV first; must PASS, not skip)
npm run test:replay -- liturgy-thana       # ready liturgy suite (generate WAV first; must PASS, not skip)
npm run test:replay -- liturgy             # takbeer/thana if WAV present; remaining stubs skip missing_fixture
npm run test:replay -- salah-liturgy       # alias of liturgy
npm run test:replay -- --include-pending   # 14 + real-imam + liturgy (stubs skip; ready needs WAV)
```

Each suite writes `artifacts/qa-runs/replay-<suite>.json` with `matches[{surah,ayah,audioSeconds,score}]`, `firstLockSeconds`, `clocks`, `failureMode`, `wrongSurahRate`, `wrongSurahCount`, and `firstLockWrongSurah`. `english-negative` PASSes only when no verse commits. `basmala-hold` PASSes only when `001001` alone locks neither 1:1 nor any other verse. Honest `failureMode` strings are expected when the current follower misses a suite — this harness does not retune acquire/follow.

Default `npm run test:replay -- all` is the original **14** EveryAyah suites and remains the Quran **regression floor** (record honest N/14; do not claim 14/14 if red). Ready mosque suites and Tip product-bar clips are additional mandatory verify when recognition changes — see [PRODUCT-BAR.md](prompts/real-imam/algo/PRODUCT-BAR.md). Every claimed fix must add a permanent lock so the suite **grows** ([RATCHET.md](prompts/real-imam/algo/RATCHET.md)). The real-imam pack uses Prompt Smith docs in `prompts/real-imam/` (queue, FIXTURES, LIVE-FEEL, suite prompts, `manifest.stub.json`). Founder-verified ayah + timestamp labels are in `prompts/real-imam/LABELS.md` and `labels.json` (ground truth; ignore hypothesized probe locks). **`imam-mid-surah-cold` is `status: ready`** (Dr Subayyal An-Nisa **4:129–130**, clip `imam-mid-surah-cold__dr-subayyal__004-129-130__raw.wav`). **`imam-mid-surah-cold-qiyam` is `status: ready`** (Qiyam-ul-Lail Faisal Ya-Sin **36:16–18**, clip `imam-mid-surah-cold__qiyam-faisal__036-016-018__raw.wav` under the sibling folder). Other real-imam suites stay `stub`. PR **#17** Mac-green on merge cleared the prior false locks (Subayyal 4:129≠41:34, Qiyam 36:16≠78:4); this fill PR does not claim a new Mac acoustic score — Bot/Sim QA / local Mac Agent runs `npm run test:replay -- imam-mid-surah-cold-qiyam` and confirms Subayyal still PASS. Friends restore clips with `npm run fixtures:imam` from GitHub Release tag `imam-fixtures-v1` (not git LFS; see [HANDOFF.md](HANDOFF.md); restore also copies Qiyam into `imam-mid-surah-cold-qiyam/qari-a/`). Founder drop path: `~/Desktop/zikrist-imam-clips/`. Staging (gitignored): `artifacts/recitation/imam/<suite-id>/<qari-or-source>/`. `npm run test:replay -- real-imam` scores the ready suites when the WAVs exist and **skips** remaining stubs with `missing_fixture` — it does not PASS those stubs.

Salah liturgy replay (`prompts/salah-liturgy/manifest.stub.json`): staging (gitignored) `artifacts/recitation/liturgy/<suite-id>/`. **`liturgy-takbeer` and `liturgy-thana` are `status: ready`** with clips `liturgy-takbeer/liturgy-takbeer__edge-tts__ar-SA-HamedNeural.wav` and `liturgy-thana/liturgy-thana__edge-tts__ar-SA-HamedNeural.wav`. Mac generates those 16 kHz mono PCM16 WAVs from pack `arabic_uthmani`. Founder Mac: edge-tts HTTP 403; working thana command is `export PATH="/tmp/ffmpeg-static:$PATH"` then `npm run liturgy:tts -- liturgy-thana --engine say` (`say` Majed `ar_001`, same dest as clip_path). Then `npm run test:replay -- liturgy-takbeer` and `liturgy-thana` must PASS (not skip). Default `all` stays the original **14** Quran names. Other liturgy suites remain stubs and **skip** with `missing_fixture` — not PASS. No liturgy evaluation audio is committed; do not drop silent fake WAVs. Mixed suites may reuse EveryAyah Fatiha WAVs only for the Quran half after `npm run fixtures:recitation`. Scoring uses PCM through `RecitationFollower.lastHeardTokens` + `SalahLiturgyMatcher` (same as live listening). Sample skip JSON (still-stub ruku): `fixtures/salah-liturgy/sample-skip.json`.

Phrases still lacking audio (no ready WAV under `artifacts/recitation/liturgy/`):

- Suites still stub: `ruku_tasbih`, `sujood_tasbih`, `tashahhud` (plus mixed takbeer/thana around Fatiha).
- Ready clips to generate locally (not in git): `takbeer`, `thana`.
- Shipped pack rows with no suite yet: `istiadha`, `ruku_tasbih_wabihamdihi`, `sujood_tasbih_wabihamdihi`, `sami_allahu_liman_hamidah`, `rabbana_wa_lakal_hamd`, `rabbana_lakal_hamd`, `allahumma_rabbana_wa_lakal_hamd`, `darood_ibrahim_salat`, `darood_ibrahim_barik`, `darood_ibrahim`, `amin`, `assalamu_alaikum_warahmatullah`, `assalamu_alaikum_warahmatullah_wabarakatuh`.
- `liturgy-english-negative` needs dedicated non-Arabic speech; do not mark the existing Quran `english-negative.wav` ready.

This is not a mosque/device liturgy accuracy claim. Shared replay helpers changed; Mac must re-verify `npm run test:replay -- all` = 14/14. Linux ONNX is not that gate.

Requires `onnxruntime-node` (devDependency), pinned model assets (`npm run assets:download`), and the WAV fixtures. Cloud/Linux agents can unit-test gates without ONNX; acoustic scoring is for a machine that already has the model + clips (typically Sim QA on Mac). Quran `all` scoring still needs EveryAyah restore via `npm run fixtures:recitation`. Real-imam clips restore via `npm run fixtures:imam` (GitHub Release zip; missing release is a clear 404 until the maintainer uploads it). Liturgy wavs are regenerated with `npm run liturgy:tts -- <id> --engine say` (gitignored) and are not in the imam zip. Liturgy-thana on founder Mac: `export PATH="/tmp/ffmpeg-static:$PATH"` then `npm run liturgy:tts -- liturgy-thana --engine say` (Majed `ar_001`).

