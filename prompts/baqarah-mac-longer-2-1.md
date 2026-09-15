# Mac longer still skips 2:1

## Goal

Mac `npm run test:replay -- longer` first-locks **2:1**, then 2:2–5. Linux-only PASS is not enough. Do not regress Nas 114:6 seed-trim, Basmala-echo 55:1, or Asr `الا`→`الانسن`.

## Baseline

PR tip `8bd9c35` on Mac: `sequence_break_at_0_got_2:2_expected_2:1`. Mac nas/fatiha/asr/kawthar/quraysh/ikhlas/falaq PASS; units 119/119. Linux longer 2:1@6s.

## Likely causes (Mac ONNX decode ≠ Linux)

1. `lockFromTranscript` requires `compact(text).length >= 6`. Isolated `الم` is 3 letters; a 4 s window that has already dropped Basmala never locates.
2. Mysterious-letter `canLock` requires exact compact `الم`, so ASR `المي` (Linux also emits this as a second word) fails when `الم` is absent.
3. Close 3:1 rival + `match.score < 0.72` rejects ayah-1 (`verse.ayah > 1 && beatsRival`). `preferCanonicalDuplicate` runs after that.

## Keep

Nas last-ayah seed-trim, exact-enough 7:1 (no `المصدر`), Basmala-echo, Asr leftover `relatedStem`.

## Acceptance

Mac longer 2:1 first (Sim QA). Linux longer + nas/fatiha/asr/kawthar/quraysh/ikhlas/falaq + npm test still green.
