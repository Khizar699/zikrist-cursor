# Masjid-e-Nabi cold/bleed: refuse 2:1 false champion (want 25:69)

## Goal

On **Mac**, headless replay of the founder-labeled Masjid-e-Nabi Al-Furqan clip must first-lock **25:69**, not Baqarah **2:1**.

| | |
|---|---|
| **Clip (prefer)** | `artifacts/recitation/imam/imam-noise-bleed/qari-a/imam-noise-bleed__masjid-e-nabi__025-069-077__raw.wav` |
| **Twin (also exists)** | `artifacts/recitation/imam/imam-mid-surah-cold/qari-a/imam-mid-surah-cold__masjid-e-nabi__025-069-077__raw.wav` — prefer **noise-bleed** named path; if both present, note which you measured |
| **Want first lock** | **25:69** (then 25:69–77 per labels) |
| **Measured false lock** | **2:1** (Bot; Mac re-measure in this session — Prompt Smith pack did not re-run replay) |
| **Ground truth** | `prompts/real-imam/LABELS.md` + `labels.json` → source `azad-kashmir-masjid-e-nabi` / suite candidates under `imam-noise-bleed` + `imam-mid-surah-cold` |

Do **not** trust `probes/hypothesized-locks.txt`.

## Last session proved / failed

- **#17** mid-surah cold false-lock **cleared** on Mac (Subayyal 4:129, Qiyam 36:16); `all` **14/14**.
- Label-fill **01** on main (`6df8ef3` / PR #18 area): `imam-mid-surah-cold` ready for Subayyal — **do not touch**.
- Label-fill **02** (Qiyam sibling) in flight or merged when this launches — **do not retune labels/manifest ready**.
- This session is **algo only** for the remaining founder-clip false lock **25:69 ≠ 2:1**.

## HANDOFF.md (required every PR)

Founder rule: update root `HANDOFF.md` **in the same PR** — what landed, open tracks, gates, restore cmds. A session PR without a HANDOFF bump is **incomplete**.

## Constraints

**HANDOFF:** bump `HANDOFF.md` in the same PR (`prompts/_SHARED-HANDOFF.md`).

- **One concern:** cold/bleed acquire false first-lock **2:1** on this Masjid-e-Nabi clip (refuse distant/wrong-surah champion on thin window; prefer distinctive Furqan body tokens).
- Offline; real ONNX + existing `RecitationFollower` / gate helpers. **No** fake matches, **no** silent WAVs, **no** suite-ID hardcodes (`if suite === imam-…`).
- **Do not** flip manifest `ready`. **Do not** label-fill. **Do not** retune liturgy. **Do not** work the other three algo clips.
- Keep Mac `npm run test:replay -- all` = **14/14**.
- Prefer acquire evidence (unique tokens, refuse distant champions on thin windows) over mega-refactor / model weight edits.

## Area to touch

- `src/core/follower.ts` (+ gate helpers if first-lock evidence lives there)
- Unit tests if expressible without mosque WAV in CI (e.g. **25:69 ≠ 2:1** token/prefix confusion)
- Mac verify:

```bash
npx tsx scripts/replay.ts \
  artifacts/recitation/imam/imam-noise-bleed/qari-a/imam-noise-bleed__masjid-e-nabi__025-069-077__raw.wav
npm run test:replay -- all
npm test && npm run typecheck
```

## Out of scope

- Flipping `ready`; label-fill 01/02; other three founder algo clips; UI / Sim polish; liturgy; committing wav/mp3

## Success criteria

1. Mac custom replay: first lock **25:69**, **never 2:1**; short follow into 25:70+ if the clip supports it.
2. Mac `npm run test:replay -- all` still **14/14**.
3. `npm test` / typecheck pass.
4. Honest residual fails noted; next launch is queue **02** (ahzab cold).

## Deliverable

PR + HANDOFF tip + JSON snippets from custom replay (paths under `artifacts/qa-runs/` if written).
