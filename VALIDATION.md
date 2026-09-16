# MVP validation

Status: implementation and integration validation in progress. No physical phone or mosque test has been completed.

## Completed checks

- TypeScript compilation and ESLint passed.
- Automated regression tests covering queue ordering/backpressure/cancellation, acquire/follow/reacquire tracking (including An-Nas then Al-Fatihah, Basmala after An-Nas not locking 1:1, Al-Fatihah locking from 1:2 rather than 1:4, 1:2 advancing to 1:3 including live Arabic الرحمن/الحمد, 1:5 advancing to 1:6 from its opening even when the 1:5 tail is still in the 1.2 s window, 1:6 not advancing to 1:7 from the shared sirat word, Al-Falaq taking over after 1:7 while An-Nas stays a close rival, An-Nas ayah 3 not jumping to a long unrelated ayah, Al-Fatihah 1:2 not becoming Ibrahim 14:39/14:40 from shared `الحمد لله` or leftover `رب العلمين`, a wrong 14:40 lock yielding to unique 1:5 words, Kawthar then a later short surah without a second global search, leftover Quraysh 106:1 after finished Asr 103:3 while the last-ayah tail remains in the follow window, leftover Basmala after that last ayah not locking mushaf-next Humazah, a last-10 prior that cannot hide a clearer acoustic match, a one-word ayah-1 body after Basmala confirming on that unique word, a short next/final ayah advancing from unused tail tokens or a garbled unique opening, an Asr-like opening not first-locking a distant lookalike, An-Nisa 4:129 not first-locking Fussilat 41:34 from a shared `ول-/تست-` prefix, Ya-Sin 36:16 not first-locking short An-Naba 78:4 from a shared `علم` root, local recognition clocks, coverage not revealing the next ayah, a shared `قل` opening pairing heard words without naming an ayah, and Ikhlas audio not first-locking Yunus 10:16), live first-match display, silence-flush and unexpected-jump guards, sequential next-ayah helpers, passage window, held-verse replacement, confirmed-match order, pack eviction, the Tilawa memory patch, and a candidate cap so short queries do not score all 6,236 verses.
- Both iOS and Android JavaScript/native-asset exports succeeded.
- SHA-256 verification passed for the model and its companion assets.
- All 6,236 canonical Arabic display verses match the downloaded Tanzil text exactly.
- All 6,236 recognition token round trips passed.
- Both development copies of the English and Urdu databases passed hash, verse-count, unique-reference, text and footnote checks. These files are not bundled in the app.
- `npm audit` reported zero vulnerabilities after scoped overrides.

## Actual acoustic replay

On this Apple Silicon Mac, the real ONNX model was fed four EveryAyah/Alafasy Al-Ikhlas verse clips as consecutive 250 ms chunks. Total audio: 13.124 seconds. The unmodified acceptance path confirmed 112:1, 112:2, 112:3, 112:4, then incorrectly committed 74:29 near trailing silence.

The app now applies an additional guard: unexpected jumps and silence-flush first locations need subsequent voiced audio and matching word progress; a live first location and expected continuation keep the direct path. Replaying the same audio through that guard confirmed only 112:1–4, in order. The regression tests separately verify that a real jump can recover with new evidence.

One guarded replay observed (previous conservative profile: 2 s discovery trigger, two repeat cycles, first match held until extra voiced progress):

| Measurement | Result |
| --- | --- |
| First location, measured in input audio | 4.0 seconds |
| Subsequent confirmation positions | 5.5 s, 7.5 s, 10.0 s |
| Model / text-engine setup | ~834 ms |
| Total faster-than-live replay processing | ~4.60 s |
| Median native inference call | ~85 ms |
| Peak desktop process RSS | ~667 MB |

Live listening uses a Zikrist acquire / follow / reacquire loop on Tilawa transcription and the Quran index. It does not use Tilawa's streaming tracker for microphone following. Acquire locates on about a second of voiced audio and prefers the earliest lockable ayah in a span (Al-Fatihah from 1:2, not 1:3 or 1:4 already in the same window). A shared opening such as `قل` is shown as heard words only; a later shared `الله` must not skip distinctive words and name a long lookalike such as 10:16. Shared `الحمد لله` is not enough to name 1:2 or Ibrahim 14:39; 1:2 waits for `رب`, and leftover `رب العلمين` must not commit 14:40 (`العلمين` is not `اجعلني`). A window that only matches that shared formula does not keep an Ibrahim neighborhood high enough to block reacquire. After lock, a 1.2 s follow window on a 0.4 s hop scores the current ayah, the previous ayah, and unique post-Basmala words of the mushaf-next ayah; Bismillah after Al-Fatihah does not keep Al-Baqarah as the neighborhood. When mushaf-next is the last ayah of the current surah and is short (≤ 4 body words), that follow window grows to about 5 s and the penultimate tail is dropped once the current ayah is complete, so a stretched last ayah such as An-Nas 114:6 is not decoded from 1.2 s crumbs. After the last ayah of a surah, leftover tokens that do not explain the current body are a new recitation even if that last ayah locked before 82% word coverage: a bounded next-surah pool (Al-Fatihah and remaining later short surahs, then famous openings) runs on that leftover before a full-Quran locate, leftover last-ayah audio does not keep the neighborhood high enough to stall, and leftover that cannot lock yet leaves follow so the next hops use the 4 s acquire window on kept audio. A salah prior file may break close ties; it cannot become the translation. A global locate runs if that neighborhood or pool stops explaining the audio. Short ayahs are scored as present in the window so a mix of An-Nas 2–3 cannot lose to a long ayah such as 2:109. Completing An-Nas has no following surah; the next recitation, including Al-Fatihah, is a fresh locate on new audio rather than a blocked jump. Shared Basmala after a finished surah does not lock Al-Fatihah 1:1 or mushaf-next. Completing the last ayah of a surah does not display the next surah from coverage or Basmala; unique words after Basmala are still required. If the neighborhood fails mid-surah, reacquire keeps the current window so the new opening is not discarded. Silent microphone frames are not inferred. After lock, the current surah and the next surah are preloaded into memory; each pane lists only the previous ayah, the current ayah, and the next ayah in the same surah. The focused ayah is full opacity; neighbors stay at 10% opacity. The focused translation does not move from coverage; it waits for an accepted `verse_match`. A pause of a few seconds keeps the last verse on screen. A stop of about ten seconds searches again without joining that silence to later audio, and keeps the last confirmed verse as the continuation prior. The shared opening Basmala (1:1, and ayah 1 of other surahs) is held until unique words arrive. Unexpected jumps still need later voiced progress. The earlier 4.0 s figure is not the current target; a 1–3 s first location is an evaluation goal for *unique* verses and has not been re-measured on a physical phone. Device reports of late Fatiha/Nas locks, a missed Falaq jump, Al-Fatihah freezing on 1:2 after Alhamdulillah, Al-Fatihah freezing on 1:5 after a faster lock, and Al-Fatihah displaying Ibrahim 14:40 from the first verse were used to add these guards; they are not a new physical-device accuracy measurement. After a 1:2 lock, 1:3 is committed from its own words; الرحمن is not treated as الحمد, and Basmala 1:1 does not keep the 1:2 neighborhood. After a 1:5 lock, unique 1:6 opening words commit 1:6 even when the overlapping follow window still contains the 1:5 tail; a mixed-window similarity score must not keep 1:5 on screen.

In-memory recognition clocks record window seconds, ONNX ms, CTC-decode ms, locate ms (0 when following without a global search), queue wait, a short JS-thread stall hint, and follower phase. They are not shown in the default UI and are not uploaded. Neighborhood CTC rescoring of current/previous/next ayahs was not wired: it would have pulled Tilawa tracker internals into the live path. ONNX stays on the CPU execution provider; Core ML / NNAPI / XNNPACK are unmeasured.

These are observations from one clean desktop replay, not accuracy rates, real-time microphone latency, phone speed, or battery estimates. The corpus already contains the reciter's style in its broader ecosystem; this is an integration smoke test, not an independent held-out accuracy study. Preventing this observed false jump does not establish general rejection of non-Quran speech.

A separate 7.16-second synthesized English conversation test produced no confirmed verses. This is one negative smoke test, not a false-positive rate.

## Required physical-device evaluation

Test at least a mid-range Android, a lower-memory supported iPhone, and a recent device, using release builds:

- Fresh setup, English pack download, interrupted/failed download, offline relaunch.
- Permission denial/revocation, phone-call interruption, microphone route changes, notification pause, explicit Stop while inference runs.
- Live recitation from unseen speakers: arbitrary starts, joined ayahs, repeated refrains, repeated al-Fatihah, jumps and long pauses.
- Silence, conversation, prayer phrases, playback echo, room reverberation and multiple voices. Record false commits and missed matches.
- Confirm zero audio files are created.
- Manual lock/unlock for a full prayer-length session on each platform. Confirm continuous capture, privacy indicators and interruption handling.
- Peak RAM, thermal behavior, sustained inference throughput and battery. The current desktop memory result makes this a priority.
- Arabic/Urdu shaping, large accessibility text, translator footnotes, and numbering/basmala conventions with a qualified content reviewer.

Public distribution also requires model/content rights clearance and store privacy declarations. Stories, accounts, chat, session history and dataset contribution are not implemented in this MVP.

## Salah liturgy matcher (token detector)

Pack remains `assets/content/salah-liturgy.json` (v1, 18 phrases) + `src/core/salah-liturgy.ts`. Detector: `src/core/salah-liturgy-matcher.ts`, hooked from `src/services/listening.ts` on `RecitationFollower.lastHeardTokens`. `npm run liturgy:verify` still 18/18. Units: `tests/salah-liturgy-matcher.test.ts`.

Event API (not a Quran `verse_match`; English gloss stays on the pack row, matcher does not invent text):

```ts
{ kind: 'salah_liturgy'; phraseId: string; category: string; atMs: number; confidence?: number }
```

`confidence` is a token-similarity score in 0–1, not calibrated probability and not shown as percent certainty. Basmala stays on the Quran hold path. Short takbeer / amin / jamiʿ bayn need an isolated window and are refused while a Quran ayah is mid-follow. When liturgy locks, listening drops that hop’s `verse_match` / `word_progress` / `heard_words` and resets follower+gate so liturgy cannot become a displayed ayah. Default `npm run test:replay -- all` still runs follower+gate only (Quran 14/14 gate). Liturgy suites (`npm run test:replay -- liturgy`) attach the matcher on the same PCM → `lastHeardTokens` path as live listening **when audio exists**; remaining stubs skip with `missing_fixture` (not PASS). `liturgy-takbeer` and `liturgy-thana` are manifest-ready: generate WAV then score (must not skip). Matcher thresholds were not retuned for this harness pass.

Open risks: takbeer is two tokens — mosque/ASR `الله أكبر` inside Quran 29:45 or a noisy mid-ayah decode could still false-lock on-device despite isolation rules (unmeasured). Amin is one token. Romanized long-phrase ASR is untested; units use corpus Arabic. Follower locate thresholds were not retuned.

Shipped phrases and deferred rows are unchanged from the corpus pack. Quran `npm run test:replay -- all` (14 suites) remains the recognition regression gate (Mac verification).

## Salah liturgy on-screen display (`03-display`)

When listening emits `kind: 'salah_liturgy'`, `src/core/salah-liturgy-display.ts` looks up the pack row by `phraseId` and the single listening screen shows `arabic_uthmani` plus the pack `english` gloss (`english_kind: liturgy_gloss`). A “Prayer / liturgy” label plus a short category (Takbeer / Opening thana / Ruku, …) keeps it off the Quran ayah dual-pane. The next accepted `verse_match` restores passage follow; a neighborhood refresh of a held ayah does not. Unknown ids show nothing. Scores are not rendered. Copy does not claim full madhhab coverage or imam-ready. Units: `tests/salah-liturgy-display.test.ts` (injected locks for takbeer, thana, ruku_tasbih). No iOS Simulator capture in this Linux workspace.

## Headless replay harness (2026-09-15)

- Command: `npm run test:replay` (`scripts/replay.ts`).
- Fixtures: Al-Fatihah `001001`–`001007`, Ikhlas `112001`–`112004`, Nas `114001`–`114006` under `artifacts/recitation/` (16 kHz mono WAV).
- Path under test: ONNX CPU via `onnxruntime-node` + `RecitationFollower` + `ContinuationGate` (same as live mic logic). Not Tilawa streaming tracker. Not a physical-phone measurement.
- First harness runs reported false early locks (e.g. Ikhlas first lock 17:110; Fatiha first lock 35:9) with `failureMode` set — locate reliability remains open. Prior stale Ikhlas 112:1–4@4.0s figure used Tilawa `session.feed` tracker and must not be treated as a current follower pass.

## Overnight algorithm loop (2026-09-15 late)

- Ikhlas (`npm run test:replay -- ikhlas`) gated **PASS**: 112:1→4 in order.
- Fatiha / longer Baqarah still algorithm work (see overnight queue). Expanded suites: kawthar, falaq, asr, quraysh + edge suites.
- Short-surah start/tail (PR #2 + Basmala-echo guard): ContinuationGate confirms a distinctive one-word ayah-1 body after Basmala; a one-word body that is only a Basmala token (الرحمن) cannot first-lock 55:1. Follow advances on unused distinctive tokens of the expected next ayah (including a unique opening or a tail such as الابتر) without re-scoring that tail against the opening. `unused` is stem/word-strict so a current-ayah token cannot consume the next ayah via 0.72 fuzzy after prefix stripping.
- Nas last-ayah slice: grow the follow window for a short last ayah of the current surah; trim leftover penultimate audio to a 0.3 s seed before appending so a large first last-ayah batch is kept; require an exact phoneme mysterious-letter token so garbage cannot jump 114:5→7:1. See `prompts/nas-last-ayah-stall.md`.
- Back-to-back reacquire: last ayah leftover is distinctive unexplained tokens (not a 100%-clean suffix, and not short crumbs such as `وال` that relatedStem to 103:1). Merged on main `11759a9` (#5). **Mac `back-to-back` and `jump` are green on that SHA** (jump came free from #5). PR #6 cancelled as superseded. Nas last-ayah window and the 55:1 Basmala-echo guard stay as on main. Not a physical-device claim.
- Unit tests cover the short ayah-1 confirm, short next/final leftover tokens, leftover Quraysh 106:1 after finished Asr 103:3 (including when the 103:3 opening has aged out of the 1.2 s window, a 103:3 interior token remains, or a 103:3 tail token follows 106:1 in decode order), leftover Basmala not locking mushaf-next, leftover crumbs that do not re-lock 103:1, a distant lookalike reject, last-ayah window accumulation, and a garbage-window mysterious-letter jump guard. Not a physical-device claim.

Linux/x64 `onnxruntime-node` 1.24.3 replay after rebase onto `8f176d4` (includes PR #2 and `eacf963` Basmala-echo) plus seed-trim-before-append. Same EveryAyah Alafasy 16 kHz clips; not a phone measurement. `npm test` 111/111; typecheck pass; lint still reports the pre-existing unused `openingScore` warning.

| Suite | Result |
| --- | --- |
| `nas` | PASS 114:1@4 → 2@6.5 → 3@12 → 4@20 → 5@25.75 → 6@33.75; `failureMode` null; `wrongSurahRate` 0 (no 7:1) |
| `ikhlas` | PASS 112:1–4 |
| `falaq` | PASS 113:1–5 |
| `asr` | PASS 103:1–3 |
| `kawthar` | PASS 108:1–3 (generic short last-ayah window also covers 108:3) |
| `quraysh` | PASS 106:1–4 |
| `fatiha` | PASS 1:2@9 → 3@12.5 → 4@17 → 5@21.5 → 6@28 → 7@35; `eacf963` `skipUnusableLock` Basmala-echo left intact |

## Expanded replay suites (2026-09-15 harness-only)

Harness/docs/fixture wiring only. `RecitationFollower` acquire/follow thresholds were not retuned.

Commands:

```bash
npm run fixtures:recitation
npm run test:replay -- --check-fixtures
npm run test:replay                 # all suites
npm run test:replay -- all
npm run test:replay -- core         # fatiha, ikhlas, nas
npm run test:replay -- <suite>
```

| Suite | Clips / transform | Gate |
| --- | --- | --- |
| `fatiha` | `001001`–`001007` | ordered 1:2–1:7; Ibrahim 14:39/14:40 first-lock still special-cased |
| `ikhlas` | `112001`–`112004` | ordered 112:1–4 |
| `nas` | `114001`–`114006` | ordered 114:1–6 |
| `kawthar` | `108001`–`108003` | ordered 108:1–3 |
| `falaq` | `113001`–`113005` | ordered 113:1–5 |
| `asr` | `103001`–`103003` | ordered 103:1–3 |
| `quraysh` | `106001`–`106004` | ordered 106:1–4 |
| `longer` | `002001`–`002005` (Al-Baqarah 2:1–5, not Mulk) | ordered 2:1–5 |
| `jump` | Kawthar then Ikhlas concat | ordered 108:1–3 then 112:1–4 |
| `english-negative` | `english-negative.wav` | inverted: PASS only if **no** verse locks; `failureMode` `verse_lock_s:a` if any commit |
| `basmala-hold` | `001001` alone | PASS only if no locks; `locked_fatiha_1:1` or `locked_s:a` otherwise |
| `back-to-back` | Asr then Quraysh concat | ordered 103:1–3 then 106:1–4 |
| `cold-start-mid` | trim first 0.75 s of `002002` | ordered 2:2 |
| `stall-after-lock` | `112002` + 4 s **fed** trailing silence | first lock 112:2 and no later jump |

JSON path: `artifacts/qa-runs/replay-<suite>.json`. Fields include `matches`, `firstLockSeconds`, `clocks`, `failureMode`, `wrongSurahRate`, `wrongSurahCount`, `firstLockWrongSurah`.

Fixture-ready after `npm run fixtures:recitation` (ffmpeg required; EveryAyah Alafasy MP3 → 16 kHz mono WAV). Composed suites reuse those clips. Evaluation audio stays gitignored. An EveryAyah URL is not a redistribution grant.

Gate contracts are covered by `tests/replay-suites.test.ts` (`npm test` 99/99). After `npm run fixtures:recitation`, `--check-fixtures` reported all 14 suites ready. A Linux/x64 `onnxruntime-node` smoke on this workspace (not a phone, not Sim QA overnight):

| Suite | Result |
| --- | --- |
| `english-negative` | PASS — no verse locks; `wrongSurahRate` 0 |
| `basmala-hold` | PASS — `001001` alone locked nothing; `wrongSurahRate` 0 |
| `stall-after-lock` | PASS — first lock 112:2, no jump during 4 s fed silence |
| `kawthar` | `failureMode` `stall_missing_108:3_after_2_matches` (108:1 then 108:2; `wrongSurahRate` 0) |

Remaining suites were not scored here. Overnight locate+follow scoring is still for Sim QA on Mac (or any machine with the model + WAVs). Honest `failureMode` is a valid harness result, not a reason to retune the follower in this change.

## Ayah-1 body evidence (Al-Baqarah start)

Rebased onto main `810ed4c` (Prompt Smith sharper brief). 2:1 `text_clean` is `بسم الله الرحمن الرحيم الم`; 2:2 starts `ذلك الكتب`. Exact muqattaʿāt after the opening Basmala may first-lock ayah 1 without an engine champion and without waiting for ayah 2. Opening align stays tight so `الم` cannot lock `المال`; follow leftover matching still allows ASR `الا` to hit `الانسن`. Isolated `الم` / `المي` / letter names locate; `المصدر` and Basmala-echo 55:1 stay rejected. Initial acquire keeps ~8 s so Mac 2:2@11s still has `الم` PCM; reacquire stays 4 s for jump / back-to-back. If that long window’s CTC already names ayah 2+, acquire transcribes the older slice (drop newest 3 s) and locks ayah-1 from exact muqattaʿāt there first. Heard muqattaʿāt tokens are remembered across acquire hops. `ZIKRIST_TRACE=1` logs ASR text + champion + window seconds. Keep Nas last-ayah seed-trim, Basmala-echo 55:1, and last-ayah leftover crumbs. This workspace has no ONNX/WAV fixtures. **Mac `npm run test:replay -- longer` is the acceptance bar** — tips through `c0b3b1d` first-confirmed **2:2@11s ~0.91** (never 2:1). Do not merge on Linux-only ONNX.

| Suite | Result |
| --- | --- |
| `longer` | Mac still FAIL on `c0b3b1d` (`sequence_break_at_0_got_2:2_expected_2:1`). Linux PASS on a pre-rebase tip (2:1@6s → 2:2–5) is not the gate. |
| `nas` | Mac-green on `c0b3b1d` (114:6@31.75). Linux 114:1@4 → 6@33.75 |
| `fatiha` | Mac-green on `c0b3b1d` |
| `ikhlas` | PASS — 112:1–4 |
| `falaq` | PASS — 113:1–5 |
| `english-negative` | PASS — no verse locks |
| `basmala-hold` | Must stay PASS — `001001` alone locked nothing |
| `cold-start-mid` | Must stay 2:2 (no invented 2:1) |
| `stall-after-lock` | PASS — 112:2, no silence jump |
| `asr` | Mac-green on `c0b3b1d` |
| `kawthar` | Mac-green on `c0b3b1d` |
| `quraysh` | Mac-green on `c0b3b1d` |
| `back-to-back` | Mac-green on main `11759a9`; leftover-crumb units kept |
| `jump` | Mac-green on main `11759a9` (came free from #5); do not regress |

`npm test` 141/141; typecheck pass; lint still reports the pre-existing unused `openingScore` warning. Linux longer 2:1 first and nas/fatiha/short-surah Linux times above are from a **pre-rebase** tip. This workspace has no ONNX/WAV fixtures. Not a physical-device accuracy claim. **Only remaining merge gate: Mac `test:replay -- longer` first-lock 2:1.** Keep Mac nas/fatiha/asr/kawthar/quraysh/jump/back-to-back green.

## Real-imam coverage pack (scaffold, no audio)

Harness only. Prompt Smith already owns `prompts/real-imam/` (queue, fixture README, LIVE-FEEL, suite prompts, stub manifest). This change **registers** those suite ids in the replay runner instead of duplicating the briefs. **No founder/imam WAV or MP3 is committed.** Silent STUB audio was not invented. `RecitationFollower` was not retuned.

- Manifest: `prompts/real-imam/manifest.stub.json` (`status: stub` — do not flip until algorithm fixes). Founder labels (ground truth): `prompts/real-imam/LABELS.md`, `labels.json`. Founder drop: `~/Desktop/zikrist-imam-clips/`. Staging: `artifacts/recitation/imam/<suite-id>/<qari-or-source>/` (gitignored).
- Mac baseline 2026-09-16: Fatir 35:1–8 locks OK; Subayyal expected 4:129 locks wrong 41:34; Qiyam expected 36:16 locks wrong 78:4. Ignore hypothesized probe locks.
- `npm run test:replay -- all` still resolves to the original **14** Quran suites (hard gate).
- `npm run test:replay -- real-imam` **skips** the five stub suites with `failureMode: missing_fixture` and `status: skipped` (not PASS) and does not load ONNX.
- `--include-pending` can list them next to `all`; stubs still skip until WAV exists, so they cannot fail the 14-suite gate.
- Salah liturgy replay is a **separate** pending pack (`prompts/salah-liturgy/`). See the liturgy replay section below.

This workspace (Linux/x64, no EveryAyah WAVs restored): `npm test` **150/150**; `npm run typecheck` pass. `npx tsx scripts/replay.ts real-imam` exited **0** with five skipped `missing_fixture` rows (not PASS) and did not load ONNX. Acoustic `npm run test:replay -- all` was **not** scored here. Not a physical-device, mosque, or imam-ready claim.

## Founder-verified real-imam labels (2026-09-16)

Docs only. `LABELS.md` + `labels.json` committed as ground truth. `manifest.stub.json` suites remain `stub`. No matcher/follower edits. No wavs committed. Mac probes: Fatir 35:1–8 OK; Subayyal expected 4:129 locked 41:34; Qiyam expected 36:16 locked 78:4. `imam-mid-ayah-pause` still empty. Qunut at s9P8adOF7F0@4:56 is liturgy/dua later.

This workspace: `npm run typecheck` pass; `npx tsx --test tests/real-imam-pack.test.ts` 3/3; `npx tsx scripts/replay.ts real-imam` five skipped `missing_fixture` (not PASS). Full `npm test` 174/176 — two ENOENT on missing `assets/model/quran.json` (pre-existing, not this change). Lint still reports unused `openingScore`. Acoustic Quran `all` and physical-device probes were not scored here.

## Imam fixture handoff restore (GitHub Release zip)

Friends clone without git LFS. Labels stay in git. Audio comes from public Release asset `zikrist-imam-fixtures-v1.zip` on tag `imam-fixtures-v1` via `npm run fixtures:imam`. Suites remain `stub`. Matcher/follower were not retuned. No wav/mp3 committed. Liturgy TTS remains `npm run liturgy:tts -- <id> --engine say`. See `HANDOFF.md`.

This workspace: `npm run typecheck` pass; `npx tsx --test tests/download-imam-fixtures.test.ts tests/real-imam-pack.test.ts` 8/8; missing-tag run prints HTTP 404 + Releases page (exit 1). `npx eslint` on the new script/test is clean. No wav/mp3 tracked.

## Salah liturgy replay suites (stub-first, 2026-09-15)

Harness only. Registers the eight suite ids from `prompts/salah-liturgy/04-replay-suites.md` + `manifest.stub.json`. **No liturgy WAV or MP3 is committed.** Silent STUB audio was not invented. Follower and liturgy matcher thresholds were not retuned. Default 14 Quran suites still do not run the liturgy matcher.

- Manifest: `prompts/salah-liturgy/manifest.stub.json` (`status: stub`). Staging: `artifacts/recitation/liturgy/<suite-id>/` (gitignored).
- `npm run test:replay -- all` still resolves to the original **14** Quran suite names (hard gate).
- `npm run test:replay -- liturgy` and `salah-liturgy` **skip** the eight stubs with `failureMode: missing_fixture` and `status: skipped` (not PASS) and do not load ONNX.
- Mixed suites list EveryAyah Fatiha `001001`–`001007` for the Quran half only; liturgy clips remain stubs so the suite still skips until phrase audio exists.
- Chosen scoring path when audio later exists: PCM through `RecitationFollower` + `SalahLiturgyMatcher` (same as `listening.ts`). Token-fixtures are not registered because they could PASS without acoustic evidence. Matcher units already cover token locks.
- JSON skip shape: `fixtures/salah-liturgy/sample-skip.json` (`phraseId`/`audioSeconds` null; `failureMode: missing_fixture`).
- Phrases still lacking audio: suite targets `ruku_tasbih`, `sujood_tasbih`, `tashahhud`; remaining shipped pack rows (`istiadha`, tasbih-with-hamd variants, jamiʿ bayn, darood lines, amin, tasleem) have no suite yet; `liturgy-english-negative` needs its own non-Arabic clip. `takbeer` and `thana` are manifest-ready (see TTS fill sections).

This workspace (Linux/x64, no EveryAyah WAVs, no ONNX model): `npm test` **172/172**; `npm run typecheck` pass; lint still reports the pre-existing unused `openingScore` warning. `npx tsx scripts/replay.ts liturgy` and `salah-liturgy` exited **0** with eight skipped `missing_fixture` rows (not PASS) and did not load ONNX. `parseSuiteSelection(['all'])` is the original 14 Quran names. Acoustic `npm run test:replay -- all` was **not** scored here. Shared replay helpers were touched. **Mac must re-verify `npm run test:replay -- all` = 14/14.** Linux ONNX is not that gate. Not a physical-device, mosque, or imam-ready claim.

## Salah liturgy TTS fill (`liturgy-takbeer` ready, 2026-09-15)

One suite only. Manifest `liturgy-takbeer` is `status: ready` with `clip_path` `liturgy-takbeer/liturgy-takbeer__edge-tts__ar-SA-HamedNeural.wav` (relative to `artifacts/recitation/liturgy`). Spoken text is pack `arabic_uthmani` for phrase id `takbeer` (`اللَّهُ أَكْبَرُ`). Other liturgy suites stay stubs. Matcher / follower **thresholds** were not retuned. Imam clips were not touched. WAV/MP3 is gitignored and is not in this PR.

Wiring (not a threshold retune): live listening and liturgy replay snapshot Quran follow state **before** `follower.feed()`, so a same-hop false Quran acquire cannot hide isolated takbeer. Mid-ayah follow still refuses short liturgy.

Mac ready path: `python3 -m pip install --user edge-tts` then `npm run liturgy:tts -- liturgy-takbeer` (default edge-tts `ar-SA-HamedNeural` rate `-25%`; fallback `--engine say` + ffmpeg). Script refuses silent output. Then `npm run test:replay -- liturgy-takbeer` must **PASS (not skip)**. `npm run test:replay -- all` must stay **14/14**. Ready suites with a missing clip error `missing_clip` instead of skipping.

This workspace (Linux/x64): `npm test` **176/176**; `npm run typecheck` pass; lint still reports the pre-existing unused `openingScore` warning. `npx tsx scripts/replay.ts all --list` shows the original 14 Quran names. After generating the gitignored WAV (`edge-tts` `ar-SA-HamedNeural` rate `-25%`), Linux ONNX `npm run test:replay -- liturgy-takbeer` locked `phraseId: takbeer` at 1.25 s with `failureMode: null` and no `verse_match`. That is not a Mac 14/14 substitute and not a mosque/device claim. **Mac Bot/Sim QA must regenerate the WAV and re-verify `liturgy-takbeer` PASS plus `all` = 14/14 before merge.**

## Salah liturgy TTS fill (`liturgy-thana` ready, 2026-09-15)

One suite only. Manifest `liturgy-thana` is `status: ready` with `clip_path` `liturgy-thana/liturgy-thana__edge-tts__ar-SA-HamedNeural.wav` (relative to `artifacts/recitation/liturgy`). Spoken text is pack `arabic_uthmani` for phrase id `thana` (`سُبْحَانَكَ اللَّهُمَّ وَبِحَمْدِكَ وَتَبَارَكَ اسْمُكَ وَتَعَالَى جَدُّكَ وَلَا إِلَهَ غَيْرُكَ`). Other liturgy suites besides takbeer stay stubs. Matcher / follower **thresholds** were not retuned. Imam clips were not touched. WAV/MP3 is gitignored and is not in this PR. Manifest filename stays that dest; `--engine say` (Majed `ar_001`) writes the same path.

Mac ready path (founder Mac; edge-tts HTTP 403): `export PATH="/tmp/ffmpeg-static:$PATH"` then `npm run liturgy:tts -- liturgy-thana --engine say` (`say` voice **Majed** / `ar_001`; ffmpeg on PATH). Writes the stable manifest dest. Script refuses silent output. Then `npm run test:replay -- liturgy-thana` must **PASS (not skip)**. `npm run test:replay -- all` must stay **14/14**. Ready suites with a missing clip error `missing_clip` instead of skipping.

This workspace (Linux/x64): `npm test` **177/177**; `npm run typecheck` pass; lint still reports the pre-existing unused `openingScore` warning. `npx tsx scripts/replay.ts all --list` shows the original 14 Quran names. `npm run liturgy:tts -- liturgy-thana --dry-run` reads pack `arabic_uthmani` for `thana` and plans dest `artifacts/recitation/liturgy/liturgy-thana/liturgy-thana__edge-tts__ar-SA-HamedNeural.wav`. Acoustic `liturgy-thana` scoring and Mac `all` 14/14 were **not** run here (no `say`; WAV not generated). **Mac Bot/Sim QA must generate the WAV and verify `liturgy-thana` PASS plus `all` = 14/14 before merge.**

## Mid-surah cold acquire (4:129 ≠ 41:34, 36:16 ≠ 78:4)

Matcher/follower only. Prompt: `prompts/imam-mid-surah-cold-false-lock.md`. Mac-measured false first locks on founder-labeled mosque clips: Subayyal An-Nisa **4:129–130** first-locked **41:34** (~9 s, score ~0.63); Qiyam Ya-Sin **36:16–18** first-locked **78:4** (~2 s, score ~0.85). Fatir 35:1–8 already locked correctly and must not regress. **#17 Mac-green on merge** cleared those false locks (Subayyal 4:129→130, Qiyam 36:16→18, `all` 14/14). Label-fill **01** now flips `imam-mid-surah-cold` ready (see next section). Liturgy matcher thresholds were not retuned.

Cause class (token evidence, not clip IDs): early `ول-/تست-` can crown long **41:34** `ولا تستوي` instead of **4:129** `ولن تستطيعوا`; a thin window plus short-ayah scoring can crown **78:4** `كلا سيعلمون` from **36:16** `ربنا يعلم` (shared `علم` root / suffix). Acquire now (1) refuses a short mid-surah champion that leaves distinctive tokens unexplained, (2) holds a long ayah whose unique token is still confusable until a later body word (`الحسنه` vs `تعدلوا`), (3) locates around a rival’s reported ayah rather than only ayahs 1–7, and (4) can lock from two distinctive mid-ayah body tokens when the opening word was missed. Units in `tests/follower.test.ts` encode both confusions plus true 41:34 / 78:4 / Fatir 35:1 locks and 4:129→130 / 36:16→17–18 follow. No suite-ID hardcodes.

This workspace (Linux/x64, no imam WAVs, no ONNX replay): `npm test` **186/186**; `npm run typecheck` pass; lint still reports the pre-existing unused `openingScore` warning. Mosque-clip replay and `npm run test:replay -- all` were **not** scored here. Synthetic `cold-start-mid` (Baqarah 2:2) is a different fixture and was not acoustically re-run.

**#17 Mac-green on merge** (`2f056f7`) already scored those clips: Subayyal first lock **4:129** then **4:130**; Qiyam **36:16** then **36:17–18**; `all` **14/14**. The old 41:34 / 78:4 false locks are **cleared** — not unproven. Label-fill **01** is this PR (next section). Not a physical-device, mosque, or license-clearance claim.

## Real-imam label-fill 01 (`imam-mid-surah-cold` ready)

One suite only. Prompt: `prompts/real-imam/label-fill/01-mid-surah-cold-dr-subayyal.md`. Manifest `imam-mid-surah-cold` is `status: ready` with `clip_path` `imam-mid-surah-cold__dr-subayyal__004-129-130__raw.wav` (resolved under `artifacts/recitation/imam/imam-mid-surah-cold/qari-a/`). Expect ordered An-Nisa **4:129** then **4:130** from founder labels. Other real-imam suites stay stubs. Matcher / follower were **not** retuned (algorithm already landed in PR **#17**). WAV/MP3 is gitignored and is not in this PR.

PR **#17** was **Mac-green on merge** (`2f056f7`): Subayyal **4:129→130**, Qiyam **36:16→18**, `npm run test:replay -- all` **14/14**, units **186/186**. The old known-fails (Subayyal first-lock **41:34**, Qiyam first-lock **78:4**) are **cleared**. This label-fill session does **not** re-score those mosque clips and does **not** claim a new Mac acoustic green for the ready suite — Bot/Sim QA must run:

```bash
npm run fixtures:imam
npm run test:replay -- imam-mid-surah-cold   # must PASS, not missing_fixture skip
npm run test:replay -- real-imam             # ready scores if WAV present; other stubs skip
npm run test:replay -- all                   # still 14/14
```

Ready suites with a missing clip error `missing_clip` instead of skipping. Clip basename: `imam-mid-surah-cold__dr-subayyal__004-129-130__raw.wav`. Do not use the `__UNKNOWN__` file. Label-fill **02** is this PR (next section).

This workspace (Linux/x64): `npm test` **192/192**; `npm run typecheck` pass. `npx tsx scripts/replay.ts imam-mid-surah-cold` errors `missing_clip` (WAV not restored here) instead of skipping — expected ready behavior. Acoustic scoring and Mac `all` 14/14 were **not** run here. Not a physical-device, mosque, or license-clearance claim.

## Real-imam label-fill 02 (`imam-mid-surah-cold-qiyam` ready)

One sibling suite only. Prompt: `prompts/real-imam/label-fill/02-mid-surah-cold-qiyam.md`. Manifest adds `imam-mid-surah-cold-qiyam` as `status: ready` with `clip_path` `imam-mid-surah-cold__qiyam-faisal__036-016-018__raw.wav` (resolved under `artifacts/recitation/imam/imam-mid-surah-cold-qiyam/qari-a/` after `npm run fixtures:imam` copies it from the original mid-surah-cold folder). Expect ordered Ya-Sin **36:16** then **36:17** then **36:18** from founder labels. Does **not** overwrite `imam-mid-surah-cold` (Subayyal **4:129–130** stays ready). Other real-imam suites stay stubs. Matcher / follower were **not** retuned (algorithm already landed in PR **#17**). WAV/MP3 is gitignored and is not in this PR.

PR **#17** was **Mac-green on merge** (`2f056f7`): Subayyal **4:129→130**, Qiyam **36:16→18**, `npm run test:replay -- all` **14/14**. This label-fill session does **not** re-score those mosque clips and does **not** claim a new Mac acoustic green — Bot/Sim QA must run:

```bash
npm run fixtures:imam
npm run test:replay -- imam-mid-surah-cold-qiyam  # must PASS, not missing_fixture skip
npm run test:replay -- imam-mid-surah-cold        # still PASS
npm run test:replay -- real-imam                  # ready scores if WAV present; other stubs skip
npm run test:replay -- all                        # still 14/14
```

Ready suites with a missing clip error `missing_clip` instead of skipping. Clip basename: `imam-mid-surah-cold__qiyam-faisal__036-016-018__raw.wav` staged under the sibling suite folder. Next open tracks: remaining founder-labeled clips (one prompt each) and liturgy TTS `tts-fill/03-ruku.md`.

This workspace (Linux/x64): `npm test` and `npm run typecheck` recorded after the fill (see commit). `npx tsx scripts/replay.ts imam-mid-surah-cold-qiyam` errors `missing_clip` until the WAV is restored/copied — expected ready behavior. Acoustic scoring and Mac `all` 14/14 were **not** run here. Not a physical-device, mosque, or license-clearance claim.


