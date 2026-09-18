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
4. Follow `prompts/_SHARED-HANDOFF.md` **exactly**.

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

- **This PR:** Local Mac Agent — **live follow Phase B** (`prompts/live-follow-phases.md`). After lock, follow transcribes only (`locate=false`) and scores the CTC token stream against current remainder + mushaf-next. Shared-tail / short-next / joined-ayah classes are unit-locked; a stem of the current body is not enough to hear next. Same-surah advance still uses leftover evidence, not a blob-vs-mushaf locate. Default model is still Tilawa. Phase C bakeoff is `prompts/model-bakeoff.md` only if a phone still misses the tracking clock.
- **Prior tip:** live follow Phase A — splice 0.25 s, backlog keeps lock, sequential focus, word highlight, timeline skip.
- **Gate (floor) — this Mac session:** `npm test` **238/238**; typecheck pass. `npm run test:replay -- all` = **13/14 FAIL**. Remaining: `english-negative:verse_lock_20:1`. `fatiha` 1:2–7; `nas` 114:1–6; `ikhlas` 112:1–4; `jump` 108:1–3 then 112:1@16.75–112:4. Do not claim 14/14.
- **Product bar:** Famous-short ordered advance: Fatiha 1:2@9s then 1:3–7; Nas 114:1–6; Ikhlas 112:1–4; jump 108:1–3 then 112:1@16.75–4. Ready `imam-mid-surah-cold` PASS (4:129–130); `imam-mid-surah-cold-qiyam` PASS (36:16–18). Hafiz Usama →27:15 was **not** re-measured. Clip class: `famous-short` follow. Not a physical-device claim.
- **Ratchet:** units lock expected-tape classes (shared tail, short next, joined remainder+next, formula opening, CTC cousin الله≈اله, current-body stem is not next) plus follow hops `locate=false` with no `bestJoint03Match` while the tape explains. Finding `live-follow-late-skip` **closed**. Finding `live-follow-expected-tape` **closed**.
- **Restore:** `npm ci` → `npm run setup` (or `setup -- --fixtures`) → `npm run ios`. Reload Metro after this follow change.
- **Known fails:** floor **english-negative** (`floor-english-negative-20-1`). Handoff: hafiz-usama →**27:15** (`product-hafiz-usama-27-15`, stall after **1:7**, **2:1** cleared). Soft deferred: `soft-nas-to-2-1`, `soft-quraysh-to-2-1`. Still blocked: `imam-mid-ayah-pause`; Qunut@s9P 4:56. Deferred P2: masjid **25:69≠2:1**; ahzab **33:62≠33:60**; baqarah→imran **≠57:28**. Jump and live shared-tail stall remain **cleared**.
- **Open tracks:** **P0** floor restore (`floor-english-negative-20-1`) **or** `product-hafiz-usama-27-15`. Phase C bakeoff only if a phone still misses follow latency. Then `npm run findings:report`. Do not swap Tilawa until `prompts/model-bakeoff.md`. Liturgy TTS `tts-fill/03-ruku.md`.


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

- **P0:** floor restore english-negative (`floor-english-negative-20-1`) **or** `prompts/real-imam/algo/04-hafiz-usama-1-2-vs-27-15.md` — each fix must lock a permanent test (`RATCHET.md`). Live follow Phase A+B landed. Do not swap Tilawa until `prompts/model-bakeoff.md`.
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
