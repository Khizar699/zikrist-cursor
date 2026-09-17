# Failure taxonomy and mushaf coverage (phased)

Binding with [PRODUCT-BAR.md](./PRODUCT-BAR.md) and [RATCHET.md](./RATCHET.md).  
Goal: turn “works on some surahs” into an **honest score** (M/N), not a vibe.  
Full 6236 cold-start is a **scoreboard**, not a day-one merge gate.

## Failure classes (tag every Mac miss)

| Class | Meaning | Typical owner |
|---|---|---|
| `cold_miss` | No correct first lock while voiced audio continues | Tilawa locate / acquire |
| `false_lock` | First (or early) lock is the wrong ayah/surah | Locate or gate |
| `stall` | Correct first lock, then no ordered advance while audio continues | Zikrist follower |
| `wrong_handoff` | After a finished surah/section, locks the wrong next body | Follower / neighborhood |
| `soft_after_expect` | Expect prefix OK but later wrongSurah with `failureMode: null` | Gate / expect tightness |
| `missing_fixture` | Clip absent — not a PASS, not an algorithm fail | Fixtures restore |
| `missing_onnx` | Model not downloaded | `npm run setup` |

Every Tip known-fail and every findings ledger row must name:

1. **class** (above)
2. **owner** — `locate` | `follow` | `gate` | `fixture` | `infra`
3. **want** / **got** (ayah refs or `none`)

Never invent ayah labels. Founder ground truth stays in `../LABELS.md` + `../labels.json`.

## Coverage tiers

| Tier | Purpose | Cadence | Merge gate? |
|---|---|---|---|
| **Floor** | Don’t-regress (`test:replay -- all`, today’s N/14) | Every recognition PR | **Yes** — restore before claiming green |
| **A** | Stratified cold starts (~10–100 openings across mushaf regions) | Nightly / weekly / agent | Report **M/N**; not floor until promoted |
| **B** | Denser EveryAyah-style first-lock across many surah openings | Periodic | Scoreboard only |
| **C** | Follow sequences (Fatiha→body, mid-surah, boundary) | Tip product bar | Product bar; promote only when Mac-stable + locked |

Commands:

```bash
npm run test:coverage -- --list          # show Tier A sample
npm run test:coverage -- --dry-run       # fixture presence only (no ONNX)
npm run test:coverage                    # Mac: replay sample, append findings, print M/N
npm run findings:report                  # summarize open ledger classes
```

Fixtures: `npm run fixtures:recitation` (coverage may download sample verse clips on demand when not `--dry-run`).

## Multi-agent loop (findings → one Tip concern)

1. Finder / other team runs coverage + Tip clips → appends rows under [`../findings/`](../findings/).
2. Tip **Open tracks** points at **one** P0 `finding_id` (or floor restore).
3. Mac Agent patches **one** owner (Tilawa **or** follower), runs Agent verify loop, **locks** (unit and/or ready expect), tip bump.
4. Label-fill alone flips `stub` → `ready` after Mac PASS + founder labels.

See [../findings/README.md](../findings/README.md).

## Floor restore before expanding the floor

Until `test:replay -- all` is honestly **14/14**, expanding the default floor is blocked.  
Current tip P0 remains: **restore jump + english-negative** (same-PR locks) **or** Tip product-bar handoff — not silent threshold retunes and not “coverage green replaces floor.”

Promote ready imam suites into the default gate only via a dedicated harness PR ([RATCHET.md](./RATCHET.md) Floor growth).

## What is not coverage evidence

- Famous-short EveryAyah green ≠ all-surah or prayer-follow ready.
- Linux ONNX ≠ Mac floor gate.
- Chat memory ≠ a lock.
