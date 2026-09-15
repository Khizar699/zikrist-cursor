# Longer suite: first-lock Baqarah 2:1 (الم), not 2:2

## Goal

`npm run test:replay -- longer` on **Apple Silicon Mac** must first-lock **2:1**, then 2:2–5.

## Baseline

- Sim QA / Mac @11759a9 and PR #4 tips (incl. c0b3b1d): `sequence_break_at_0_got_2:2_expected_2:1` — first lock **2:2@~11s** score ~0.91
- Linux-only greens on #4 were false for Mac — do not merge without Mac PASS
- Keep greens: fatiha, nas 114:1–6, asr, kawthar, quraysh, ikhlas, falaq, jump, back-to-back, english-negative, basmala-hold, cold-start-mid, stall-after-lock

## Corpus fact (do not invent)

In `assets/model/quran.json`, **2:1** text_clean is `بسم الله الرحمن الرحيم الم` (opening Basmala + muqatta'at **الم**). **2:2** starts `ذلك الكتب…`. So 2:1 is not a normal verse body — it is Basmala-held until unique **الم**, then that token must be allowed to name 2:1 without waiting for 2:2.

## Hypothesis (verify; discard if wrong)

Acquire / ContinuationGate / mysterious-letter rules that correctly block Basmala-echo 55:1 and bare `001001` may also be **suppressing الم** as a first lock, so the first confirmable unique stretch becomes 2:2. Prefer unlocking **exact muqatta'at** for ayah-1 after Basmala over loosening general fuzzy stems (a prior stem loosen broke Asr `الا`→`الانسن`).

## Constraints

- One concern: **Baqarah 2:1 first lock on Mac**
- Offline; real ONNX + RecitationFollower
- No surah-ID-only hacks if a general “muqatta'at after opening Basmala” rule works
- Do not regress Nas 114:6 or Asr 103:1–3
- Read follower.ts, continuation-gate.ts, basmala.ts, replay-longer.json, PR #4 diff

## Success criteria (Mac)

1. `npm run test:replay -- longer` → first lock **2:1**, then 2:2–5 (`failureMode` null for the 2:1–5 gate)
2. `npm run test:replay -- basmala-hold` still PASS (001001 alone locks nothing)
3. fatiha, nas, asr, kawthar, quraysh, jump, back-to-back still PASS
4. `npm test` / typecheck / lint pass

## Deliverable

Mac commands + JSON paths + files changed. No Linux-only claim.
