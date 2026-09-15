# Salah liturgy replay suites (Sim QA)

## Goal

Add headless fixtures + `npm run test:replay` (or `test:replay-liturgy`) suites so Sim QA can overnight-score liturgy without founder mic / before real-imam packs.

## Depends on

Corpus + matcher (+ display optional).

## Suites (minimum)

1. `liturgy-takbeer` — lock takbeer; no Quran ayah  
2. `liturgy-thana` — full thana  
3. `liturgy-ruku` / `liturgy-sujood`  
4. `liturgy-tashahhud` (may be long — allow partial milestones)  
5. `liturgy-then-fatiha` — takbeer/thana then Al-Fatihah still 1:2–7 (regression)  
6. `fatiha-then-takbeer` — after 1:7, takbeer does not become a wrong ayah  
7. Negative: English conversation still no Quran + no liturgy (or liturgy none)

Audio: TTS or recited fixtures under `artifacts/recitation/liturgy/` — document source/license; gitignore large audio like Quran fixtures.

## Constraints

- One concern: **fixtures + harness gates**  
- Do not retune Quran algorithm except fixture expectations  
- Mac verification for any claim  
- Keep 14/14 Quran all-suites  

## Success criteria

1. Named liturgy suites write JSON with phrase id, audioSeconds, failureMode  
2. Sim QA can run overnight without live mic  
3. Document commands in README/VALIDATION  

## Deliverable

Suite list, commands, sample JSON, which phrases still lack audio.
