# MVP validation

Status: implementation and integration validation in progress. No physical phone or mosque test has been completed.

## Completed checks

- TypeScript compilation and ESLint passed.
- Automated regression tests covering queue ordering/backpressure/cancellation, acquire/follow/reacquire tracking (including An-Nas then Al-Fatihah, Basmala after An-Nas not locking 1:1, Al-Fatihah locking from 1:2 rather than 1:4, 1:2 advancing to 1:3 including live Arabic الرحمن/الحمد, 1:5 advancing to 1:6 from its opening even when the 1:5 tail is still in the 1.2 s window, 1:6 not advancing to 1:7 from the shared sirat word, Al-Falaq taking over after 1:7 while An-Nas stays a close rival, An-Nas ayah 3 not jumping to a long unrelated ayah, Al-Fatihah 1:2 not becoming Ibrahim 14:39/14:40 from shared `الحمد لله` or leftover `رب العلمين`, a wrong 14:40 lock yielding to unique 1:5 words, Kawthar then a later short surah without a second global search, a last-10 prior that cannot hide a clearer acoustic match, local recognition clocks, and coverage not revealing the next ayah), live first-match display, silence-flush and unexpected-jump guards, sequential next-ayah helpers, passage window, held-verse replacement, confirmed-match order, pack eviction, the Tilawa memory patch, and a candidate cap so short queries do not score all 6,236 verses.
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

Live listening uses a Zikrist acquire / follow / reacquire loop on Tilawa transcription and the Quran index. It does not use Tilawa's streaming tracker for microphone following. Acquire locates on about a second of voiced audio and prefers the earliest lockable ayah in a span (Al-Fatihah from 1:2, not 1:3 or 1:4 already in the same window). Shared `الحمد لله` is not enough to name 1:2 or Ibrahim 14:39; 1:2 waits for `رب`, and leftover `رب العلمين` must not commit 14:40 (`العلمين` is not `اجعلني`). A window that only matches that shared formula does not keep an Ibrahim neighborhood high enough to block reacquire. After lock, a 1.2 s follow window on a 0.4 s hop scores the current ayah, the previous ayah, and unique post-Basmala words of the mushaf-next ayah; Bismillah after Al-Fatihah does not keep Al-Baqarah as the neighborhood. After the last ayah of a surah, a bounded next-surah pool (Al-Fatihah and remaining later short surahs, then famous openings) is scored before a full-Quran locate. A salah prior file may break close ties; it cannot become the translation. A global locate runs if that neighborhood or pool stops explaining the audio. Short ayahs are scored as present in the window so a mix of An-Nas 2–3 cannot lose to a long ayah such as 2:109. Completing An-Nas has no following surah; the next recitation, including Al-Fatihah, is a fresh locate on new audio rather than a blocked jump. Shared Basmala after a finished surah does not lock Al-Fatihah 1:1. Completing the last ayah of a surah does not display the next surah from coverage or Basmala; unique words after Basmala are still required. If the neighborhood fails mid-surah, reacquire keeps the current window so the new opening is not discarded. Silent microphone frames are not inferred. After lock, the current surah and the next surah are preloaded into memory; each pane lists only the previous ayah, the current ayah, and the next ayah in the same surah. The focused ayah is full opacity; neighbors stay at 10% opacity. The focused translation does not move from coverage; it waits for an accepted `verse_match`. A pause of a few seconds keeps the last verse on screen. A stop of about ten seconds searches again without joining that silence to later audio, and keeps the last confirmed verse as the continuation prior. The shared opening Basmala (1:1, and ayah 1 of other surahs) is held until unique words arrive. Unexpected jumps still need later voiced progress. The earlier 4.0 s figure is not the current target; a 1–3 s first location is an evaluation goal for *unique* verses and has not been re-measured on a physical phone. Device reports of late Fatiha/Nas locks, a missed Falaq jump, Al-Fatihah freezing on 1:2 after Alhamdulillah, Al-Fatihah freezing on 1:5 after a faster lock, and Al-Fatihah displaying Ibrahim 14:40 from the first verse were used to add these guards; they are not a new physical-device accuracy measurement. After a 1:2 lock, 1:3 is committed from its own words; الرحمن is not treated as الحمد, and Basmala 1:1 does not keep the 1:2 neighborhood. After a 1:5 lock, unique 1:6 opening words commit 1:6 even when the overlapping follow window still contains the 1:5 tail; a mixed-window similarity score must not keep 1:5 on screen.

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
