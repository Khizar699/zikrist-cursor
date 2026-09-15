# Salah liturgy matcher (detect without breaking Quran 14/14)

## Goal

Wire an offline **liturgy detector** beside Quran acquire/follow: when heard audio matches a corpus phrase, emit a confirmed liturgy lock (id + confidence/timing). Must **not** turn liturgy into false Quran ayah commits.

## Depends on

Session `01-corpus` landed (phrase pack on disk).

## Baseline

- Quran Mac `test:replay -- all` = 14/14 @fffa1f6  
- Soft: nas may still lock 2:1 after 114:6 on pad — do not worsen  

## Design constraints

- One concern: **matching only** (no UI polish)  
- Prefer a **separate** liturgy scorer over stuffing phrases into `quran.json`  
- Quran follower remains source of truth for surah:ayah; liturgy locks are a different event type  
- Shared Basmala / الله أكبر / short tokens must not steal Fatiha/Ikhlas/Asr gates  
- Takbeer is very short — require evidence rules (repeat window / energy / not mid-ayah) so it doesn’t spam during Quran  
- Offline; same 16 kHz mic/ONNX transcription stream if possible, or phrase grammar on Tilawa tokens — investigate existing APIs; do not invent Tilawa features  
- Read AGENTS.md: “Quran-only matcher must not claim to translate arbitrary Arabic”; liturgy is explicit new scope — keep interfaces honest  

## Files (expected)

- `src/core/salah-liturgy.ts` (or similar) + hooks from `listening.ts`  
- Tests with synthetic token sequences for takbeer/thana/ruku  
- Do not retune Quran thresholds except to reject liturgy↔Quran confusion  

## Success criteria

1. Unit tests: liturgy phrases lock with correct ids; Quran-like windows do not emit liturgy falsely for tested cases  
2. Mac: `npm run test:replay -- all` still **14/14**  
3. Headless liturgy smoke (even fixture-less token tests) documents pass/fail  
4. No UI required beyond optional debug log  

## Deliverable

API shape for liturgy events; Mac 14/14 proof; open risks (short takbeer false positives).
