# Suite: multi-qari placeholder (real-imam)

## Goal

Harness can score the **same** expected sequence on **different** `qari-or-source` folders. Suite `imam-multi-qari` uses `clipRunMode: each-clip` so qari-a and qari-b are **not** concatenated.

Placeholder expect: **112:1–4** for both slots.

```
fixtures/real-imam/clips/qari-a/imam-multi-qari__pending__112-1-4.wav
fixtures/real-imam/clips/qari-b/imam-multi-qari__pending__112-1-4.wav
```

Until **both** WAVs exist, the suite is `missing_fixture` (drop one reciter by temporarily removing the other path from the suite JSON if you want a single-qari run).

No follower change required — this proves clip selection via manifest.

## Success

Two stub qari slots with identical `expect`; import path documented; 14/14 gate. After clips: each file writes its own replay JSON label `imam-multi-qari:<clip-stem>`.
