# Live passage chrome (P1 — after short-surah tail)

## Goal

After `prompts/live-short-surah-tail.md` lands, fix the **non-follow** chrome from the 2026-09-18 iPhone 17 Simulator recording. Do not retune the matcher in this session.

## Recording issues this prompt owns

1. Previous-ayah **fragments under the Dynamic Island** (`نستعين`, clipped Basmala `الرحيم`, `الذي يوسوس في`). `SyncedVersePanes` `scrollToIndex` `viewPosition: 0.5` plus large Arabic leaves the prior row in the top inset.
2. **Waveform / footer covers** the next translation (Fatiha 1:7 peek).
3. Top-right **circular control overlaps** Basmala/Arabic. Not in current `src/App.tsx` — hide Expo/dev inspector on the listening surface, or pad if it is product settings.
4. Dim lookahead Arabic can look **garbled** (opacity 0.34 + 40 pt wrap). Neighbors must stay readable as context.
5. Optional P2 in the same PR only if tiny: live line should not lead with Tanzil `[1][2][3]` markers (keep footnotes in content); optional surah:ayah for diagnostics.

## Constraints

- Display/layout only. No follower threshold retune. No `ready` flip. No wav/mov commits.
- Keep Mac `test:replay -- all` honest N/14. Ratchet: a unit or UI contract for inset/clipping, not a weaker expect.
- Obey `PRODUCT-BAR.md` + `RATCHET.md` + bump `HANDOFF.md`.

## Success

Island remnants gone; focused and next translations sit above the listen control; Quran text is not under a gear; dim neighbors remain shaped Arabic. Simulator re-check of the same Fatiha/Ikhlas/Nas flow. Not a physical-device claim.

Related: `prompts/arabic-verse-stage.md` already hides the painted translation pane and stages Arabic under the HUD. This prompt still owns island clipping, gear overlap, and dim-neighbor shaping.
