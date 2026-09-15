# Mid-surah cold acquire: refuse 41:34 / 78:4 false champions

## Goal

On **Mac**, headless replay of the two founder-labeled mid-surah cold clips must first-lock the **true** ayah, then follow the short expected sequence — not the probe-style wrong surahs Bot measured.

| Clip (gitignored) | Want first lock | Measured false lock | Then follow |
|---|---|---|---|
| `artifacts/recitation/imam/imam-mid-surah-cold/qari-a/imam-mid-surah-cold__dr-subayyal__004-129-130__raw.wav` | **4:129** | **41:34** (~9s, score ~0.63) | 4:129 → 4:130 |
| `artifacts/recitation/imam/imam-mid-surah-cold/qari-a/imam-mid-surah-cold__qiyam-faisal__036-016-018__raw.wav` | **36:16** | **78:4** (~2s, score ~0.85) | 36:16 → 36:17 → 36:18 |

Ground truth: `artifacts/recitation/imam/LABELS.md` + `labels.json` (2026-09-16). Do **not** trust `probes/hypothesized-locks.txt`.

## Last session proved / failed

- Real-imam harness + stub suites exist; `test:replay -- all` Quran **14/14** is the merge bar.
- Label-fill prompts are on main (`prompts/real-imam/label-fill/01…` / `02…`) but **held**: flipping `status: ready` would fail the ready gate while these false locks stand.
- Synthetic `cold-start-mid` (Baqarah mid) is a different fixture — keep it green; it does not substitute for these mosque clips.
- Confusion class (for investigation, not a prescribed patch):
  - **4:129** `ولن تستطيعوا…` vs **41:34** `ولا تستوي…` — early `ول-/تـسـتـ` window can crown the wrong long ayah.
  - **36:16** `…ربنا يعلم…` vs short **78:4** `كلا سيعلمون` — thin window + short-ayah / shared علم root can lock 78:4 in ~2s.

## Constraints

- **One concern:** mid-surah **cold acquire** false first-lock on these two clips (refuse distant/short wrong champions on thin evidence; prefer distinctive mid-ayah body tokens).
- Offline; real ONNX + existing `RecitationFollower` / continuation gate. **No** fake matches, **No** silent WAVs, **no** suite-ID hardcodes (`if suite === imam-…`).
- **Do not** flip `prompts/real-imam/manifest.stub.json` to `ready` in this session (that is label-fill `01`/`02` after Mac green).
- **Do not** retune liturgy matcher; **do not** expand to mid-ayah-pause / Qunut / multi-qari.
- Keep Mac `npm run test:replay -- all` = **14/14**. Soft leftover nas→2:1 after 114:6 is optional only (`prompts/nas-no-post-end-jump.md`) — do not regress it further.
- Prefer tightening acquire evidence (unique words, hold shared prefixes, reject short distant champions on thin windows) over widening follow windows or model weight edits.

## Area to touch

- `src/core/follower.ts` (and gate helpers only if first-lock evidence lives there)
- Tests: add unit cases that encode **4:129 ≠ 41:34** and **36:16 ≠ 78:4** if the transcript/token path can express them without requiring the mosque WAV in CI
- Mac verify (required — Linux ONNX often lied before):

```bash
npx tsx scripts/replay.ts \
  artifacts/recitation/imam/imam-mid-surah-cold/qari-a/imam-mid-surah-cold__dr-subayyal__004-129-130__raw.wav
npx tsx scripts/replay.ts \
  artifacts/recitation/imam/imam-mid-surah-cold/qari-a/imam-mid-surah-cold__qiyam-faisal__036-016-018__raw.wav
npm run test:replay -- all
npm test && npm run typecheck
```

Refresh JSON under `artifacts/qa-runs/` for the custom runs if the harness writes them.

## Out of scope

- Label-fill / manifest `ready`
- `imam-mid-ayah-pause` (no pause mark)
- UI / Sim polish
- Mega-refactor of Tilawa internals

## Success criteria

1. Mac custom Subayyal replay: first lock **4:129**, never 41:34; then **4:130** (ordered). `wrongSurahRate` for the run should not be 1.0 on a false champion.
2. Mac custom Qiyam replay: first lock **36:16**, never 78:4; then **36:17–18**.
3. Mac `npm run test:replay -- all` still **14/14**.
4. `npm test` / typecheck (and lint if usually run) pass.
5. Session ends with: commands, JSON paths, files changed, honest residual fails — next slice is **label-fill `01`** then **`02`** (Bot launches those after this is green).

## Deliverable

PR + Mac JSON snippets for both clips + note that label-fill may proceed.
