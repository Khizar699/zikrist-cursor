# Real-imam fixture scaffold (no clips required)

## Goal

Create the **directory layout, naming convention, and manifest schema** for real-imam / live-tilawah fixtures so Sim QA can plug WAV/MP3 later without renaming suites. Empty stubs + README only this session.

## Clip drop path (founder)

- Incoming: `~/Desktop/zikrist-imam-clips/` (videos or extracted audio — not committed yet)
- Repo staging (gitignored large audio, like existing `artifacts/recitation/`):  
  `artifacts/recitation/imam/<suite-id>/<qari-or-source>/<clip-id>.wav`
- Manifest: `artifacts/recitation/imam/manifest.json` (or per-suite `suite.json`)

## Naming convention

Suite ids (stable):

| suite_id | intent |
|----------|--------|
| `imam-mid-surah-cold` | start listening mid-surah |
| `imam-mid-ayah-pause` | pause mid-ayah then resume |
| `imam-surah-switch` | switch surah mid-session |
| `imam-noise-bleed` | background noise / speaker bleed |
| `imam-multi-qari` | same ayah, different qari (placeholder) |

File names: `{suite_id}__{clip_tag}__{surah}-{ayah_start}-{ayah_end}__{note}.wav`  
Examples (stubs may be 0-byte or silent 0.1s placeholder marked `STUB`):

- `imam-mid-surah-cold__pending__002-255-255__STUB.wav`
- `imam-surah-switch__pending__108-then-112__STUB.wav`

Manifest fields (minimum): `suite_id`, `clip_path`, `status` (`stub`|`ready`), `expected_first_lock`, `expected_sequence`, `notes`, `source_url_or_file`, `license_status`.

## Out of scope

- Algorithm / follower changes  
- Filling real audio  
- Salah liturgy matcher  
- Claiming live-imam accuracy  

## Constraints

- Offline MVP; large media gitignored  
- Document how to import from `zikrist-imam-clips/` (ffmpeg extract notes OK)  
- Hard gate: do not break existing 14 Quran replay suites  

## Success criteria

1. Dirs + README + stub entries exist  
2. Manifest schema validated by a tiny unit/script test or documented JSON Schema  
3. `npm run test:replay -- all` still 14/14 if touched  
4. No fake “PASS” on stub suites — stubs must `skip` or `status:stub`  

## Deliverable

Paths, naming table, import notes, gitignore lines.
