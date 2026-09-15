# Real-imam fixture scaffold (no clips required)

## Goal

Committed **directory layout, clip-id convention, expected-locks schema, and pending suite registration** so Sim QA can plug WAV/MP3 later without renaming suites. No invented audio.

## Clip drop path (founder)

- Incoming (not committed): `~/Desktop/zikrist-imam-clips/` (video or extracted audio)
- Repo staging (gitignored audio): `fixtures/real-imam/clips/<qari-or-source>/<clip-id>.wav`
- Canonical manifest: `fixtures/real-imam/manifest.json`
- Per-suite expect JSON: `fixtures/real-imam/suites/<suite_id>.json`

`artifacts/recitation/` remains EveryAyah/Alafasy 16 kHz clips for the 14 Quran suites. Do not download imam audio via `npm run fixtures:recitation`.

## Naming convention

Stable suite ids (replay CLI names):

| suite_id | intent |
|----------|--------|
| `imam-mid-surah-cold` | start listening mid-surah |
| `imam-mid-ayah-pause` | pause mid-ayah then resume |
| `imam-surah-switch` | switch surah mid-session |
| `imam-noise-bleed` | background noise / speaker bleed |
| `imam-multi-qari` | same expect, different qari folders (`each-clip`) |

Clip id: `{suite_id}__{clip_tag}__{span}.wav`  
`clip_tag` is `pending` until a real source tag replaces it (date, masjid, or reciter slug).  
`span` is `SSS-ayahStart-ayahEnd` or a short token such as `108-then-112`.

Examples (files **not** created until founder drops audio):

- `qari-a/imam-mid-surah-cold__pending__002-255-256.wav`
- `qari-a/imam-surah-switch__pending__108-then-112.wav`
- `qari-a/imam-multi-qari__pending__112-1-4.wav` and `qari-b/…` (same expect)

WAV must be 16 kHz mono PCM16 (same as Quran replay). MP3 is fine as a drop format; convert before replay:

```bash
ffmpeg -y -i SOURCE.mp3 -ar 16000 -ac 1 -c:a pcm_s16le fixtures/real-imam/clips/qari-a/CLIP.wav
```

From video:

```bash
ffmpeg -y -i ~/Desktop/zikrist-imam-clips/SOURCE.mp4 -ar 16000 -ac 1 -c:a pcm_s16le fixtures/real-imam/clips/qari-a/CLIP.wav
```

## Registering a suite

1. Add `fixtures/real-imam/suites/<suite_id>.json` matching `expected-locks.schema.json`.
2. Add `<suite_id>` to `REAL_IMAM_SUITE_NAMES` in `scripts/replay-suites.ts` (loader reads the JSON).
3. List the suite in `fixtures/real-imam/manifest.json`.
4. Drop audio at `clips/` + the `clips` paths in that JSON. No TS clip-path edits if the JSON already names the file.
5. `npm run test:replay -- <suite_id>` then runs ONNX. Until the WAV exists, the same command is `missing_fixture`.

## Out of scope

- Algorithm / follower changes
- Filling real audio or silent STUB WAVs
- Salah liturgy matcher
- Claiming live-imam accuracy

## Constraints

- Offline MVP; large media gitignored
- Hard gate: do not break existing 14 Quran replay suites
- Stubs must skip / `missing_fixture`, never fake PASS

## Success criteria

1. Dirs + README + schema + suite JSON exist; clip folders empty of audio
2. `npm run test:replay -- all` still the original 14 names
3. `npm run test:replay -- real-imam` reports `missing_fixture` without ONNX
4. Manifest/schema covered by `tests/real-imam-pack.test.ts`
