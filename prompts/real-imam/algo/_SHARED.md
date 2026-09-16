# Shared — founder-clip algo sessions

- **Labels only:** `prompts/real-imam/LABELS.md` + `labels.json` (and zip copies under `artifacts/recitation/imam/`). Ignore `probes/hypothesized-locks.txt`.
- **No `ready` flips** in algo sessions — leave `manifest.stub.json` readiness to label-fill.
- **HANDOFF:** bump root `HANDOFF.md` tip in the same PR (`prompts/_SHARED-HANDOFF.md`).
- **Gate:** Mac `npm run test:replay -- all` = **14/14** every session.
- **One concern** per session; offline ONNX; no suite-ID hardcodes; no liturgy retune; no label-fill work; prefer acquire-evidence fixes in `src/core/follower.ts` over mega-refactor.
- Custom verify: `npx tsx scripts/replay.ts <wav>` (ffmpeg on `PATH` as other Mac scripts).
