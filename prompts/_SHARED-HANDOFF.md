# Shared: write continuity docs on every session PR

**Founder dictation for successor bots.** **Write, do not only read.** Continuity docs go in the **same PR** as the code/prompt work. **Your session is incomplete without a `HANDOFF.md` tip bump.** CI already requires `HANDOFF.md` in the PR diff.

## Always (every PR to main)

Update root **`HANDOFF.md` tip** in the same PR:

1. **What landed** this session (honest; do not claim Mac-green or `ready` without evidence)
2. **Tip state** (branch / PR; what friends and new bots should assume)
3. **Open tracks** (next prompt / hold / blocked)
4. **Gates** — regression floor: `npm run test:replay -- all` stays **14/14** Quran; note Linux is not that gate. For algo/follower Tip work, also record the **product bar** outcome (`prompts/real-imam/algo/PRODUCT-BAR.md`): Tip clip lock + ordered advance (or honest fail). **14/14 alone is not session-done.**
5. **Fixture restore** — `npm run fixtures:recitation` and `npm run fixtures:imam` (tag `imam-fixtures-v1` / `zikrist-imam-fixtures-v1.zip`); liturgy `npm run liturgy:tts -- <id> --engine say` with ffmpeg on `PATH`
6. **Known fails** — mid-surah cold false-lock **cleared on Mac via #17**; still blocked: `imam-mid-ayah-pause` (no pause mark), Qunut@s9P 4:56 (dua). Never invent ayah labels

Follow this file **exactly**. A PR without a `HANDOFF.md` tip bump is **not mergeable**. CI: `.github/workflows/handoff-required.yml` fails PRs to `main` that omit `HANDOFF.md` from the diff.

Bots: Tip → `AGENTS.md` → the one prompt Tip names (HANDOFF **Bot start protocol**). For recognition algo work, also obey `prompts/real-imam/algo/PRODUCT-BAR.md` + `RATCHET.md` and always-on `.cursor/rules/zikrist-recognition-ratchet.mdc`. Do not load every `prompts/**` file up front.

**Do not claim done** for a follow/handoff Tip if only acquire/locate improved or only the regression floor stayed green.

**Local Mac Agent:** after recognition/follower/Tilawa-patch edits, run the Agent verify loop in `prompts/real-imam/algo/PRODUCT-BAR.md` yourself and write findings into the tip. Do not ask the founder to replace that with iOS vibe-testing.

**Ratchet:** `prompts/real-imam/algo/RATCHET.md` — fix → measure → lock (unit/`ready` expect) same PR; tip known-fails only shrink when locked.

## When applicable

| Doc | When to update in the same PR |
|---|---|
| **`VALIDATION.md`** | Mac/Linux verify paths change, or a new Mac-green result is recorded |
| **Queue status** | Overnight or fill queue moves (e.g. `prompts/salah-liturgy/tts-fill/00-QUEUE.md`, `prompts/real-imam/label-fill/00-QUEUE.md`, pack `00-OVERNIGHT-QUEUE.md`) — mark done / held / next |
| **`zikrist_pipeline_export.txt`** | Any change under `src/core/` or `src/services/` — run `npm run pipeline:export` in the same change set |

## Forbidden

- Merging to `main` without a `HANDOFF.md` tip diff
- Chat-only continuity (“Bot knows”) with no file write
- Flipping extra real-imam suites to `ready` outside the matching label-fill session (one suite per session; false-lock already Mac-green via #17)
- Committing wav/mp3

See **Maintainer rule**, **Dictation for successor bots**, and **Bot start protocol** in `HANDOFF.md`. Use the PR template checklist.
