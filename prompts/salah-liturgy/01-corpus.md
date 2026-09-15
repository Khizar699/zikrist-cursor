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
