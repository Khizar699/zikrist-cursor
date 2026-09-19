# Mushaf follower refactor — engineering report

## Architecture before

- `RecitationFollower` emitted `verse_match` directly from fuzzy scores via `commit()`.
- `ContinuationGate` could paint cross-surah salah-pool ayah-1 jumps immediately (last ayah / `salahPoolAyah1`), bypassing pending confirmation.
- Mismatch clearing used `neighborhood >= 0.5` fuzzy hold.
- Handoff logic spread across `surahSwitchReady`, `oneWordSwitchReady`, `confirmShortOpening`, and multiple `commit()` call sites.

## Architecture after

```
ASR → follower (tape / openings / neighborhood)
    → decideLocationCommit (tracking/commit-controller.ts)
    → verse_match with locationCommit + optional verse_candidate
    → ContinuationGate (requires locationCommit for cross-surah paint)
    → Listening / Timeline / UI
```

New modules under `src/core/tracking/`:

| Module | Role |
|--------|------|
| `types.ts` | Commit kinds, evidence snapshots |
| `token-stats.ts` | Quran-wide DF / IDF weights |
| `evidence.ts` | Log-scored evidence, sequence prior, margin, thresholds |
| `commit-controller.ts` | Single commit decision policy |
| `handoff-policy.ts` | Exported thresholds + controller entry points |

## State machine

| Product | Code |
|---------|------|
| LOCATING | `acquiring` / `reacquiring` → `acquire()` |
| FOLLOWING | `following` + `lock` |
| REACQUIRING | `reacquiring` after grace / `unsupportedVoicedMs` |
| Handoff hypothesis | Pending short opening + `verse_candidate`; gate pending |

## Evidence model (implemented)

- Lexical score (0..1) + IDF-weighted log term + sequence prior (next ayah vs cross-surah).
- Runner-up margin on opening pool for cross-surah commits.
- Rules: thin single-token cross-surah hold; multi-token ≥0.65; temporal `shortOpeningPeeksConfirmed`; muqattaat / entropy as strong support.

## 103:1 false attractor

- Isolated `والعصر` while on 112:4: held (thin handoff / short opening) — no `verse_match`.
- Confirmed handoffs require `locationCommit: true` on `verse_match` for gate paint.
- An-Nas with full opening tokens commits 114:1 on a later hop.

## Tests

- Added: `Ikhlas 112:4 does not commit Asr 103:1 on isolated walasr while An-Nas follows`.
- Updated continuation-gate tests for explicit `locationCommit: true` on intentional instant cross-surah paints.
- **313/313** unit tests passing (`npm test`).

## Performance

- Follow path unchanged: no full mushaf scan while `following`.
- Opening-pool margin adds O(114) scoring on cross-surah commit attempts only.
- HUD: `candidateMargin` field added.

## Remaining limitations

- CTC logprobs exist in native/model path but are not yet wired into `TranscribeFn` / evidence (Phase 6 deferred).
- Full hypothesis beam / Viterbi not implemented; margin + temporal rules used instead.
- Threshold calibration from replay fixtures recommended (`npm run test:replay -- all`).

## Recommended next steps

1. Pipe CTC token posteriors from `loadModel` into evidence weights.
2. Calibrate `HANDOFF_MARGIN_MIN`, `CROSS_SURAH_*` from real-imam replay distributions.
3. Optionally extract align helpers from `follower.ts` into `src/core/align.ts` to shrink the monolith.
