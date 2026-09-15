# Nas: after 114:6 do not lock Baqarah 2:1 (soft follow-up)

## Goal

`npm run test:replay -- nas` already PASSes 114:1–6. Tighten so matches **stop** at 114:6 — no post-surah lock of **2:1** (or other surahs) on trailing/pad audio.

## Baseline (Sim QA night-report-2334 @fffa1f6 — 14/14)

- nas PASS ordered gate, but matches include **2:1@38s** after 114:6@31.75 → wrongSurahRate ≈ 0.14
- Do not break the 14/14 ordered gates

## Constraints

- One concern: **end-of-An-Nas / no following surah** — An-Nas has no mushaf-next; trailing silence must not acquire Baqarah muqatta'at
- Offline; real ONNX + follower. Preserve longer 2:1@5s and basmala-hold
- Mac verify required

## Success criteria

1. test:replay nas → 114:1–6 only; wrongSurahRate 0; no 2:1 after
2. longer, basmala-hold, jump, back-to-back, fatiha still PASS
3. npm test / typecheck / lint

## Deliverable

Mac commands + JSON; optional — only if founder wants polish past 14/14.
