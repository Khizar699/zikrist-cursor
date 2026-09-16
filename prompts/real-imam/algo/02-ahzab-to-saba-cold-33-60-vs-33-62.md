# Ahzab→Saba cold acquire: 33:62 not 33:60

## Goal

On **Mac**, headless replay of the ahzab-to-saba surah-switch clip must first-lock **33:62** (cold acquire into the labeled window), not the near-miss **33:60**.

| | |
|---|---|
| **Clip** | `artifacts/recitation/imam/imam-surah-switch/qari-a/imam-surah-switch__ahzab-to-saba__033-062-034-003__raw.wav` |
| **Want first lock** | **33:62** (labels: 33:62–73 then Saba 34:1–3) |
| **Measured false lock** | **33:60** (Bot; Mac re-measure in this session — pack author did not re-run replay) |
| **Ground truth** | `prompts/real-imam/LABELS.md` + `labels.json` → `viK00ELO5nc` / `imam-surah-switch` candidate |

Do **not** trust `probes/hypothesized-locks.txt`.

## Last session proved / failed

- **#17** mid-surah cold cleared; label-fill **01** on main; **02** done or in flight when launched.
- Prior algo **01** (masjid 25:69≠2:1) should be green or explicitly residual before/while this runs — still **one concern** here: **33:60 vs 33:62** cold acquire on surah-switch audio.
- Switch-to Saba **34:1** is **follow-on**; do not expand scope into a mega surah-switch rewrite unless required to keep first-lock correct.

## HANDOFF.md (required every PR)

Founder rule: update root `HANDOFF.md` **in the same PR** — what landed, open tracks, gates, restore cmds. Incomplete without tip bump.

## Constraints

**HANDOFF:** bump `HANDOFF.md` (`prompts/_SHARED-HANDOFF.md`).

- **One concern:** surah-switch **cold acquire** — refuse **33:60** champion when evidence supports **33:62** (near-ayah confusion in same surah).
- Offline ONNX; no suite-ID hardcodes; no liturgy retune; no label-fill; no `ready` flip; no other three clips.
- Keep Mac `npm run test:replay -- all` = **14/14**.
- Prefer acquire evidence (unique tokens, refuse thin-window near-misses) over mega-refactor.

## Area to touch

- `src/core/follower.ts` (+ gate helpers if needed)
- Unit tests without mosque WAV if expressible (**33:62 ≠ 33:60**)
- Mac verify:

```bash
npx tsx scripts/replay.ts \
  artifacts/recitation/imam/imam-surah-switch/qari-a/imam-surah-switch__ahzab-to-saba__033-062-034-003__raw.wav
npm run test:replay -- all
npm test && npm run typecheck
```

## Out of scope

- Manifest `ready`; UI; other algo clips; committing wav/mp3; full 34:* polish beyond what first-lock needs

## Success criteria

1. Mac first lock **33:62**, **never 33:60**.
2. Honest note on early follow toward 33:63+ / later 34:1 — do not claim full switch Mac-green unless measured.
3. `all` **14/14**; tests/typecheck pass.
4. Next launch: queue **03** (baqarah→imran).

## Deliverable

PR + HANDOFF tip + replay JSON snippets.
