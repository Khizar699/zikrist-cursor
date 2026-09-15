# Salah liturgy on-screen Arabic + English

## Goal

When a liturgy phrase locks, show **Arabic + English** on the existing single listening screen without breaking ayah passage display.

## Depends on

`01-corpus` + `02-matcher` landed.

## Constraints

- One concern: **display / UX wiring** only  
- Algorithm > polish: clear readable AR+EN, not redesign  
- Distinguish liturgy from Quran ayah (label or pane state) so users aren’t told a prayer phrase is an ayah  
- Offline; uses corpus English gloss  
- Preserve Quran dual-pane behavior for verse_match  
- Mac: Quran `test:replay -- all` still 14/14  

## Files

- `src/App.tsx` / `src/ui/*` + listening service event plumbing  
- Copy must not claim unimplemented madhhab coverage  

## Success criteria

1. Manual or fixture-driven lock shows Arabic + English for at least takbeer + thana + ruku  
2. Quran passage UI still works after liturgy event  
3. 14/14 Quran replay still green  

## Deliverable

Screenshots or Sim QA notes; files changed.
