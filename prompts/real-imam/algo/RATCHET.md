# Continuous improvement ratchet (recognition)

Binding with `PRODUCT-BAR.md`. Goal: **each daily launch leaves recognition/follow stronger than yesterday**, and **never re-breaks a solved failure without a red gate**.

## One-sentence rule

**Fix → measure on Mac → lock into permanent tests → tip records the lock.**  
A fix without a new unit and/or ready replay expect is incomplete. Chat memory is not a lock.

## Daily launch loop

Every recognition day / version bump follows this order:

1. **Read tip** — open known fails + current floor count (`N/14` or expanded floor).
2. **Pick one Tip concern** (follow/handoff, floor restore, coverage, or false-lock) — no mega-prompt.
3. **Patch** the smallest evidence fix (Tilawa locate **or** Zikrist follow — not both unless Tip says so).
4. **Verify** (`PRODUCT-BAR.md` Agent verify loop): units + typecheck + `test:replay -- all` + Tip clip + relevant ready imam suites.
5. **Lock the win** (same PR — see below).
6. **Bump tip** — what newly stays green forever; known-fail line shrinks or stays honest.

If step 5 is skipped, the day did **not** ratchet — tomorrow will rediscover the same bug.

## Lock ladder (how a fix becomes permanent)

| Win type | Minimum lock (same PR) | Stronger lock (when audio/labels exist) |
|---|---|---|
| Token / advance / false-champion class | Unit in `tests/follower.test.ts` (or gate/prior test) encoding the confusion **without** suite-ID hardcodes | — |
| Synthetic EveryAyah path (jump, english-negative, Fatiha advance, …) | Suite already in `test:replay -- all` must go/stay green | Tighten `expect` if the suite was too weak (e.g. allow only ordered prefix + refuse wrong handoff) |
| Founder mosque clip | Mac green on that wav + unit if expressible | Label-fill: `manifest.stub.json` → `ready` with `expected_sequence` from `LABELS.md` / `labels.json` (one suite per fill session) |
| Negative (must not lock) | `no-verse-locks` / basmala-hold style gate or unit refuse | Dedicated negative suite when fixture exists |

**Never:**

- Claim Mac-green without replay JSON / tip numbers.
- Flip `ready` without founder labels + Mac PASS.
- Delete or weaken an `expect` / unit that was locking a past bug unless replacing it with a **stricter** equivalent in the same PR.
- “Fixed in chat” with no test.

## Known-fails ledger

`HANDOFF.md` tip **Known fails** is the live ledger. Rules:

- **Only shrinks** when the matching lock lands (unit and/or ready suite green on Mac).
- **May grow** when a new honest Mac miss is found (better than silent rot).
- Each entry names: clip or suite, want, got, and whether the next Tip owns it.
- Solved mid-surah cold (#17 + ready suites) stays cited as **cleared** — reopening it without a red test is forbidden process failure.

## Floor growth (don’t freeze at 14 forever)

Today’s regression floor is the 14 EveryAyah-style suites in `scripts/replay-suites.ts` (`test:replay -- all`).

**Floor restore before floor expansion:** while the tip reports red (e.g. 12/14), P0 includes restoring **jump** + **english-negative** with same-PR locks. Do not promote Tier A coverage or ready imam suites into the default gate until the floor is honestly 14/14 (or tip records a deliberate, locked expect change).

Mushaf consistency scoreboard (not the merge floor): [COVERAGE.md](./COVERAGE.md) + `npm run test:coverage` (honest M/N) + findings ledger [`../findings/`](../findings/).

Ratchet intent:

1. Keep those **green** (or restore them first — a red floor blocks “daily perfect” claims).
2. When a real-imam suite is `ready` and Mac-stable, **promote it into the default gate** (or an explicit `test:replay -- floor` that includes it) in a dedicated docs+harness PR — tip must say the new floor count.
3. Soft leftovers that currently `failureMode: null` but wrongSurah after expect (e.g. Nas→2:1) become either an explicit fail or a documented allow — silent drift is not improvement.

Until promotion, ready imam suites are still **mandatory** in the Agent verify loop whenever follower/locate changes.

## Version / daily definition of better

A day counts as an improvement only if **at least one** of:

- A known fail is cleared **and** locked (unit and/or ready expect), or
- Floor goes from red → green (or green → green with a **new** locked expect/unit), or
- Product-bar Tip clip goes fail → pass **and** lock starts (unit now; ready flip in label-fill when appropriate).

A day that only retunes thresholds with no new lock is **not** a ratchet day — tip must say so.

## Anti-regression checklist (every recognition PR)

- [ ] `npm test` + `npm run typecheck`
- [ ] `npm run test:replay -- all` (record N/14; do not claim 14/14 if red)
- [ ] Tip product-bar clip measured
- [ ] Ready imam suites that exist still PASS
- [ ] **New** unit and/or expect/`ready` for the bug you fixed
- [ ] Tip known-fails updated; `VALIDATION.md` if Mac path/result changed
- [ ] No weakened expects without stricter replacement

## Roles

| Role | Duty |
|---|---|
| Local Cursor Agent (Mac) | Run verify loop; lock wins; tip honesty |
| Prompt Smith | One-concern prompts that demand lock step |
| Label-fill | One `ready` flip after Mac green — permanent sequence expect |
| Chief Bot / merge | Reject PRs that “fix” without lock + tip |
| Founder iOS | Optional smoke — never the only proof |

See also: `PRODUCT-BAR.md`, `00-QUEUE.md`, `MANIFEST-NOTE.md`, root `HANDOFF.md`.
