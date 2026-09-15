# Unlock exact muqatta'at after opening Basmala (Mac longer 2:1)

## Goal

Mac `npm run test:replay -- longer` first-locks **2:1** (`الم`), then 2:2–5. Do not loosen general fuzzy stems. Do not merge without Mac PASS.

## Inspected

`prompts/longer-ayah1-miss-2-1.md` on main `810ed4c`. `quran.json` 2:1 `text_clean` is `بسم الله الرحمن الرحيم الم`; 2:2 starts `ذلك الكتب`. Tip `c0b3b1d` still first-locked **2:2@11s ~0.91** on Mac: 8s hold only after detected Basmala tokens, and `lockFromTranscript` returned nothing when ONNX locate had no champion even if CTC had `الم`.

## Change

1. Initial `acquiring` keeps 8 s so `الم` PCM is still in the window at the Mac 2:2@11s timestamp. `reacquiring` stays 4 s (jump / back-to-back).
2. Exact one-word ayah-1 muqatta'at (`الم`, `المي`, letter names) can first-lock without an engine champion and without waiting for ayah 2. Basmala-echo 55:1 and `المصدر` stay rejected.
3. Remember heard muqatta'at tokens across acquire hops so a later 2:2-dominated CTC decode cannot erase prior `الم`.
4. If the long acquire window's champion is already ayah 2+, transcribe the older slice (drop the newest 3 s) and lock ayah-1 from exact muqatta'at there before committing 2:2.
5. `ZIKRIST_TRACE=1` logs ASR text + champion + window seconds so Mac first seconds can be dumped.

## Keep

Nas 114:6 seed-trim, Asr `الا`→`الانسن`, Basmala-hold `001001`, cold-start-mid 2:2, jump, back-to-back leftover crumbs. No surah-2-only branch.

## Acceptance

Units cover no-champion `الم`, sticky `الم` then 2:2-only, lookback older slice, 8 s initial acquire, 4 s reacquire. Mac longer is the remaining merge gate.
