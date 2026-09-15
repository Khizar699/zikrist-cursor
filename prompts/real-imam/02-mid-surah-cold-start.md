# Suite: mid-surah cold start (real-imam)

## Goal

When audio exists, `npm run test:replay -- imam-mid-surah-cold` first-locks a **mid-surah** ayah (placeholder: **2:255** then **2:256**), not ayah 1 and not a wrong surah.

Until the WAV exists this suite is **pending**: `missing_fixture`, not PASS.

## Depends on

Fixture layout in `fixtures/real-imam/` (`01-fixture-scaffold.md`). Distinct from synthetic `cold-start-mid` (trim 0.75 s of EveryAyah `002002`).

## Inspected

- `scripts/replay-suites.ts` pending pack + `fixtures/real-imam/suites/imam-mid-surah-cold.json`
- Live acquire still prefers unique evidence; Basmala/ayah-1 bias must not force 2:1 on a Kursi clip
- Do not retune follower in a clip-drop session unless the real recording fails with an exact `failureMode`

## Expectations (when audio ready)

- First lock = JSON `expected_first_lock` (default 2:255). Edit JSON if the dropped clip starts elsewhere.
- Then follow the rest of `expect` without false early acquire to an unrelated surah
- Regression: `cold-start-mid` (2:2 after trim) and `longer` stay on the 14-suite gate

## Out of scope

Silent STUB wav; salah liturgy; UI. Follower retune only after a real clip + honest failureMode.

## Success

- Scaffold: suite registered; `npm run test:replay -- real-imam` lists it as `missing_fixture`; 14/14 selection intact
- After clip: ordered 2:255–2:256 (or updated expect) with `failureMode` null — report, do not invent
