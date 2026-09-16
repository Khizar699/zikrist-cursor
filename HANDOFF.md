# Handoff

Friends and **new Grok / Cursor agents** (no chat history) start here. Large recitation wav/mp3 is **not** in git (no Git LFS). Founder-verified imam **labels** are in git. Audio is restored locally.

## Maintainer rule (founder)

Every PR that merges to `main` **must** update this file **in the same PR**: what landed, tip state, open tracks, gates (`npm run test:replay -- all` = **14/14** Quran), fixture restore commands, known fails. Prompt Smith / cloud agents follow `prompts/_SHARED-HANDOFF.md`. A PR without a `HANDOFF.md` bump is not mergeable. CI: `.github/workflows/handoff-required.yml`.


## Dictation for successor bots

Binding obligation for **anyone continuing this repo** (friend + their Grok/Cursor bots, Prompt Smith, cloud agents). No chat history is not an excuse.

**Write, do not only read.** Continuity docs go in the **same PR** as the code/prompt work:

1. **`HANDOFF.md` Tip state — always.** What landed, tip SHA/PR, open tracks, gates, known fails, restore cmds if changed.
2. **`VALIDATION.md`** — when Mac/Linux verify paths change or you record a new Mac-green result.
3. **Active prompt / queue status** — mark done/held/next in the relevant `prompts/**/00-QUEUE.md` (or session prompt) if the overnight queue tracks it.
4. Follow `prompts/_SHARED-HANDOFF.md` **exactly**.

**Your session is incomplete without a `HANDOFF.md` tip bump.** CI already requires `HANDOFF.md` in the PR diff (`.github/workflows/handoff-required.yml`).

## Bot start protocol

Cheap read order (do not load every `prompts/**` file up front):

1. **Tip state** only first (next section).
2. Then `AGENTS.md`.
3. Then the **single** open-track prompt named in Tip.
4. Restore fixtures if missing: `npm run fixtures:recitation` then `npm run fixtures:imam`.

Skip overnight queues unless picking next work. Dictation above is what to **write** in the PR. Local Cursor Agent/Composer: `.cursor/rules/zikrist-continuity.mdc` (`alwaysApply`) — same read order; do not duplicate dictation here.

## Tip state (update every PR)

- **This PR:** algo **01** — Masjid-e-Nabi cold/bleed **25:69 ≠ 2:1** (`prompts/real-imam/algo/01-masjid-e-nabi-25-69-false-2-1.md`). `RecitationFollower` refuses a distant Baqarah **2:1** `الم` champion when distinctive Furqan body tokens are in the window (and does not treat CTC `الم` later or prefixed as 2:1 evidence). Units encode the confusion; **no** mosque WAV on this VM. **Do not** flip manifest `ready`. **Do not** retune liturgy. **Do not** touch Subayyal/Qiyam ready suites. **Do not** work algo 02–04.
- **Prior:** [#20](https://github.com/Khizar699/zikrist-cursor/pull/20) algo queue on main (`84f9d9b`). Label-fill **02** (`c228533` / #19) Qiyam sibling ready. Label-fill **01** (`6df8ef3` / #18) Subayyal ready. [#17](https://github.com/Khizar699/zikrist-cursor/pull/17) **Mac-green on merge** (`2f056f7`): Subayyal **4:129→130**, Qiyam **36:16→18**, `all` **14/14**.
- **Gate:** Mac `npm run test:replay -- all` = **14/14**. Linux ONNX is not that gate. This PR does **not** claim Mac acoustic green for the Masjid-e-Nabi clip — Bot/Sim QA must custom-replay the noise-bleed WAV (first lock **25:69**, never **2:1**) and confirm `all` still **14/14**.
- **Restore:** `npm i` → `npm run fixtures:recitation` → `npm run fixtures:imam` (zip **uploaded**; also copies Qiyam WAV into `imam-mid-surah-cold-qiyam/qari-a/`). Liturgy: ffmpeg on `PATH` then `npm run liturgy:tts -- <id> --engine say`.
- **Known fails:** mid-surah cold **cleared on Mac via #17**. Masjid-e-Nabi **2:1** false lock is **unit-gated here**; Mac WAV re-measure is Bot/Sim. Still queued (algo 02–04): ahzab cold **33:62≠33:60**; baqarah→imran **≠57:28**; hafiz-usama Fatiha→**27:15**. Still blocked: `imam-mid-ayah-pause` (no pause mark); Qunut@s9P 4:56 = dua not Quran. Other real-imam rows stay **stub**.
- **Open tracks:** **next** `prompts/real-imam/algo/02-ahzab-to-saba-cold-33-60-vs-33-62.md` → 03→04 (`algo/00-QUEUE.md`). Liturgy TTS `tts-fill/03-ruku.md`.

## For assistants / Grok bots — read first

You have no prior thread. Do not invent product history, ayah numbers, or Mac results.

| | |
|---|---|
| Repo | https://github.com/Khizar699/zikrist-cursor |
| Product | **Zikrist** — offline Expo ayah locator + salah liturgy (Android/iPhone, including mid-range). Algorithm and recognition correctness beat visual design this MVP. **No Figma** for the MVP. |
| Hard gate | `npm run test:replay -- all` must stay **14/14** Quran. Linux ONNX is not that gate. |
| Labels | Ground truth: `prompts/real-imam/LABELS.md` + `prompts/real-imam/labels.json` (Khizar, 2026-09-16). **Not** `probes/hypothesized-locks.txt`. Never invent ayah labels. |
| Suites | `imam-mid-surah-cold` is **`ready`** (Subayyal **4:129–130**). Sibling `imam-mid-surah-cold-qiyam` is **`ready`** (Qiyam **36:16–18**). Other `prompts/real-imam/manifest.stub.json` rows stay **`stub`**. Restoring wavs is not a `ready` flip. |

**After clone**

```sh
npm i
npm run fixtures:recitation    # EveryAyah Quran replay wavs
npm run fixtures:imam          # Release tag imam-fixtures-v1 / zikrist-imam-fixtures-v1.zip
```

The zip is **uploaded**. If `fixtures:imam` 404s, the tag/asset was removed or `ZIKRIST_IMAM_RELEASE_TAG` is wrong — see https://github.com/Khizar699/zikrist-cursor/releases. Do not commit audio.

**Liturgy TTS** (gitignored under `artifacts/recitation/liturgy/`): put ffmpeg on `PATH`, then Mac `say` Majed:

```sh
export PATH="/tmp/ffmpeg-static:$PATH"
npm run liturgy:tts -- <id> --engine say
```

Examples: `liturgy-takbeer`, `liturgy-thana`. Never invent silent WAVs that would PASS.

**Mid-surah cold (Mac-green via #17)**

#17 cleared the false first-locks. Label-fill **01** marked `imam-mid-surah-cold` **ready**. Label-fill **02** marked sibling `imam-mid-surah-cold-qiyam` **ready**. Keep those suites **untouched**.

| Clip | Want | Status | Next |
|---|---|---|---|
| Dr Subayyal | **4:129–130** | Mac-green (#17); **ready** (#18) | Bot/Sim `test:replay -- imam-mid-surah-cold` (must still PASS) |
| Qiyam Faisal | **36:16–18** | Mac-green (#17); **ready** (#19) | Bot/Sim `test:replay -- imam-mid-surah-cold-qiyam` |
| Masjid-e-Nabi | **25:69–77** | algo this PR (units: never first-lock **2:1**) | Bot/Sim custom replay of noise-bleed WAV |

**Masjid-e-Nabi (this PR, algo only)**

Prefer `imam-noise-bleed__masjid-e-nabi__025-069-077__raw.wav` (twin also under mid-surah-cold). Want first lock **25:69**, never Baqarah **2:1**. Manifest stays **stub**. Mosque WAVs are not on the Linux VM — units in `tests/follower.test.ts` encode **25:69 ≠ 2:1**. Bot/Sim on Mac:

```bash
npx tsx scripts/replay.ts \
  artifacts/recitation/imam/imam-noise-bleed/qari-a/imam-noise-bleed__masjid-e-nabi__025-069-077__raw.wav
npm run test:replay -- all
```

**Teammate lanes** (if someone recreates bots)

- **Prompt Smith** — session prompts under `prompts/`
- **Sim QA** — Mac acoustic replay / `test:replay`
- **Chief Bot** — merges **only after Mac green**

**Push / merge policy:** Mac `all` **14/14** before merge. Flip only the matching label-fill suite. Never invent ayah labels. Do not retune matcher/follower in a fill PR.

**Current open tracks**

- **Next:** `prompts/real-imam/algo/02-ahzab-to-saba-cold-33-60-vs-33-62.md` (ahzab cold **33:62 ≠ 33:60**), then 03→04. One prompt each; do not mega-fill. Mid-ayah-pause still blocked until a founder pause mark.
- Liturgy TTS after thana — `prompts/salah-liturgy/tts-fill/03-ruku.md`
- Other real-imam suites stay **stub** (`imam-mid-ayah-pause` blocked; Qunut ≠ Quran). Noise-bleed Masjid-e-Nabi stays stub until Mac-green + a later label-fill.

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

Asset is live. A 404 means the tag/asset disappeared or `ZIKRIST_IMAM_RELEASE_TAG` is wrong; the script still names https://github.com/Khizar699/zikrist-cursor/releases.

`imam-mid-surah-cold` is `ready` (Subayyal 4:129–130). Sibling `imam-mid-surah-cold-qiyam` is `ready` (Qiyam 36:16–18). Other real-imam suites stay `stub`. Restoring wavs is not a readiness flip. `npm run test:replay -- real-imam` **skips** remaining stubs with `missing_fixture` (not PASS). Ready suites error `missing_clip` until `npm run fixtures:imam` restores the WAV (that restore also copies Qiyam into `imam-mid-surah-cold-qiyam/qari-a/`); Mac must then PASS (not skip).

## Liturgy TTS wavs (gitignored)

Liturgy evaluation audio is generated on the machine, not restored from the imam zip:

```sh
export PATH="/tmp/ffmpeg-static:$PATH"
npm run liturgy:tts -- liturgy-takbeer --engine say
```

Replace the suite id (`liturgy-thana`, `liturgy-ruku`, …) when that fill session exists. Needs `say` + ffmpeg on Mac (Majed). Wavs stay under `artifacts/recitation/liturgy/` and must not be committed.

## Rights

Imam and bystander recordings are evaluation-only. They are not app assets. A public Release URL is not a redistribution or training grant. See `THIRD_PARTY_NOTICES.md`.
