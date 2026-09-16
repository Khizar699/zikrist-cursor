# Handoff

Friends and **new Grok / Cursor agents** (no chat history) start here. Large recitation wav/mp3 is **not** in git (no Git LFS). Founder-verified imam **labels** are in git. Audio is restored locally.

## Maintainer rule (founder)

Every PR that merges to `main` **must** update this file **in the same PR**: what landed, tip state, open tracks, gates (`npm run test:replay -- all` = **14/14** Quran), fixture restore commands, known fails. Prompt Smith / cloud agents follow `prompts/_SHARED-HANDOFF.md`. A PR without a `HANDOFF.md` bump is not mergeable.


## Dictation for successor bots

Founder rule for **every** Cursor/session agent (Prompt Smith, cloud agents, recreations with no chat history):

1. **Write** continuity in the **same PR** — do not rely on chat memory.
2. **Always** bump the **`HANDOFF.md` tip** (what landed, tip state, open tracks, gates, restore cmds, known fails).
3. Update **`VALIDATION.md`** when verify / Mac gate results change.
4. Update **queue status** files when a queue item finishes, holds, or the next prompt changes.
5. Follow `prompts/_SHARED-HANDOFF.md` and the GitHub PR template checklist.

A PR that ships code or prompts without these writes is incomplete.

## Tip state (update every PR)

- **This PR:** [#17](https://github.com/Khizar699/zikrist-cursor/pull/17) — mid-surah cold false-lock fix in `RecitationFollower` (confusable `ول-/تست-` 4:129≠41:34; short `علم` 36:16≠78:4). Units only; **Mac verify pending**. Real-imam manifest stays **`stub`**.
- **Gate:** Mac `npm run test:replay -- all` = **14/14**. Linux ONNX is not that gate. Linux `npm test` 186/186 is not Subayyal/Qiyam evidence.
- **Restore:** `npm i` → `npm run fixtures:recitation` → `npm run fixtures:imam` (tag `imam-fixtures-v1`, asset `zikrist-imam-fixtures-v1.zip`). Liturgy: ffmpeg on `PATH` then `npm run liturgy:tts -- <id> --engine say` (Mac Majed).
- **Known fails:** until Mac-green, still treat Subayyal as want **4:129** currently **41:34** and Qiyam want **36:16** currently **78:4**. Do not flip stub→ready.
- **Open tracks:** Mac verify Subayyal 4:129 + Qiyam 36:16 + `all` 14/14; **after Mac-green** label-fill `01` then `02`; liturgy TTS after thana (`tts-fill/03-ruku.md`); real-imam stays **stub**.

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

Follower scoring for these pairs is in this PR; **acoustic Mac result is unproven**. Until Sim QA greens the two clips, keep these as the known fails:

| Clip | Want | Current false lock | Prompt |
|---|---|---|---|
| Dr Subayyal | **4:129** | **41:34** | `prompts/imam-mid-surah-cold-false-lock.md` |
| Qiyam Faisal | **36:16** | **78:4** | same |

**Teammate lanes** (if someone recreates bots)

- **Prompt Smith** — session prompts under `prompts/`
- **Sim QA** — Mac acoustic replay / `test:replay`
- **Chief Bot** — merges **only after Mac green**

**Push / merge policy:** Mac verify Subayyal **4:129**, Qiyam **36:16**, and `all` **14/14** before merge. Keep the 14 Quran suites green. Real-imam suites stay **`stub`** — do not flip to `ready` in this PR.

**Current open tracks**

- **Mac verify (this PR):** Subayyal 4:129 then 4:130; Qiyam 36:16 then 36:17–18; `npm run test:replay -- all` = **14/14**
- **After Mac-green:** label-fill `01` then `02` (`prompts/real-imam/label-fill/00-QUEUE.md`)
- Liturgy TTS queue **after thana** — next `prompts/salah-liturgy/tts-fill/03-ruku.md`
- Real-imam manifest stays **stub** until those label-fill sessions

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
