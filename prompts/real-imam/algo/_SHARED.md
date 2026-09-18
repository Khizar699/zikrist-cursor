# Shared — founder-clip algo sessions

- **Labels only:** `prompts/real-imam/LABELS.md` + `labels.json` (and zip copies under `artifacts/recitation/imam/`). Ignore `probes/hypothesized-locks.txt`.
- **No `ready` flips** in algo sessions — leave `manifest.stub.json` readiness to label-fill.
- **HANDOFF:** bump root `HANDOFF.md` tip in the same PR (`prompts/_SHARED-HANDOFF.md`).
- **Regression floor:** Mac `npm run test:replay -- all` = **14/14** every session.
- **Product bar:** follow `PRODUCT-BAR.md`. Session is incomplete if only 14/14 / units moved and the Tip clip was not Mac-measured for **monotonic ordered advance** (or the Tip’s stated failure mode). Translation is Phase 2.
- **One concern** per session (Tip-named). Offline ONNX; no suite-ID hardcodes; no liturgy retune; no label-fill work; **no** translation-pack / network tests in `npm test`.
- **Engine split:** Tilawa locate ≠ Zikrist follow. Follow/handoff sessions may edit `src/core/follower.ts` + gate helpers; do **not** default to “prefer acquire-evidence only.” Acquire-only is for Tip concerns that are false-first-lock.
- **Verify yourself:** the agent that patches must run `PRODUCT-BAR.md` Agent verify loop on Mac (units + typecheck + `test:replay -- all` + Tip wav). Do not ask the founder to vibe-check iOS instead.
- **Ratchet:** obey `RATCHET.md` — every fix ships a permanent lock (unit and/or ready expect) in the same PR; tip known-fails only shrink when locked.
- **No mega-refactor.** Prefer the smallest evidence fix for the Tip failure mode.
- Custom verify: `npx tsx scripts/replay.ts <wav>` (ffmpeg on `PATH` as other Mac scripts). Paste match sequence + stall/`failureMode` into the PR / tip.
