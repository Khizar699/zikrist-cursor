# Real-imam label-fill queue (flip stubs → ready)

**Depends on:** founder labels in git (`prompts/real-imam/LABELS.md` + `labels.json`); audio via `npm run fixtures:imam` (Release `imam-fixtures-v1`).  
**Algo gate cleared:** PR **#17** merged — mid-surah cold false-lock Mac-green (Subayyal **4:129**, Qiyam **36:16**). Label-fill is **UNBLOCKED**.

**Hard gate every session:** Mac `npm run test:replay -- all` = **14/14**.  
**Continuity docs:** bump `HANDOFF.md` tip in the same PR; update `VALIDATION.md` and this queue when they apply (`prompts/_SHARED-HANDOFF.md`).

**Rules** — see `_SHARED.md`. One suite (or one new sibling suite id) per Cursor session. **No** matcher/follower retune in fill PRs.

## Next launch (tip)

1. `01-mid-surah-cold-dr-subayyal.md` — **done** (#18; `imam-mid-surah-cold` → ready, An-Nisa **4:129–130**).
2. `02-mid-surah-cold-qiyam.md` — **done** this PR (sibling `imam-mid-surah-cold-qiyam` → ready, Ya-Sin **36:16–18**). Mac acoustic score is Bot/Sim, not this VM.
3. Later (draft when 01–02 green): remaining founder-labeled clips — surah-switch / noise-bleed / multi-qari — one prompt each from `labels.json` `suite_candidates`
4. `imam-mid-ayah-pause` — **only after** founder adds a pause mark
5. Parallel: liturgy TTS `prompts/salah-liturgy/tts-fill/03-ruku.md`

## Status

| Prompt | Suite | Status |
|---|---|---|
| `01-mid-surah-cold-dr-subayyal.md` | `imam-mid-surah-cold` (An-Nisa **4:129–130**) | **done** — manifest `ready` (#18) |
| `02-mid-surah-cold-qiyam.md` | sibling `imam-mid-surah-cold-qiyam` (Ya-Sin **36:16–18**) | **done** — manifest `ready` (this PR) |

## Still blocked

| Suite / clip | Why |
|---|---|
| `imam-mid-ayah-pause` | No founder pause-inside-ayah mark — leave stub |
| s9P8adOF7F0 @ 4:56 Qunut | Dua / liturgy later — **not** Quran expect |

After each fill: Mac `test:replay -- <suite>` **PASS** (not skip); other imam stubs may skip; `all` stays 14/14; bump `HANDOFF.md` tip + this queue.
