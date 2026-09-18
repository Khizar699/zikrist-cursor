# Handoff

Friends and **new Grok / Cursor agents** (no chat history) start here. Large recitation wav/mp3 is **not** in git (no Git LFS). Founder-verified imam **labels** are in git. Audio is restored locally.

**Human first clone (ordered npm commands):** [SETUP.md](SETUP.md).

## Maintainer rule (founder)

Every PR that merges to `main` **must** update this file **in the same PR**: what landed, tip state, open tracks, gates (`npm run test:replay -- all` = **14/14** Quran regression floor; algo Tip work also notes product bar from `prompts/real-imam/algo/PRODUCT-BAR.md`), fixture restore commands, known fails. Prompt Smith / cloud agents follow `prompts/_SHARED-HANDOFF.md`. A PR without a `HANDOFF.md` bump is not mergeable. CI: `.github/workflows/handoff-required.yml`.


## Dictation for successor bots

Binding obligation for **anyone continuing this repo** (friend + their Grok/Cursor bots, Prompt Smith, cloud agents). No chat history is not an excuse.

**Write, do not only read.** Continuity docs go in the **same PR** as the code/prompt work:

1. **`HANDOFF.md` Tip state — always.** What landed, tip SHA/PR, open tracks, gates, known fails, restore cmds if changed.
2. **`VALIDATION.md`** — when Mac/Linux verify paths change or you record a new Mac-green result.
3. **Active prompt / queue status** — mark done/held/next in the relevant `prompts/**/00-QUEUE.md` (or session prompt) if the overnight queue tracks it.
4. **`zikrist_pipeline_export.txt`** — after any `src/core/` or `src/services/` change, run `npm run pipeline:export` in the same change set.
5. Follow `prompts/_SHARED-HANDOFF.md` **exactly**.

**Your session is incomplete without a `HANDOFF.md` tip bump.** CI already requires `HANDOFF.md` in the PR diff (`.github/workflows/handoff-required.yml`).

## Bot start protocol

Cheap read order (do not load every `prompts/**` file up front):

1. **Tip state** only first (next section).
2. Then `AGENTS.md`.
3. Then the **single** open-track prompt named in Tip.
4. If Tip is recognition / algo / follower: obey always-on `.cursor/rules/zikrist-recognition-ratchet.mdc` and skim `prompts/real-imam/algo/PRODUCT-BAR.md` + `RATCHET.md` (index: `algo/README.md`).
5. Restore fixtures if missing: `npm run fixtures:recitation` then `npm run fixtures:imam`.

Skip overnight queues unless picking next work. Dictation above is what to **write** in the PR. Local Cursor Agent/Composer: `.cursor/rules/zikrist-continuity.mdc` + `zikrist-recognition-ratchet.mdc` (`alwaysApply`) — same read order; do not duplicate dictation here.

## Tip state (update every PR)

- **This PR:** Local Mac Agent — continuation-gate last-ayah test now paints salah-prior **[105:1]** / **[108:1]** from `verse_match` alone (no `word_progress`). Imam fixture helper tests moved to `scripts/fixtures/download-imam-fixtures.test.ts` and are no longer in `npm test`; run `npm run test:fixtures` when touching the restore script. `npm test` stays `tsx --test tests/*.test.ts` (in-memory follower/gate only).
- **Prior tip:** focused mushaf unit lock in `tests/mushaf-tracking.test.ts` (no translation/SQLite). Sequential Fatiha **1:2→1:3**; Kafirun **109:6** leftover `ألم تر كيف فعل ربك` commits **[105:1]** and refuses **4:142** / **105:5**.
- **Gate (floor):** `npm test` **287/287** + typecheck. Fixture restore helpers are `npm run test:fixtures` (not in the default suite). Mac `npm run test:replay -- all` not re-run (units only). Last recorded floor remains **12/14 FAIL** (`english-negative:verse_lock_20:1`, `stall-after-lock:no_matches`). Do not claim 14/14.
- **Product bar:** nas **114:1@4s–6** with **no 4:142**; jump Kawthar→Ikhlas **112:1@16.5s–4**; back-to-back Asr then **106:1@22.25s–4**; asr **103:1–3** (no 92:1). Ready imam mid-surah-cold **4:129@11s→4:130@19.5s** PASS. qiyam **FAIL** first lock **2:1@5.5s** (want **36:16**). Live Simulator recitation not re-measured.
- **Ratchet:** continuation-gate **109:6→[105:1]/[108:1]** without `word_progress`. `tests/mushaf-tracking.test.ts` — sequential Fatiha **1:2→1:3** no Global Search; **109:6→[105:1]** pool `ayah<=2` refuse **4:142**/**105:5**; madd+pause sticky **1:7**. Prior units — refuse **4:142** / **112:4** / **113:5** handoffs; 1-token refuse; Fil **105:1** 3-miss breakout; Nas leftover `الناس` must not lock **4:1**; garbled `قر قريش` still **106:1**; lone `قريش` must not; acquire locate flags stay `[false]`; cold **112:2** via throttled JS search; Ya-Sin **36:16** lookback must not steal **2:1**. Do not weaken no-global-freeze / sticky-lock / sim-test-2 expects.
- **Restore:** `npm ci` → `npm run setup` (or `setup -- --fixtures`) → `npm run ios`.
- **Known fails:** Floor **english-negative** (`floor-english-negative-20-1`) and **stall-after-lock** `no_matches` (112:2 clip never verse_match without Tilawa locate). Ready qiyam **36:16** false-lock **2:1** this session. Handoff: hafiz-usama →**27:15** (`product-hafiz-usama-27-15`, stall after **1:7**, **2:1** cleared). Soft deferred: `soft-quraysh-to-2-1`. Nas trail **4:142** **cleared** on Mac nas suite (locked). Still blocked: `imam-mid-ayah-pause`; Qunut@s9P 4:56. Deferred P2: masjid **25:69≠2:1**; ahzab **33:62≠33:60**; baqarah→imran **≠57:28**. Live Ikhlas 112:2 stall **cleared** (locked). Jump, live shared-tail, and 109:6 carousel freeze remain **cleared**. Simulator 1:7→114:1 gate hold **cleared** in units (live recitation not re-measured). Phase C streaming swap **not taken**.
- **Open tracks:** **P0** floor restore (`floor-english-negative-20-1` **and** stall-after-lock) **or** `product-hafiz-usama-27-15`. Ready qiyam **2:1** false-lock. Remaining chrome in `prompts/live-passage-chrome.md`. Then `npm run findings:report`. Liturgy TTS `tts-fill/03-ruku.md`.


## For assistants / Grok bots — read first

You have no prior thread. Do not invent product history, ayah numbers, or Mac results.

| | |
|---|---|
| Repo | https://github.com/Khizar699/zikrist-cursor |
| Product | **Zikrist** — offline Expo ayah locator + salah liturgy (Android/iPhone, including mid-range). Algorithm and recognition correctness beat visual design this MVP. **No Figma** for the MVP. |
| Cursor always-on | `.cursor/rules/zikrist-continuity.mdc` + `.cursor/rules/zikrist-recognition-ratchet.mdc` |
| Premade test + ratchet | `prompts/real-imam/algo/PRODUCT-BAR.md`, `RATCHET.md`, `COVERAGE.md`, findings `prompts/real-imam/findings/`, pack index `algo/README.md` — Agent runs Mac verify; every fix locks a permanent test; corpus grows; Tier A coverage is honest M/N scoreboard |
| Regression floor | `npm run test:replay -- all` must stay **14/14** Quran when claiming green (honest N/14 if red). Linux ONNX is not that gate. |
| Product bar | Algo/follower sessions: Tip clip must show **correct lock + ordered advance** while audio continues. 14/14 alone ≠ done. Famous-short EveryAyah green ≠ all-surah / prayer-follow ready. |
| Labels | Ground truth: `prompts/real-imam/LABELS.md` + `prompts/real-imam/labels.json` (Khizar, 2026-09-16). **Not** `probes/hypothesized-locks.txt`. Never invent ayah labels. |
| Suites | `imam-mid-surah-cold` is **`ready`** (Subayyal **4:129–130**). Sibling `imam-mid-surah-cold-qiyam` is **`ready`** (Qiyam **36:16–18**). Other `prompts/real-imam/manifest.stub.json` rows stay **`stub`**. Restoring wavs is not a `ready` flip. Short ready sequences ≠ Fatiha→body handoff. |

**After clone**

```sh
npm ci                 # or npm i
npm run setup          # ONNX model (~104 MB) + verify; fails early on bad ios/
npm run ios            # simulator app — not Expo Go
```

Recognition / overnight bots also need gitignored audio:

```sh
npm run setup -- --fixtures
# or: npm run fixtures:recitation && npm run fixtures:imam
```

The imam zip is **uploaded**. If `fixtures:imam` 404s, the tag/asset was removed or `ZIKRIST_IMAM_RELEASE_TAG` is wrong — see https://github.com/Khizar699/zikrist-cursor/releases. Do not commit audio.

If the app red-boxes on `fastconformer_full_mixed.onnx`, setup was skipped. If it says `NSMicrophoneUsageDescription` is missing or the bundle is `org.name.Zikrist`: `npx expo prebuild --platform ios --clean` then `npm run ios`.

**Liturgy TTS** (gitignored under `artifacts/recitation/liturgy/`): put ffmpeg on `PATH`, then Mac `say` Majed:

```sh
export PATH="/tmp/ffmpeg-static:$PATH"
npm run liturgy:tts -- <id> --engine say
```

Examples: `liturgy-takbeer`, `liturgy-thana`. Never invent silent WAVs that would PASS.

**Mid-surah cold (Mac-green via #17)**

#17 cleared the false first-locks. Label-fill **01** marked `imam-mid-surah-cold` **ready**. Label-fill **02** now marks sibling `imam-mid-surah-cold-qiyam` **ready**. This session does **not** claim a new Mac acoustic score — Bot/Sim QA runs `npm run test:replay -- imam-mid-surah-cold-qiyam` (must PASS, not `missing_fixture`) plus Subayyal still PASS and `all` **14/14**.

| Clip | Want | Status | Next |
|---|---|---|---|
| Dr Subayyal | **4:129–130** | Mac-green (#17); **ready** (#18) | Bot/Sim `test:replay -- imam-mid-surah-cold` (must still PASS) |
| Qiyam Faisal | **36:16–18** | Mac-green (#17); **ready** this PR | Bot/Sim `test:replay -- imam-mid-surah-cold-qiyam` |

**Teammate lanes** (if someone recreates bots)

- **Prompt Smith** — session prompts under `prompts/`
- **Sim QA** — Mac acoustic replay / `test:replay`
- **Chief Bot** — merges **only after Mac green**

**Push / merge policy:** Mac `all` **14/14** before merge when claiming floor-green (honest N/14 if red). Algo claims also need Tip product bar + **ratchet lock** (`algo/PRODUCT-BAR.md`, `algo/RATCHET.md`). Flip only the matching label-fill suite. Never invent ayah labels. Do not retune matcher/follower in a fill PR.

**Current open tracks**

- **P0:** floor restore english-negative (`floor-english-negative-20-1`) **and** stall-after-lock, **or** `prompts/real-imam/algo/04-hafiz-usama-1-2-vs-27-15.md`. Mushaf units + continuation-gate salah-prior ayah-1 paint landed this session. Each recognition fix must lock a permanent test (`RATCHET.md`). Live follow Phase A+B+C landed. Default stays Tilawa (`npm run test:bakeoff`).
- P1 live chrome: `prompts/live-passage-chrome.md` (Arabic-only stage landed in `prompts/arabic-verse-stage.md`; island/gear still open).
- Liturgy TTS after thana Mac-green — `prompts/salah-liturgy/tts-fill/03-ruku.md`


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
