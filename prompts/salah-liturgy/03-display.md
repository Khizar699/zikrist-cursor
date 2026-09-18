# Salah liturgy on-screen Arabic + English

> **Mushaf-first note:** Quran translation pane stays off. Liturgy may show pack Arabic on the listening screen; do not use this prompt to restore dual-pane Quran translation.

## Goal

When listening emits a `salah_liturgy` lock, show **Arabic + English** on the existing single listening screen without breaking Quran ayah passage display.

## Depends on (landed)

Main `924e175` — matcher + corpus:

- Event: `SalahLiturgyLockEvent` `{ kind: 'salah_liturgy'; phraseId; category; atMs; confidence? }`
- Pack row lookup by `phraseId` → `arabic_uthmani` + `english` (`english_kind: liturgy_gloss`)
- `src/services/listening.ts` already batches `{ quran, liturgy }` — wire UI to that

## Baseline / hard gate

- Mac: `npm run test:replay -- all` stays **14/14**
- Soft nas wsr may remain — do not worsen
- Do **not** retune matcher thresholds this session

## Design constraints

- **Display / UX wiring only** — no new phrases, no matcher algorithm work
- Algorithm > polish: readable AR+EN; light “Prayer” / liturgy label so it is **not** shown as a Quran ayah
- Preserve Quran dual-pane / passage follow for `verse_match`
- After liturgy UI, returning to Quran locks must still look correct
- Offline; gloss from pack only — do not invent English
- Copy must not claim full madhhab coverage or “imam-ready”
- Optional: show `category` chip (takbeer / thana / ruku…) — keep minimal

## Minimum demo coverage

UI responds for at least: `takbeer`, `thana`, `ruku_tasbih` (inject lock in test or Sim if no audio fixtures yet).

## Files (expected)

- `src/App.tsx` / `src/ui/*` (+ any listening callback types already exported)
- Avoid follower/matcher edits unless a tiny type export is required for UI

## Out of scope

- `04-replay-suites` audio fixtures  
- Real-imam packs  
- Expanding deferred liturgy ids  

## Success criteria

1. Liturgy lock → Arabic + English (gloss) visible and clearly not an ayah  
2. Quran passage UI still works after a liturgy event  
3. Mac `test:replay -- all` = **14/14**  
4. `liturgy:verify` still 18/18; matcher units still green  

## Deliverable

PR with files changed; short Sim QA / screenshot notes; residual UX risks.
