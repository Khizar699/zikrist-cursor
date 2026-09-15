# GitHub-only continuity remainder (CI + cheap start)

## Goal

On top of founder dictation already on `main` (`bcee7d9`): enforce HANDOFF bumps with CI, add a cheap bot read order, tip the live Release zip. Do **not** duplicate dictation / PR template / AGENTS §8.

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
