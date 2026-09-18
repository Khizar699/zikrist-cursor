# Arabic verse stage (mushaf-first display)

> **Current MVP.** Translation stays unpainted. Listening must not require a translation pack (`MUSHAF_ONLY_MVP`). Re-show translation later by flipping the pane flag **and** restoring pack activate — not before mushaf follow is confident.

## Goal

Listening chrome only. Keep loading the approved translation in the content layer. Do not paint it on the listening screen for now. Put the Arabic ayah in the band between the Debug HUD and the mic control. Keep word highlighting for the part the imam is reciting.

## Scope

1. `SyncedVersePanes` — Arabic-only stage (`SHOW_TRANSLATION_PANE = false`). Mushaf Arabic loads without a translation pack (`content.prepareMushaf`).
2. Stage inset under the overlay HUD so Quran text is not under the bug log.
3. Focused ayah uses the HUD-to-mic height (not a half-screen translation pane). Heard-word highlight stays on display words.
4. Liturgy / heard-words use the same Arabic stage (no English gloss painted).

## Checks

- Units: translation pane flag off; HUD inset + full-height Arabic padding still fit a long 1:7 ayah; highlight count unchanged.
- `npm test` + `npm run typecheck`. No matcher retune. No `ready` flip. No wav commits.

## Limits

Display/layout only for the original hide-pane pass. Translation packs must **not** be a listen gate. Re-show later by flipping the pane flag **after** mushaf follow is confident, not by skipping Arabic load.
