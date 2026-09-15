# Salah liturgy corpus v1 (data only)

## Goal

Add an offline, versioned **salah liturgy phrase pack**: canonical Arabic recognition text + approved English gloss per phrase, with IDs, categories, and content hashes. No matcher/UI in this session.

## Why now

Quran replay is 14/14 @fffa1f6. Founder wants liturgy (takbeer, thana, ruku/sujood, tashahhud, darood, common duas) recognized with Arabic+English **before** real-imam fixture expansion.

## Scope — include (MVP liturgy set)

Stable Hanafi/common Sunni salah phrases (document edition assumptions; do not invent scholarly attributions):

1. `takbeer` — الله أكبر  
2. `thana` — سبحانك اللهم وبحمدك وتبارك اسمك وتعالى جدك ولا إله غيرك  
3. `istiadha` — أعوذ بالله من الشيطان الرجيم (if treated as liturgy not Quran-only)  
4. `basmala_liturgy` — only if distinct from Quran Basmala display rules (or skip and reuse Quran basmala hold)  
5. `ruku_tasbih` — سبحان ربي العظيم (+ optional وبحمده)  
6. `sujood_tasbih` — سبحان ربي الأعلى (+ optional وبحمده)  
7. `jami_bayn` — سمع الله لمن حمده / ربنا ولك الحمد (standing after ruku)  
8. `tashahhud` — التحيات… (full attahiyat text; pin one widely used wording)  
9. `darood_ibrahim` — اللهم صل على محمد… (pin one wording)  
10. `dua_qunoot` — optional v1 defer if contested; mark unresolved  
11. Short responses: `amin`, `assalamu_alaikum_warahmatullah` (salam end)

Each row: `id`, `category`, `arabic_uthmani`, `arabic_recognition_normalized`, `english`, `source_note`, `license_status`, `sha256`.

## Out of scope

- Matcher / follower changes  
- UI  
- Real-imam mosque recordings  
- Claiming all madhhab variants  

## Constraints

- Offline JSON/SQLite under content assets; same integrity style as Quran packs (`assets:verify`)  
- English is a **gloss**, not Quran translation; label it as liturgy/prayer text in metadata  
- Unresolved rights → mark blocker, do not invent clearance  
- Read AGENTS.md content/license sections; update THIRD_PARTY_NOTICES if redistributing text  

## Files

- New: `assets/content/salah-liturgy.json` (or equivalent) + verify hook  
- `prompts/salah-liturgy/01-corpus.md`, README/VALIDATION notes  
- Tests: schema/count/hash/unique-id  

## Success criteria

1. Pack loads offline; `npm run assets:verify` (or new `liturgy:verify`) passes  
2. Unit tests for schema + uniqueness  
3. Document exact Arabic strings chosen and what was deferred  
4. **No** change to `src/core/follower.ts` recognition behavior  
5. `npm test` still green; Quran `test:replay -- all` still 14/14 if run  

## Deliverable

File paths, phrase count, deferred list, verify command.

## v1 pin (this pack)

- Pack: `assets/content/salah-liturgy.json` (18 phrases, `kind: salah_liturgy`, `english_kind: liturgy_gloss`).
- Schema/hash: `src/core/salah-liturgy.ts`. Verify: `npm run liturgy:verify` (also first step of `npm run assets:verify`). Units: `tests/salah-liturgy.test.ts`.
- Edition: Hanafi / common Sunni mosque liturgy. Tashahhud = Ibn Masʿūd (Bukhari 831 / Muslim 402). Thana = Hanafi istiftah. Darood = Bukhari 3370 / Muslim 406 ṣalli+bārik without `في العالمين`.
- Deferred: `basmala_liturgy`, `dua_qunoot`, `sitting_between_sujood`, `istiftah_wajjahtu`, `darood_ibrahim_fil_alamin`, `istiadha_samee_aleem`.
- No matcher/UI/`follower.ts` changes in this session.

### Adding a phrase (data only)

1. Append a `phrases[]` row: snake_case `id`, v1 `category`, vocalized `arabic_uthmani`, liturgy-gloss `english`, `source_note`, `license_status`.
2. Set `arabic_recognition_normalized` to `normalizeLiturgyArabic(arabic_uthmani)` (strip harakat; keep hamza letters; `ٱ` → `ا`).
3. Set `sha256` to hex SHA-256 of UTF-8 `id\ncategory\narabic_uthmani\narabic_recognition_normalized\nenglish\nsource_note\nlicense_status`.
4. Contested formulas go in `deferred`, not as fake Quran surahs.
5. Run `npm run liturgy:verify` and `npm test`. Headless audio fixtures are session `04-replay-suites.md`.
