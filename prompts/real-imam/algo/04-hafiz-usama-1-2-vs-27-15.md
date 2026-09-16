# Hafiz Usama: Fatiha→An-Naml 27:15 (not stuck/wrong at 1:2)

## Goal

On **Mac**, headless replay of the Hafiz Usama multi-qari clip must acquire Fatiha then **hand off into An-Naml 27:15**, not stay stuck / wrongly crowned at **1:2** as the body destination.

| | |
|---|---|
| **Clip** | `artifacts/recitation/imam/imam-multi-qari/qari-a/imam-multi-qari__hafiz-usama__001-027-015__raw.wav` |
| **Want** | Fatiha **1:1–7** then body **27:15** (labels: first segment Fatiha + An-Naml 27:15–20; `expected_first_lock` in labels may list **1:2** for Fatiha — success is **handoff to 27:15**, not remaining at 1:2) |
| **Measured false** | Stuck/wrong at **1:2** vs want **27:15** (Bot; Mac re-measure in this session — pack author did not re-run replay) |
| **Ground truth** | `prompts/real-imam/LABELS.md` + `labels.json` → `hafiz-usama-zehri` / `imam-multi-qari` candidate |

Do **not** trust `probes/hypothesized-locks.txt`.

## Last session proved / failed

- **#17** mid-surah cleared; label-fill 01/02 context as in `00-QUEUE.md`.
- Algo **01–03** ahead — this session **only** Fatiha→body-surah handoff for Hafiz Usama.
- Prefer handoff evidence (Fatiha complete → unique Naml tokens) over multi-qari mega-refactor.

## HANDOFF.md (required every PR)

Update root `HANDOFF.md` in the same PR (`prompts/_SHARED-HANDOFF.md`).

## Constraints

- **One concern:** Fatiha→An-Naml **27:15** handoff; do not leave the follower stuck on **1:2** when body recitation is Naml.
- Offline ONNX; no suite-ID hardcodes; no liturgy retune; no label-fill; no `ready` flip; leave other clips alone.
- Keep Mac `npm run test:replay -- all` = **14/14**.
- Prefer acquire/handoff evidence over mega-refactor.

## Area to touch

- `src/core/follower.ts` (+ gate helpers if needed)
- Unit tests without mosque WAV if expressible (Fatiha→non-Fatiha body handoff / **1:2** must not block **27:15**)
- Mac verify:

```bash
npx tsx scripts/replay.ts \
  artifacts/recitation/imam/imam-multi-qari/qari-a/imam-multi-qari__hafiz-usama__001-027-015__raw.wav
npm run test:replay -- all
npm test && npm run typecheck
```

## Out of scope

- Manifest `ready`; UI; other algo clips; wav commits; later raka segments (27:21+) unless needed to prove first handoff

## Success criteria

1. Mac: after Fatiha, lock/follow **27:15** — **never** remain stuck/wrong at **1:2** as the body ayah.
2. `all` **14/14**; tests/typecheck pass.
3. Honest residual on later ayahs/rakas.
4. Queue complete after this session (or note next open track).

## Deliverable

PR + HANDOFF tip + replay JSON snippets.
