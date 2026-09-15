# GitHub-only continuity remainder (CI + cheap start)

## Goal

Local Cursor: `.cursor/rules/zikrist-continuity.mdc` (`alwaysApply`) so a cloned folder in Agent/Composer uses the same read order without a pasted prompt.

## Scope

`.github/workflows/handoff-required.yml`; HANDOFF Bot start protocol + Tip; README “Continuing from GitHub” one-liner. No matcher retunes, no `ready` flips, no audio.

## Acceptance

1. PRs to `main` without `HANDOFF.md` in the diff fail CI.
2. Protocol: Tip → `AGENTS.md` → one named prompt; restore `fixtures:recitation` + `fixtures:imam` if missing.
3. Tip: zip **uploaded**; dictation already on main; this PR is the CI gate.

## Checks

`npm run typecheck`, `npm run lint`, `npm test`. HEAD Release asset (302). No wav/mp3.

## Manual device tests

None.
