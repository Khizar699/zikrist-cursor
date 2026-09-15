# Hold shared Basmala until the verse is unique

## Goal

Reciting Al-Ikhlas must not display Al-Fatihah 1:1 (the shared Basmala). Do not claim a first ayah until words unique to that ayah are heard. Tanzil display text prepends the opening Basmala to ayah 1 of most surahs; present that as a header, not as the ayah itself. Do not rewrite `quran-uthmani.txt`.

## Cause

Bismillah is 1:1 and also the unnumbered opening of Ikhlas. The live first-match path committed 1:1 after ~1 s of that shared phrase. Display of 112:1 also starts with the same Arabic, so even a later Ikhlas lock looks like “showing Bismillah.”

## Files

`src/core/basmala.ts`, `src/core/continuation-gate.ts`, `src/core/types.ts`, `src/services/content.ts`, `src/services/listening.ts`, `src/App.tsx`, `src/ui/theme.ts`, `tests/continuation-gate.test.ts`, `tests/basmala.test.ts`, `VALIDATION.md`.

## Acceptance

- Voiced 1:1 is not displayed until 1:2 arrives.
- 112:1 is not displayed until word progress includes an index after the four Basmala words.
- Unique non-opening verses still display immediately.
- A pending 1:1 is replaced by Ikhlas once unique opening evidence exists.
- UI shows the opening Basmala separately from ayah text. Source JSON/txt stay byte-identical.
- Typecheck, lint, tests. Simulator is not a physical-device accuracy claim.
