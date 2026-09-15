# Shared: write continuity docs on every session PR

**Founder dictation for successor bots.** Agents must **write** continuity docs in the **same PR** as the code/prompt change — not leave a chat-only handoff. Prompt Smith and cloud agents: hard process rule.

## Always (every PR to main)

Update root **`HANDOFF.md` tip** in the same PR:

1. **What landed** this session (honest; do not claim Mac-green or `ready` without evidence)
2. **Tip state** (branch / PR; what friends and new bots should assume)
3. **Open tracks** (next prompt / hold / blocked)
4. **Gates** — `npm run test:replay -- all` stays **14/14** Quran; note Linux is not that gate
5. **Fixture restore** — `npm run fixtures:recitation` and `npm run fixtures:imam` (tag `imam-fixtures-v1` / `zikrist-imam-fixtures-v1.zip`); liturgy `npm run liturgy:tts -- <id> --engine say` with ffmpeg on `PATH`
6. **Known fails** — at least Subayyal 4:129≠41:34 and Qiyam 36:16≠78:4 until those are Mac-green; never invent ayah labels

A PR without a `HANDOFF.md` tip bump is **not mergeable**. CI: `.github/workflows/handoff-required.yml` fails PRs to `main` that omit `HANDOFF.md` from the diff.

Bots: Tip → `AGENTS.md` → the one prompt Tip names (HANDOFF **Bot start protocol**). Do not load every `prompts/**` file up front.

## When applicable

| Doc | When to update in the same PR |
|---|---|
| **`VALIDATION.md`** | Verify / gate / Mac replay results change (new pass/fail, suite ready, algorithm claim) |
| **Queue status** | Overnight or fill queue moves (e.g. `prompts/salah-liturgy/tts-fill/00-QUEUE.md`, `prompts/real-imam/label-fill/00-QUEUE.md`, pack `00-OVERNIGHT-QUEUE.md`) — mark done / held / next |

## Forbidden

- Merging to `main` without a `HANDOFF.md` tip diff
- Chat-only continuity (“Bot knows”) with no file write
- Flipping real-imam suites to `ready` until `prompts/imam-mid-surah-cold-false-lock.md` is Mac-green
- Committing wav/mp3

See **Maintainer rule**, **Dictation for successor bots**, and **Bot start protocol** in `HANDOFF.md`. Use the PR template checklist.
