# Real-imam label-fill queue (flip stubs → ready)

**Depends on:** harness real-imam scaffold on main; founder labels in `artifacts/recitation/imam/LABELS.md` + `labels.json` (2026-09-16).  
**Audio:** gitignored under `artifacts/recitation/imam/` (already cut/named for several candidates).

**Hard gate every session:** Mac `npm run test:replay -- all` = **14/14**.

**Rules** — see `_SHARED.md`. One suite (or one new sibling suite id) per Cursor session. No matcher retune.

## Blocked

| Suite / clip | Why |
|---|---|
| `imam-mid-ayah-pause` | No founder pause-inside-ayah mark yet — leave stub |
| s9P8adOF7F0 @ 4:56 Qunut | Dua / liturgy track later — **not** Quran expect |

## Launch order

1. `01-mid-surah-cold-dr-subayyal.md` — **start here:** flip `imam-mid-surah-cold` → ready (An-Nisa **4:129–130**)
2. `02-mid-surah-cold-qiyam.md` — sibling suite `imam-mid-surah-cold-qiyam` → ready (Ya-Sin **36:16–18**)
3. Later (draft when 01–02 green): surah-switch (`ahzab-to-saba` / `baqarah-to-imran`), noise-bleed (masjid-e-nabi), multi-qari slots — one prompt each from `labels.json` `suite_candidates`
4. `imam-mid-ayah-pause` — **only after** founder adds a pause mark

After each: Mac `test:replay -- <suite>` PASS; other imam stubs may skip; `all` stays 14/14.
