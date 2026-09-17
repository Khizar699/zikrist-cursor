# Training data path (future own model)

Design-only for now. **No silent recording.** Aligned with root `AGENTS.md` privacy:

- Microphone processing is the default (transient).
- Permanent local recording and **training contribution** are separate explicit opt-ins, both off initially.
- Training export must not ship inside the MVP listening binary as a hidden path.

Tilawa + Zikrist patches remain the live engine until a calibrated replacement locate model exists. The follower stays Zikrist-owned until locate is re-measured on the product bar.

## Goals

1. Accumulate **rights-cleared**, **labeled** acoustic examples of failures and successes.
2. Separate **hypothesized** locks (matcher output) from **confirmed** labels (founder `labels.json` or future explicit user confirm).
3. Export datasets **offline** for training; never invent ayah labels with an LLM.

## Record schema (v1 — documentation)

Each training example (one utterance or bounded session slice):

| Field | Type | Notes |
|---|---|---|
| `example_id` | string | Stable UUID |
| `session_id` | string | App session when opt-in recording was on |
| `created_at` | ISO-8601 | UTC |
| `consent` | object | `{ recording: true, training: true, version: string }` — both required for training export |
| `rights` | object | `{ status: "evaluation_only" \| "cleared" \| "unknown", note: string }` |
| `audio` | object | `{ path: string, sha256: string, sample_rate: 16000, channels: 1, codec: "pcm_s16le" }` — path outside git |
| `model` | object | `{ onnx_id: string, tokenizer_id: string, tilawa_version: string, app_version: string }` |
| `hypothesized` | array | Matcher/follower outputs: `{ surah, ayah, at_ms, score?, phase? }[]` — **not** ground truth |
| `confirmed` | array \| null | Founder or user-confirmed `{ surah, ayah, at_ms }[]` — null until labeled |
| `label_source` | string \| null | `founder_labels_json` \| `user_confirm` \| null |
| `failure_class` | string \| null | From [COVERAGE.md](./COVERAGE.md) when this example is a miss |
| `owner` | string \| null | `locate` \| `follow` \| `gate` \| null |
| `clip_class` | string \| null | `famous-short` \| `mid-surah` \| `fatiha-to-body` \| `non-famous-cold` \| `long-imam` \| `synthetic` |

## Provenance rules

- EveryAyah / evaluation fixtures: **evaluation replay only** — not a redistribution or ML-training grant by URL alone. Keep `rights.status = evaluation_only` unless a separate clearance is recorded.
- Mosque / founder clips: follow release notes and `license_status` on manifest rows; do not commit wav/mp3.
- User opt-in audio: app-private storage; export only with `consent.training === true`; bounded retention (product policy TBD, must not silently retain for “hypothetical training”).

## Export path (separate from the app)

1. Local or CI job reads consented store + confirmed labels.
2. Writes a versioned dataset dir (gitignored): manifests + hashes + audio.
3. Training / fine-tune lives outside the Expo app repo workflow.
4. After a candidate locate model: re-run Mac floor + Tier A coverage + Tip product bar; ratchet locks before swap.

## What not to build in this PR

- In-app upload, analytics, or default training collection.
- Committing audio under `artifacts/`.
- Claiming a training corpus exists before opt-in + labels exist.
