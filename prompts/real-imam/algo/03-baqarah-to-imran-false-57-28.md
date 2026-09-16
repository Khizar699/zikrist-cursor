# Baqarah→Imran: refuse 57:28 false champion (want 2:284)

## Goal

On **Mac**, headless replay of the baqarah-to-imran surah-switch clip must first-lock **2:284**, not distant **57:28**.

| | |
|---|---|
| **Clip** | `artifacts/recitation/imam/imam-surah-switch/qari-a/imam-surah-switch__baqarah-to-imran__002-284-003-009__raw.wav` |
| **Want first lock** | **2:284** (labels: 2:284–286 then via Fatiha raka → Ali Imran 3:1–9) |
| **Measured false lock** | **57:28** (Bot; Mac re-measure in this session — pack author did not re-run replay) |
| **Ground truth** | `prompts/real-imam/LABELS.md` + `labels.json` → Taraweh / `imam-surah-switch` candidate |

Do **not** trust `probes/hypothesized-locks.txt`.

## Last session proved / failed

- **#17** cleared mid-surah cold; label-fill 01/02 context as in queue.
- Algo **01–02** ahead in queue — this session **only** refuses **57:28** on this clip.
- Full raka handoff into 3:1 is desirable follow; do not mega-scope multi-raka liturgy.

## HANDOFF.md (required every PR)

Update root `HANDOFF.md` in the same PR (`prompts/_SHARED-HANDOFF.md`).

## Constraints

- **One concern:** refuse distant wrong-surah champion **57:28** on thin acquire window when truth is Baqarah **2:284**.
- Offline ONNX; no suite-ID hardcodes; no liturgy retune; no label-fill; no `ready` flip; leave other clips alone.
- Keep Mac `npm run test:replay -- all` = **14/14**.
- Prefer unique-token / refuse-distant-champion acquire evidence over mega-refactor.

## Area to touch

- `src/core/follower.ts` (+ gate helpers if needed)
- Unit tests without mosque WAV if expressible (**2:284 ≠ 57:28**)
- Mac verify:

```bash
npx tsx scripts/replay.ts \
  artifacts/recitation/imam/imam-surah-switch/qari-a/imam-surah-switch__baqarah-to-imran__002-284-003-009__raw.wav
npm run test:replay -- all
npm test && npm run typecheck
```

## Out of scope

- Manifest `ready`; UI; other algo clips; wav commits; full Ali-Imran follow polish unless needed for first-lock honesty

## Success criteria

1. Mac first lock **2:284**, **never 57:28**.
2. Short follow 2:285–286 if present; note residual on later Fatiha→3:1 honestly.
3. `all` **14/14**; tests/typecheck pass.
4. Next launch: queue **04** (hafiz-usama).

## Deliverable

PR + HANDOFF tip + replay JSON snippets.
