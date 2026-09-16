# Hafiz Usama: Fatiha→An-Naml 27:15 (not stuck/wrong at 1:2)

## Goal

On **Mac**, headless replay of the Hafiz Usama multi-qari clip must acquire Fatiha then **hand off into An-Naml 27:15**, not stay stuck / wrongly crowned at **1:2** as the body destination.

This is the algo pack **P0** (`00-QUEUE.md`). Concern class: **follow / handoff** (Zikrist follower + gate), not acquire-only. Obey `PRODUCT-BAR.md`.

| | |
|---|---|
| **Clip** | `artifacts/recitation/imam/imam-multi-qari/qari-a/imam-multi-qari__hafiz-usama__001-027-015__raw.wav` |
| **Want** | Fatiha **1:1–7** then body **27:15** (labels: first segment Fatiha + An-Naml 27:15–20; `expected_first_lock` in labels may list **1:2** for Fatiha — success is **handoff to 27:15**, not remaining at 1:2) |
| **Measured false** | Stuck/wrong at **1:2** vs want **27:15** (Bot; Mac re-measure in this session — pack author did not re-run replay) |
| **Ground truth** | `prompts/real-imam/LABELS.md` + `labels.json` → `hafiz-usama-zehri` / `imam-multi-qari` candidate |
| **Clip class** | `fatiha-to-body` |

Do **not** trust `probes/hypothesized-locks.txt`.

## Last session proved / failed

- **#17** mid-surah cleared; label-fill 01/02 context as in `00-QUEUE.md`.
- False-first-lock prompts **01–03** are **deferred** — this session is **only** Fatiha→body-surah handoff for Hafiz Usama.
- Prefer handoff / follow evidence (Fatiha complete → unique Naml tokens) over multi-qari mega-refactor or acquire-only patches.

## HANDOFF.md (required every PR)

Update root `HANDOFF.md` in the same PR (`prompts/_SHARED-HANDOFF.md`). Record product-bar fields from `PRODUCT-BAR.md`.

## Constraints

- **One concern:** Fatiha→An-Naml **27:15** handoff; do not leave the follower stuck on **1:2** when body recitation is Naml.
- Offline ONNX; no suite-ID hardcodes; no liturgy retune; no label-fill; no `ready` flip; leave other clips alone.
- Keep Mac `npm run test:replay -- all` = **14/14** (floor). **Also** product bar: ordered commits through handoff, not phase=`following` alone.
- Prefer follow/handoff evidence in `src/core/follower.ts` (+ gate if needed) over mega-refactor. Do not “fix” by only tightening acquire.

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
- Masjid / ahzab / baqarah→imran false-lock prompts (deferred P2)

## Success criteria

1. Mac: after Fatiha, lock/follow **27:15** — **never** remain stuck/wrong at **1:2** as the body ayah, and **never** hand off to **2:1** when body is Naml. Report committed match sequence + stall if any.
2. `all` **14/14** (restore floor first if still red); tests/typecheck pass.
3. **Ratchet lock same PR** (`RATCHET.md`): unit expressing Fatiha→non-Fatiha body handoff / refuse wrong **2:1** after Fatiha when Naml evidence exists; start label-fill path for multi-qari when Mac-green (do not flip `ready` in this algo session).
4. Honest residual on later ayahs/rakas.
5. Queue: mark 04 done; next open track = deferred P2 `01-masjid-e-nabi-…` (or Tip-named advance-under-overlap if added).

## Deliverable

PR + HANDOFF tip + replay JSON snippets (matches list, not clocks-only).
