# Real-imam fixture pack

Scaffold only. **No evaluation audio is committed.** Quran `npm run test:replay -- all` remains the original **14** EveryAyah suites. Salah liturgy is a separate track.

Founder drop folder (outside git): `~/Desktop/zikrist-imam-clips/`

## Layout

```
fixtures/real-imam/
  README.md                      ← this file
  expected-locks.schema.json     ← JSON Schema for suite files
  manifest.json                  ← pack index (status, clip paths, expect)
  suites/<suite_id>.json         ← per-suite expected locks (harness loads these)
  clips/<qari-or-source>/*.wav   ← gitignored; drop 16 kHz mono PCM16 here
```

`clips/qari-a/` and `clips/qari-b/` exist so multi-qari paths are stable. Leave them empty until real recordings arrive. Do not add silent STUB WAVs.

## Clip id

```
{suite_id}__{clip_tag}__{span}.wav
```

| Piece | Meaning |
|-------|---------|
| `suite_id` | Replay CLI name, e.g. `imam-mid-surah-cold` |
| `clip_tag` | `pending` until replaced with a source tag (`2026-09-18`, masjid slug, reciter) |
| `span` | `SSS-ayahStart-ayahEnd` (e.g. `002-255-256`) or a short token (`108-then-112`) |

Store files under `clips/<qari-or-source>/` so the same span can exist for `qari-a` and `qari-b`.

MP3/M4A/MP4 may be dropped first; replay currently reads **WAV** only. Convert:

```bash
ffmpeg -y -i ~/Desktop/zikrist-imam-clips/SOURCE.mp4 \
  -ar 16000 -ac 1 -c:a pcm_s16le \
  fixtures/real-imam/clips/qari-a/imam-mid-surah-cold__pending__002-255-256.wav
```

If replay sees an `.mp3` next to a missing `.wav`, it prints a convert hint and still uses `failureMode: missing_fixture`.

## Expected locks JSON

Each `suites/<suite_id>.json` must match `expected-locks.schema.json`. Minimum fields:

| Field | Role |
|-------|------|
| `suite` | Must equal the file stem and `REAL_IMAM_SUITE_NAMES` entry |
| `clipId` | Primary clip id (basename without directory) |
| `status` | `pending` until a real file is scored; documentation only (disk presence is what the runner uses) |
| `clips` | Paths relative to `clips/` |
| `expect` | Ordered `{surah, ayah}` locks (placeholder until the recording is known) |
| `expected_first_lock` | Same as `expect[0]`, or `null` if the gate is inverted |
| `gate` | Same strings as Quran suites: `ordered-sequence` \| `no-verse-locks` \| `basmala-hold` \| `stall-after-lock` |
| `clipRunMode` | `concat` (default) or `each-clip` (multi-qari: one replay per file, same expect) |
| `insertSilence` | Optional harness gaps `{ atAudioSeconds, durationSeconds }`. Omit `atAudioSeconds` / use `null` until the clip exists. Internal silence is skipped like live unvoiced frames. |
| `license_status` | `unresolved` until rights review. A local file is not a redistribution grant. |

Placeholder `expect` values are a **recording plan**, not a measured pass. Edit them to match the dropped clip before treating a run as a gate.

## How to register a suite

1. Copy an existing file under `suites/` and set a new `suite` / `clipId` / `clips` / `expect`.
2. Append the id to `REAL_IMAM_SUITE_NAMES` in `scripts/replay-suites.ts` (the loader reads `suites/<id>.json`).
3. Add a row to `manifest.json`.
4. Drop WAV at the JSON `clips` path.
5. Run `npm run test:replay -- <suite_id>` (or `-- real-imam` for the whole pack).

No follower changes are required to register a suite.

## Commands

```bash
npm run test:replay -- all                 # original 14 only
npm run test:replay -- real-imam           # pending pack; missing_fixture until WAV
npm run test:replay -- imam-mid-surah-cold
npm run test:replay -- --include-pending   # 14 + pending (fails while clips missing)
npm run test:replay -- --list
npm run test:replay -- real-imam --check-fixtures
```

JSON reports: `artifacts/qa-runs/replay-<suite>.json`. Pending runs set `failureMode` to `missing_fixture` and `status` to `pending`.
