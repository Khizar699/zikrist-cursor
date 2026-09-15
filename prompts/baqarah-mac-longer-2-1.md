# Mac longer still skips 2:1

## Goal

Mac `npm run test:replay -- longer` first-locks **2:1**, then 2:2–5. Linux-only PASS is not enough. Do not regress Nas 114:6 seed-trim, Basmala-echo 55:1, or Asr `الا`→`الانسن`.

## Baseline

PR tip `8bd9c35` on Mac: `sequence_break_at_0_got_2:2_expected_2:1`. First confirm **2:2@11s** (never 2:1), then 2:3…2:12. Mac nas/fatiha/asr/kawthar/quraysh/ikhlas/falaq PASS; units 119/119. Linux longer 2:1@6s.

## Mac path (same PCM, different CTC)

`ACQUIRE_MAX_SEC` is 4 s. EveryAyah `002001` is ~7.6 s Basmala then `الم`. After the window slides past `بسم`:

- Linux CTC drops the Basmala tail and emits `الم المي` at the start of the window → `openingIsAtStart` true → 2:1@6s.
- Mac CTC keeps `الرحمن الرحيم` (and may spell the letters as `الميم` / `الف لام ميم`). `hasVerseEvidence` treats a one-word ayah-1 body that is not `recognized[0]` and not immediately after a leading `بسم` as “inside Basmala” (the 55:1 guard). 2:1 never commits. At ~11 s the window is 2:2-only → first confirm 2:2.

Do not insert 2:1 from coverage after a 2:2 lock (`cold-start-mid` must stay 2:2). Need acoustic body evidence: Basmala-**tail** + isolated `الم`, or letter-name spelling of that body. `المال` / `المصدر` stay rejected. `الرحمن` alone still must not name 55:1.

After a heard opening Basmala with no lock, acquire keeps ~8 s (not 4 s) so `الم` at the end of 002001 is still in the window at the Mac 2:2@11s timestamp. Nas/Ikhlas/Asr clips do not start with Basmala, so they stay at 4 s.

## Keep

Nas last-ayah seed-trim, exact-enough 7:1 (no `المصدر`), Basmala-echo, Asr leftover `relatedStem`, jump Kawthar→Ikhlas, back-to-back Asr→Quraysh leftover crumbs (`11759a9`, both Mac-green on main).

## Acceptance

Mac longer 2:1 first (Sim QA). Also Mac: nas, fatiha, asr, kawthar, quraysh GREEN. Jump and back-to-back are already Mac-green on `11759a9` — do not regress them. Linux-only ONNX is not the longer gate.
