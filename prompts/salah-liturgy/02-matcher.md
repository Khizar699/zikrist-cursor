# Salah liturgy matcher (detect without breaking Quran 14/14)

## Goal

Wire an offline **liturgy detector** beside Quran acquire/follow: when heard tokens match a v1 corpus phrase, emit a confirmed **liturgy lock** (`phrase_id` + timing/confidence). Must **not** turn liturgy into false Quran ayah commits.

## Depends on (landed)

Main `47078fd` — corpus-only pack:

- `assets/content/salah-liturgy.json` (18 phrases)
- `src/core/salah-liturgy.ts` — schema, `normalizeLiturgyArabic`, pack load/verify helpers (**data only today**)
- `npm run liturgy:verify`

Do **not** stuff phrases into `quran.json`. Keep `salah-liturgy.ts` as pack/schema; put matcher logic in a **new** module (e.g. `src/core/salah-liturgy-matcher.ts`).

## Baseline / hard gate

- Mac: `npm run test:replay -- all` stays **14/14**
- Soft: nas may still lock 2:1 after 114:6 on pad — do not worsen
- Quran follower (`follower.ts`) remains source of truth for `surah:ayah`

## Event shape (suggested)

Separate from Quran `verse_match`, e.g.:

```ts
{ kind: 'salah_liturgy'; phraseId: string; category: string; atMs: number; confidence?: number }
```

English gloss comes from pack `english` / `english_kind: liturgy_gloss` — matcher does not invent text.

## Design constraints

- **Matching only** — no App UI / dual-pane polish (session `03-display`)
- Score against `arabic_recognition_normalized` (and/or token windows after the same normalize path)
- Short / shared tokens need strong evidence:
  - `takbeer` (`الله أكبر`) — repeat window / not mid-ayah Quran follow / avoid spam
  - `amin`, short `jami_bayn` variants — do not steal Fatiha/Ikhlas/Asr/Nas gates
- Basmala stays on **Quran** hold path (`basmala_liturgy` deferred in pack)
- Istiʿadha is liturgy row `istiadha` — must not false-commit a Quran ayah
- Offline; reuse existing Tilawa/transcript token stream — **do not invent** Tilawa APIs
- Keep interfaces honest: liturgy ≠ Quran translation

## Priority phrase coverage (unit tests)

Must lock correctly on synthetic tokens: `takbeer`, `thana`, `ruku_tasbih`, `sujood_tasbih`, `tashahhud` (can be multi-window), `darood_ibrahim` or combined darood id if present, `assalamu_alaikum_warahmatullah`.

Negative: Quran-like Fatiha/Ikhlas windows do **not** emit liturgy; liturgy windows do **not** emit Quran verse commits in the tested harness.

## Files (expected)

- New: `src/core/salah-liturgy-matcher.ts` (+ hook from `listening.ts` / recognition pipeline)
- Tests: `tests/salah-liturgy-matcher.test.ts` (synthetic sequences)
- Optional debug log only — no UI

## Out of scope

- Display / copy (`03-display`)
- Replay audio fixtures (`04-replay-suites`)
- Expanding deferred phrases (qunoot, etc.)
- Retuning Quran thresholds except to reject liturgy↔Quran confusion

## Success criteria

1. Unit tests green for locks + negatives above  
2. Mac `npm run test:replay -- all` = **14/14**  
3. `npm run liturgy:verify` still 18/18  
4. Document API + open risks (esp. takbeer false positives)

## Deliverable

PR description: event API, files, Mac 14/14 proof, residual risks.
