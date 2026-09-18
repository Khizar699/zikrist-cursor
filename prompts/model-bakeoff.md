# Model bakeoff (Phase C) — do not swap the default yet

## Goal

Measure whether a **streaming** Quran encoder follows live recitation better than the shipping Tilawa FastConformer **on the same clips and the same Zikrist follower**. Locate accuracy and follow smoothness are separate scores.

## Why not swap now

The smoothness problem is mostly follow architecture (mixed window, commit-only display, backlog reset). A new model will not fix skip-on-late-display by itself. The shipping model is already the locate engine; replacing it without a bakeoff would mix two variables.

NVIDIA’s packaged FastConformer is **non-streaming**: each `transcribe` re-encodes the whole window. That is the engine limit after Phase A/B.

## Candidates (keep Tilawa as default)

| Candidate | Role | Try? | Blocker |
|---|---|---|---|
| Tilawa FastConformer (current) | Locate + follow baseline | Always the control | Non-streaming windows |
| Cache-aware FastConformer (NVIDIA / sherpa-onnx style) | Follow latency | Yes, when a rights-cleared Quran export exists | Need a Quran-token head, not English ASR |
| Muno459 `fastconformer-quran-streaming` | Closest streaming Quran ASR | Eval only after license review | Published terms may forbid revenue, ads, subscriptions |
| Tarteel production streaming | Quality ceiling | Cloud A/B only, never default | Network; not offline MVP |
| Tarteel `whisper-base-ar-quran` | Independent locate | Optional locate bakeoff | Not a tracker; Whisper is heavy on mid-range phones |
| Tilavet WhisperKit | Architecture reference | Do not port | Apple-only, large, different stack |

## How to test (when this track is picked)

1. Keep `RecitationFollower` + `ContinuationGate`. Swap only `TranscribeFn` / the ONNX runner.
2. Same Mac replay clips: `nas`, `fatiha`, `ikhlas`, `jump`, ready imam suites, Tip clip.
3. Report **five clocks** separately: cold ready, first lock, evidence delay, tracking response, display. Add skip rate (same-surah hops missed in the timeline).
4. A model wins follow only if tracking p95 drops and skip rate does not rise, on mid-range CPU, without breaking floor expects.
5. Do not commit new weights until license + hash + `THIRD_PARTY_NOTICES` are done.

## Decision rule

Stay on Tilawa until a streaming candidate is both legally usable and measurably better at **follow**. A better full-file WER is not a live-follow win.
