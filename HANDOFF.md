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

Cheap read order — **silent**. Do not recite this list, announce a plan, or say that you are reading Tip / `AGENTS.md` / continuity rules. First user-visible action is a code edit, file write, test run, or terminal command. Do not load every `prompts/**` file up front:

1. **Tip state** only first (next section).
2. Then `AGENTS.md`.
3. Then the **single** open-track prompt named in Tip.
4. If Tip is recognition / algo / follower: obey always-on `.cursor/rules/zikrist-recognition-ratchet.mdc` and skim `prompts/real-imam/algo/PRODUCT-BAR.md` + `RATCHET.md` (index: `algo/README.md`).
5. Restore fixtures if missing: `npm run fixtures:recitation` then `npm run fixtures:imam`.

Skip overnight queues unless picking next work. Dictation above is what to **write** in the PR. Local Cursor Agent/Composer: `.cursor/rules/zikrist-continuity.mdc` + `zikrist-recognition-ratchet.mdc` (`alwaysApply`) — same read order; do not duplicate dictation here.

## Tip state (update every PR)

- **This PR:** Local Mac Agent — **silent start for Cloud/headless agents.** `AGENTS.md` Workflow now forbids conversational preamble / meta-announcements / doc-reading recitations; Tip + continuity reads are **silent**; first user-visible action is a code edit, test, or command. `.cursor/rules/zikrist-continuity.mdc` and `zikrist-recognition-ratchet.mdc` instruct jump-straight-to-execution (no plan/mantra/recitation). HANDOFF Bot start protocol same silence. Phase 1 mushaf-first law, dual bar, and ratchet **unchanged**. Docs-only; `npm test` / Mac `test:replay -- all` not re-run. Last recorded floor remains **12/14 FAIL**. Last recorded units **291/291**.
- **Prior tip:** Phase 1 engineering law. `AGENTS.md` / README / VALIDATION / product bar name the acoustic-to-mushaf engine as the only active work: neighborhood `[current − 1, current + 2]`, monotonic follow, madd/CTC must not Global Search, surah handoff enters ayah 1 (ayah 2 after Basmala), bounded capture. Translation is **Phase 2**: a static `[surah:ayah]` lookup after Arabic tracking is flawless. Default `npm test` must not grow network / translation-SQLite / pack-download tests.
- **Gate (floor):** Last recorded `npm test` **291/291** + typecheck. Mac `npm run test:replay -- all` not re-run. Last recorded floor remains **12/14 FAIL** (`english-negative:verse_lock_20:1`, `stall-after-lock:no_matches`). Do not claim 14/14.
- **Product bar:** mushaf lock + monotonic advance + correct Arabic. nas **114:1@4s–6** with **no 4:142**; jump Kawthar→Ikhlas **112:1@16.5s–4**; back-to-back Asr then **106:1@22.25s–4**; asr **103:1–3** (no 92:1). Ready imam mid-surah-cold **4:129@11s→4:130@19.5s** PASS. qiyam **FAIL** first lock **2:1@5.5s** (want **36:16**). Live Simulator recitation not re-measured. Match-to-display p95 < 50 ms is an evaluation target, not a claimed Mac result. Translation display is **not** the bar.
- **Ratchet:** Phase 1 unit order = monotonic follow, ayah-1 handoff, madd/CTC cousins (`tests/mushaf-tracking.test.ts`). `MUSHAF_ONLY_MVP` + empty-translation mushaf display. Continuation-gate **109:6→[105:1]/[108:1]** without `word_progress`. Prior units — refuse **4:142** / **112:4** / **113:5** handoffs; 1-token refuse; Fil **105:1** 3-miss breakout; Nas leftover `الناس` must not lock **4:1**; garbled `قر قريش` still **106:1**; lone `قريش` must not; acquire locate flags stay `[false]`; cold **112:2** via throttled JS search; Ya-Sin **36:16** lookback must not steal **2:1**. Do not weaken no-global-freeze / sticky-lock / sim-test-2 expects.
- **Restore:** `npm ci` → `npm run setup` (or `setup -- --fixtures`) → `npm run ios`. No first-launch translation download.
- **Known fails:** Floor **english-negative** (`floor-english-negative-20-1`) and **stall-after-lock** `no_matches` (112:2 clip never verse_match without Tilawa locate). Ready qiyam **36:16** false-lock **2:1**. Handoff: hafiz-usama →**27:15** (`product-hafiz-usama-27-15`, stall after **1:7**, **2:1** cleared). Soft deferred: `soft-quraysh-to-2-1`. Nas trail **4:142** **cleared** on Mac nas suite (locked). Still blocked: `imam-mid-ayah-pause`; Qunut@s9P 4:56. Deferred P2: masjid **25:69≠2:1**; ahzab **33:62≠33:60**; baqarah→imran **≠57:28**. Live Ikhlas 112:2 stall **cleared** (locked). Jump, live shared-tail, and 109:6 carousel freeze remain **cleared**. Simulator 1:7→114:1 gate hold **cleared** in units (live recitation not re-measured). Phase C streaming swap **not taken**.
- **Open tracks:** **P0** mushaf follow: floor restore (`floor-english-negative-20-1` **and** stall-after-lock) **or** `product-hafiz-usama-27-15`. Ready qiyam **2:1** false-lock. Then Arabic chrome in `prompts/live-passage-chrome.md`. Translation-first prompts stay parked (Phase 2). Then `npm run findings:report`. Liturgy TTS `tts-fill/03-ruku.md` is not P0.


## For assistants / Grok bots — read first

You have no prior thread. Do not invent product history, ayah numbers, or Mac results.

| | |
|---|---|
| Repo | https://github.com/Khizar699/zikrist-cursor |
| Product | **Zikrist** — offline Expo **mushaf follower** (Android/iPhone, including mid-range). Phase 1: listen → lock `[surah:ayah]` → paint canonical Arabic → follow monotonically. **Phase 2 translation** is a static `[surah:ayah]` lookup after Arabic tracking is flawless — not current work. Algorithm beats visual design. **No Figma** for the MVP. |
| Cursor always-on | `.cursor/rules/zikrist-continuity.mdc` + `.cursor/rules/zikrist-recognition-ratchet.mdc` |
| Premade test + ratchet | `prompts/real-imam/algo/PRODUCT-BAR.md`, `RATCHET.md`, `COVERAGE.md`, findings `prompts/real-imam/findings/`, pack index `algo/README.md` — Agent runs Mac verify; every fix locks a permanent test; corpus grows; Tier A coverage is honest M/N scoreboard |
| Regression floor | `npm run test:replay -- all` must stay **14/14** Quran when claiming green (honest N/14 if red). Linux ONNX is not that gate. |
| Product bar | Algo/follower sessions: Tip clip must show **correct lock + monotonic ordered advance + matching Arabic mushaf** while audio continues (neighborhood `[current − 1, current + 2]`; surah handoff enters ayah 1). 14/14 alone ≠ done. Translation is not this bar. |
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

- **P0:** mushaf follow — floor restore english-negative (`floor-english-negative-20-1`) **and** stall-after-lock, **or** `prompts/real-imam/algo/04-hafiz-usama-1-2-vs-27-15.md`. Phase 1 law: neighborhood follow, madd/CTC sticky lock, ayah-1 handoff. Translation is Phase 2 (`[surah:ayah]` lookup). Each recognition fix must lock a permanent test (`RATCHET.md`). Default stays Tilawa (`npm run test:bakeoff`).
- P1 Arabic chrome: `prompts/live-passage-chrome.md` (translation pane stays off).
- Liturgy TTS after thana Mac-green — `prompts/salah-liturgy/tts-fill/03-ruku.md` (not P0).


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
