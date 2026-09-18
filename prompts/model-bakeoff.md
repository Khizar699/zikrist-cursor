# Model bakeoff (Phase C) — do not swap the default yet

## Goal

Measure whether a **streaming** Quran encoder follows live recitation better than the shipping Tilawa FastConformer **on the same clips and the same Zikrist follower**. Locate accuracy and follow smoothness are separate scores.

## Why not swap now

The smoothness problem is mostly follow architecture (mixed window, commit-only display, backlog reset). A new model will not fix skip-on-late-display by itself. The shipping model is already the locate engine; replacing it without a bakeoff would mix two variables.

NVIDIA’s packaged FastConformer is **non-streaming**: each `transcribe` re-encodes the whole window. That is the engine limit after Phase A/B.

**This session (2026-09-18):** harness + license review + Tilawa control clocks landed. No streaming candidate was both legally usable and a drop-in `TranscribeFn`. Default stays Tilawa.

## Candidates (keep Tilawa as default)

| Candidate | Role | Try? | Blocker |
|---|---|---|---|
| Tilawa FastConformer (current) | Locate + follow baseline | Always the control | Non-streaming windows |
| Cache-aware FastConformer (NVIDIA / sherpa-onnx style) | Follow latency | Yes, when a rights-cleared Quran export exists | Need a Quran-token head, not English/BPE ASR. Not Tilawa logprobs `[1,T,1025]`. |
| Muno459 `fastconformer-quran-streaming` | Closest streaming Quran ASR | **Do not eval or ship** | Hugging Face card (reviewed 2026-09-18): Quran-Lab **NPL-1.1** — no profit, ads, subscriptions, or use inside a revenue-generating product. Share-alike. AGENTS.md requires commercially compatible dependencies. |
| Tarteel production streaming | Quality ceiling | Cloud A/B only, never default | Network; not offline MVP |
| Tarteel `whisper-base-ar-quran` | Independent locate | Optional locate bakeoff | Not a tracker; Whisper is heavy on mid-range phones |
| Tilavet WhisperKit | Architecture reference | Do not port | Apple-only, large, different stack |

`--engine muno459-streaming` (and every non-Tilawa id) **exits blocked**. Do not download NPL weights into this repo.

## How to test

```bash
npm run test:bakeoff                 # Tilawa control: nas, fatiha, ikhlas, jump, ready imam, Tip clip if present
npm run test:replay -- --engine tilawa
npm run test:replay -- --engine muno459-streaming   # must exit 1, blocked
```

1. Keep `RecitationFollower` + `ContinuationGate`. Swap only `TranscribeFn` / the ONNX runner.
2. Same Mac replay clips: `nas`, `fatiha`, `ikhlas`, `jump`, ready imam suites, Tip clip.
3. Report **five clocks** separately: cold ready, first lock, evidence delay, tracking response, display. Add skip rate (same-surah hops missed in the timeline).
4. A model wins follow only if tracking p95 drops and skip rate does not rise, on mid-range CPU, without breaking floor expects.
5. Do not commit new weights until license + hash + `THIRD_PARTY_NOTICES` are done.

Code: `src/core/bakeoff.ts`, `scripts/bakeoff.ts`. Replay JSON includes a `bakeoff` object. Units: `tests/bakeoff.test.ts`.

## Tilawa control (Mac, 2026-09-18)

Headless ONNX CPU via `onnxruntime-node`. Not phone/mic latency. `displayMs` is 0 because `ContinuationGate` is synchronous in this harness.

| Suite | First lock | Ordered advance | tracking p50 / p95 (ms) | skip rate |
|---|---|---|---|---|
| `nas` | 114:1@4s | 114:1–6 | 48 / 158 | 0 |
| `fatiha` | 1:2@9s | 1:2–7 | 47 / 52 | 0 |
| `ikhlas` | 112:1@2s | 112:1–4 | 46 / 47 | 0 |
| `jump` | 108:1@5s | 108:1–3 then 112:1@16.75–4 | 47 / 50 | 0 |
| `imam-mid-surah-cold` | 4:129@11s | 4:129–130 | 46 / 49 | 0 |
| `imam-mid-surah-cold-qiyam` | 36:16@4s | 36:16–18 | 46 / 52 | 0 |
| Hafiz Usama (Tip) | 1:2@2.75s | 1:2–7; stall no **27:15** | 46 / 49 | 0 |

Cold ready (model load, first suite): ~1374 ms. Nas p95 is the long last-ayah window re-encoding more audio, not a skip.

## Decision rule

Stay on Tilawa until a streaming candidate is both legally usable and measurably better at **follow**. A better full-file WER is not a live-follow win.

**Decision this session:** keep Tilawa. No candidate cleared license + Quran-token `TranscribeFn` + follow win.
