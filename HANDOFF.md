# Handoff

Friends and **new Grok / Cursor agents** (no chat history) start here. Large recitation wav/mp3 is **not** in git (no Git LFS). Founder-verified imam **labels** are in git. Audio is restored locally.

## Maintainer rule (founder)

Every PR that merges to `main` **must** update this file **in the same PR**: what landed, tip state, open tracks, gates (`npm run test:replay -- all` = **14/14** Quran), fixture restore commands, known fails. Prompt Smith / cloud agents follow `prompts/_SHARED-HANDOFF.md`. A PR without a `HANDOFF.md` bump is not mergeable.

## Tip state (update every PR)

- **This PR:** #15 — founder labels in git; `npm run fixtures:imam`; Grok-bot briefing; this maintainer rule. Real-imam suites stay `stub`. No audio committed.
- **Gate:** Mac `npm run test:replay -- all` = **14/14**. Linux ONNX is not that gate.
- **Restore:** `npm i` → `npm run fixtures:recitation` → `npm run fixtures:imam` (tag `imam-fixtures-v1`, asset `zikrist-imam-fixtures-v1.zip`). Liturgy: ffmpeg on `PATH` then `npm run liturgy:tts -- <id> --engine say` (Mac Majed).
- **Known fails:** Subayyal want **4:129** currently **41:34**; Qiyam want **36:16** currently **78:4** — `prompts/imam-mid-surah-cold-false-lock.md`. Do not flip stub→ready until Mac-green.
- **Open tracks:** liturgy TTS after thana (`tts-fill/03-ruku.md`); mid-surah-cold algo; real-imam label-fill **held**.

## For assistants / Grok bots — read first

You have no prior thread. Do not invent product history, ayah numbers, or Mac results.

| | |
|---|---|
| Repo | https://github.com/Khizar699/zikrist-cursor |
| Product | **Zikrist** — offline Expo ayah locator + salah liturgy (Android/iPhone, including mid-range). Algorithm and recognition correctness beat visual design this MVP. **No Figma** for the MVP. |
| Hard gate | `npm run test:replay -- all` must stay **14/14** Quran. Linux ONNX is not that gate. |
| Labels | Ground truth: `prompts/real-imam/LABELS.md` + `prompts/real-imam/labels.json` (Khizar, 2026-09-16). **Not** `probes/hypothesized-locks.txt`. Never invent ayah labels. |
| Suites | `prompts/real-imam/manifest.stub.json` stays **`stub`**. Restoring wavs is not a `ready` flip. |

**After clone**

```sh
npm i
npm run fixtures:recitation    # EveryAyah Quran replay wavs
npm run fixtures:imam          # Release tag imam-fixtures-v1 / zikrist-imam-fixtures-v1.zip
```

If `fixtures:imam` 404s, the zip is not published yet — see https://github.com/Khizar699/zikrist-cursor/releases. Do not commit audio.

**Liturgy TTS** (gitignored under `artifacts/recitation/liturgy/`): put ffmpeg on `PATH`, then Mac `say` Majed:

```sh
export PATH="/tmp/ffmpeg-static:$PATH"
npm run liturgy:tts -- <id> --engine say
```

Examples: `liturgy-takbeer`, `liturgy-thana`. Never invent silent WAVs that would PASS.

**Known fails (do not flip stub→ready until Mac-green)**

| Clip | Want | Current false lock | Prompt |
|---|---|---|---|
| Dr Subayyal | **4:129** | **41:34** | `prompts/imam-mid-surah-cold-false-lock.md` |
| Qiyam Faisal | **36:16** | **78:4** | same |

**Teammate lanes** (if someone recreates bots)

- **Prompt Smith** — session prompts under `prompts/`
- **Sim QA** — Mac acoustic replay / `test:replay`
- **Chief Bot** — merges **only after Mac green**

**Push / merge policy:** Mac verify before merge. Keep the 14 Quran suites green. Do not retune matcher/follower unless the open algorithm prompt says so. Do not flip real-imam suites to `ready` until that Mac-green false-lock work lands.

**Current open tracks**

- Liturgy TTS queue **after thana** — next `prompts/salah-liturgy/tts-fill/03-ruku.md` (`00-QUEUE.md`)
- Mid-surah-cold algorithm — `prompts/imam-mid-surah-cold-false-lock.md`
- Real-imam label-fill **held** — `prompts/real-imam/label-fill/00-QUEUE.md` (do not launch 01/02 until false-lock is Mac-green)

Read `AGENTS.md` before implementing.

## Friend path

```sh
git clone https://github.com/Khizar699/zikrist-cursor.git
cd zikrist-cursor
npm i
npm run fixtures:recitation    # EveryAyah Quran replay wavs → artifacts/recitation/
npm run fixtures:imam          # GitHub Release zip → artifacts/recitation/imam/
```

Then continue with native build / Sim QA as in `README.md` (`npm run assets:download`, `npm run test:replay -- all`, and so on).

Re-download imam clips: `npm run fixtures:imam -- --force`.

## Imam fixtures (GitHub Release zip)

| Piece | Where |
|-------|--------|
| Ground truth labels (git) | `prompts/real-imam/LABELS.md`, `prompts/real-imam/labels.json` |
| Staged audio (gitignored) | `artifacts/recitation/imam/` |
| Restore script | `npm run fixtures:imam` (`scripts/download-imam-fixtures.ts`) |
| Default tag | `imam-fixtures-v1` (`ZIKRIST_IMAM_RELEASE_TAG` to override) |
| Asset | `zikrist-imam-fixtures-v1.zip` (~557 MB) |
| Public URL | `https://github.com/Khizar699/zikrist-cursor/releases/download/imam-fixtures-v1/zikrist-imam-fixtures-v1.zip` |

The zip unpacks **into** `artifacts/recitation/imam/`, merging `LABELS.md`, `labels.json`, suite folders, `_inbox/`, and `sources/`. The script skips when that `LABELS.md` and at least one suite wav already exist.

If the release is not uploaded yet, the script exits with HTTP 404 and points at https://github.com/Khizar699/zikrist-cursor/releases. That is expected until a maintainer publishes tag `imam-fixtures-v1`.

Real-imam replay suites stay `stub` until algorithm fixes land. Restoring wavs is not a readiness flip. `npm run test:replay -- real-imam` still **skips** with `missing_fixture` (not PASS) while the manifest is stub.

## Liturgy TTS wavs (gitignored)

Liturgy evaluation audio is generated on the machine, not restored from the imam zip:

```sh
export PATH="/tmp/ffmpeg-static:$PATH"
npm run liturgy:tts -- liturgy-takbeer --engine say
```

Replace the suite id (`liturgy-thana`, `liturgy-ruku`, …) when that fill session exists. Needs `say` + ffmpeg on Mac (Majed). Wavs stay under `artifacts/recitation/liturgy/` and must not be committed.

## Rights

Imam and bystander recordings are evaluation-only. They are not app assets. A public Release URL is not a redistribution or training grant. See `THIRD_PARTY_NOTICES.md`.
