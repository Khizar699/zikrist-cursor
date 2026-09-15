# Inter typography, keep source Arabic

## Goal

Fix live Arabic by changing typeface, not by rewriting the verse. Show Tanzil Uthmani as stored. Use Inter for Latin and an Inter-like Arabic grotesque so the screen matches the sans reference.

## Scope

Inspected: `src/ui/{theme,fonts,SyncedVersePanes}.ts(x)`, `src/core/arabic-display.ts`, Inter 4.1 (no Arabic glyphs; rsms/inter#391 recommends a companion such as Tajawal / Noto).

In: remove `toPlainArabic`, load Inter + Tajawal, notices.

Out: changing Tanzil bytes, recognition, layout/scroll/hold behavior.

## Assumptions

- Inter cannot render Arabic; Tajawal Medium is the usual Inter-like Arabic companion (OFL).
- Tashkeel and Uthmani signs stay in the string. Missing glyphs may fall back rather than be stripped.
- English translation also uses Inter so the screen is one grotesque family.

## Files

`prompts/inter-typography.md`, `src/ui/{theme,fonts,SyncedVersePanes}.ts(x)`, `src/App.tsx`, `src/core/arabic-display.ts` (delete), `tests/arabic-display.test.ts` (delete), `assets/fonts/`, `assets/content/notices.json`, `THIRD_PARTY_NOTICES.md`, `README.md`.

## Acceptance

- Displayed Arabic equals `verse.arabic` / `verse.basmala` with no Unicode stripping.
- Arabic face is Tajawal; English is Inter.
- Typecheck, lint, tests. Simulator is not a shaping/device claim.
