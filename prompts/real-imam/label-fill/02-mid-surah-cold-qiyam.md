# Fill: imam-mid-surah-cold-qiyam → ready (Faisal Qiyam 36:16–18)

Read `_SHARED.md` first.

**Unblocked:** PR #17 Mac-green (36:16 ≠ 78:4). Launch **after** `01` is merged ready. Restore with `npm run fixtures:imam` if needed.

 **Depends on:** `01-mid-surah-cold-dr-subayyal` merged (or at least `imam-mid-surah-cold` already claiming 4:129–130 expect — do not overwrite that row).

## Why a sibling suite

Harness has **one** `expected_sequence` per suite id. Qiyam is also mid-surah cold-start but **36:16–18**, so it cannot share `imam-mid-surah-cold` with Dr Subayyal. Add a **sibling** suite id (fixture registration only — no matcher retune).

## Goal

Register + flip `imam-mid-surah-cold-qiyam` → **ready**.

## Clip (already on disk)

```
artifacts/recitation/imam/imam-mid-surah-cold/qari-a/imam-mid-surah-cold__qiyam-faisal__036-016-018__raw.wav
```

Verified: 16 kHz mono PCM16 ~21s. Labels: Ya-Sin **36:16–18** (probe wrongly said 78:4 — ignore).

**File layout note:** WAV currently lives under folder `imam-mid-surah-cold/`. Either:

- **Preferred:** copy/symlink basename into `artifacts/recitation/imam/imam-mid-surah-cold-qiyam/qari-a/` (gitignored) so `clipsFromStub` resolves cleanly, **or**
- Keep file where it is **only if** you change harness clip resolution for this suite (avoid — prefer copy under the new suite id folder).

Suggested copy:

```bash
mkdir -p artifacts/recitation/imam/imam-mid-surah-cold-qiyam/qari-a
cp artifacts/recitation/imam/imam-mid-surah-cold/qari-a/imam-mid-surah-cold__qiyam-faisal__036-016-018__raw.wav \
   artifacts/recitation/imam/imam-mid-surah-cold-qiyam/qari-a/
```

Optional rename to `imam-mid-surah-cold-qiyam__qiyam-faisal__036-016-018__raw.wav` for clarity; then use that basename in `clip_path`.

## Harness (this session — fixture only)

1. Add `'imam-mid-surah-cold-qiyam'` to `REAL_IMAM_SUITE_NAMES` in `scripts/replay-suites.ts` (and any `--list` / help strings that enumerate imam suites).
2. Append a suite row to `prompts/real-imam/manifest.stub.json`:

```json
{
  "suite_id": "imam-mid-surah-cold-qiyam",
  "status": "ready",
  "clip_path": "imam-mid-surah-cold__qiyam-faisal__036-016-018__raw.wav",
  "expected_first_lock": { "surah": 36, "ayah": 16 },
  "expected_sequence": [
    { "surah": 36, "ayah": 16 },
    { "surah": 36, "ayah": 17 },
    { "surah": 36, "ayah": 18 }
  ],
  "notes": "Qiyam-ul-Lail Faisal short; Ya-Sin 36:16-18 mid-surah cold; founder-verified 2026-09-16; sibling of imam-mid-surah-cold; license unresolved",
  "license_status": "unresolved"
}
```

(If you renamed the WAV under the new folder, use that basename instead.)

3. Do **not** change follower/matcher thresholds.

## Out of scope

Overwriting `imam-mid-surah-cold`; mid-ayah-pause; Qunut; algorithm retune; other candidates.

## Success

1. Mac: `npm run test:replay -- imam-mid-surah-cold-qiyam` **PASS**
2. Mac: `npm run test:replay -- imam-mid-surah-cold` still PASS if already ready
3. Mac: `npm run test:replay -- all` **14/14**
4. Audio gitignored

## If locks fail

Separate algorithm prompt; no retune in this PR.

## Deliverable

Write continuity docs in this same PR: `HANDOFF.md` tip (always); `VALIDATION.md` / queue status when applicable (`prompts/_SHARED-HANDOFF.md`).

New suite id, clip path, Mac JSON snippet, PR link.
