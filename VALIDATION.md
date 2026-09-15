# MVP validation

Status: implementation and integration validation in progress. No physical phone or mosque test has been completed.

## Completed checks

- TypeScript compilation and ESLint passed.
- Automated regression tests covering queue ordering/backpressure/cancellation, acquire/follow/reacquire tracking (including An-Nas then Al-Fatihah, Basmala after An-Nas not locking 1:1, Al-Fatihah locking from 1:2 rather than 1:4, 1:2 advancing to 1:3 including live Arabic الرحمن/الحمد, 1:5 advancing to 1:6 from its opening even when the 1:5 tail is still in the 1.2 s window, 1:6 not advancing to 1:7 from the shared sirat word, Al-Falaq taking over after 1:7 while An-Nas stays a close rival, An-Nas ayah 3 not jumping to a long unrelated ayah, Al-Fatihah 1:2 not becoming Ibrahim 14:39/14:40 from shared `الحمد لله` or leftover `رب العلمين`, a wrong 14:40 lock yielding to unique 1:5 words, Kawthar then a later short surah without a second global search, leftover Quraysh 106:1 after finished Asr 103:3 while the last-ayah tail remains in the follow window, leftover Basmala after that last ayah not locking mushaf-next Humazah, a last-10 prior that cannot hide a clearer acoustic match, a one-word ayah-1 body after Basmala confirming on that unique word, a short next/final ayah advancing from unused tail tokens or a garbled unique opening, an Asr-like opening not first-locking a distant lookalike, local recognition clocks, coverage not revealing the next ayah, a shared `قل` opening pairing heard words without naming an ayah, and Ikhlas audio not first-locking Yunus 10:16), live first-match display, silence-flush and unexpected-jump guards, sequential next-ayah helpers, passage window, held-verse replacement, confirmed-match order, pack eviction, the Tilawa memory patch, and a candidate cap so short queries do not score all 6,236 verses.
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

Public distribution also requires model/content rights clearance and store privacy declarations. Stories, accounts, chat, prayer phrases, session history and dataset contribution are not implemented in this MVP.

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
- Back-to-back reacquire: last ayah can lock early without 82% coverage; unexplained leftover on that last ayah cold-starts acquire rather than waiting six mid-surah mismatch hops. Nas last-ayah window and the 55:1 Basmala-echo guard stay as on main. Linux/x64 ONNX after rebase onto Nas #3: `back-to-back` PASS 103:1@1 → 2@8.75 → 3@9.25 then 106:1@23 → 2@27 → 3@31 → 4@40.25 (`failureMode` null); standalone `asr`, `quraysh`, `fatiha`, `nas` also PASS. Not a physical-device claim.
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
