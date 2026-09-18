# Live passage chrome (P1 — after mushaf P0)

## Goal

After mushaf lock/follow P0s, fix the **non-follow** Arabic chrome from the 2026-09-18 iPhone 17 Simulator recording. Do not retune the matcher in this session. **Do not paint Quran translation** (`SHOW_TRANSLATION_PANE` stays false).

## Recording issues this prompt owns

1. Previous-ayah **fragments under the Dynamic Island** (`نستعين`, clipped Basmala `الرحيم`, `الذي يوسوس في`). `SyncedVersePanes` `scrollToIndex` `viewPosition: 0.5` plus large Arabic leaves the prior row in the top inset.
2. **Waveform / footer covers** the next Arabic ayah (Fatiha 1:7 peek).
3. Top-right **circular control overlaps** Basmala/Arabic. Not in current `src/App.tsx` — hide Expo/dev inspector on the listening surface, or pad if it is product settings.
4. Dim lookahead Arabic can look **garbled** (opacity 0.34 + 40 pt wrap). Neighbors must stay readable as context.
5. Optional P2 in the same PR only if tiny: live line should not lead with Tanzil `[1][2][3]` markers (keep footnotes in content); optional surah:ayah for diagnostics.

## Constraints

- Display/layout only. No follower threshold retune. No `ready` flip. No wav/mov commits.
- Keep Mac `test:replay -- all` honest N/14. Ratchet: a unit or UI contract for inset/clipping, not a weaker expect.
- Obey `PRODUCT-BAR.md` + `RATCHET.md` + bump `HANDOFF.md`.

## Success

Island remnants gone; focused and next **Arabic** sit above the listen control; Quran text is not under a gear; dim neighbors remain shaped Arabic. Simulator re-check of the same Fatiha/Ikhlas/Nas flow. Not a physical-device claim.

Related: `prompts/arabic-verse-stage.md` and `MUSHAF_ONLY_MVP` keep the translation pane off. This prompt owns island clipping, gear overlap, and dim-neighbor shaping.
