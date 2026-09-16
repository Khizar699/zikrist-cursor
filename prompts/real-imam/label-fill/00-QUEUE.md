# Real-imam label-fill queue (flip stubs → ready)

**Depends on:** founder labels in git (`prompts/real-imam/LABELS.md` + `labels.json`); audio via `npm run fixtures:imam` (Release `imam-fixtures-v1`).  
**Algo gate cleared:** PR **#17** merged — mid-surah cold false-lock Mac-green (Subayyal **4:129**, Qiyam **36:16**). Label-fill is **UNBLOCKED**.

**Hard gate every session:** Mac `npm run test:replay -- all` = **14/14**.  
**Continuity docs:** bump `HANDOFF.md` tip in the same PR; update `VALIDATION.md` and this queue when they apply (`prompts/_SHARED-HANDOFF.md`).

**Rules** — see `_SHARED.md`. One suite (or one new sibling suite id) per Cursor session. **No** matcher/follower retune in fill PRs.

## Next launch (tip)

1. **`01-mid-surah-cold-dr-subayyal.md`** ← **launch this CloudAgent session now**
2. `02-mid-surah-cold-qiyam.md` — after 01 merged Mac-green ready
3. Later (draft when 01–02 green): surah-switch / noise-bleed / multi-qari — one prompt each from `labels.json` `suite_candidates`
4. `imam-mid-ayah-pause` — **only after** founder adds a pause mark

## Still blocked

| Suite / clip | Why |
|---|---|
| `imam-mid-ayah-pause` | No founder pause-inside-ayah mark — leave stub |
| s9P8adOF7F0 @ 4:56 Qunut | Dua / liturgy later — **not** Quran expect |

After each fill: Mac `test:replay -- <suite>` **PASS** (not skip); other imam stubs may skip; `all` stays 14/14; bump `HANDOFF.md` tip + this queue.
