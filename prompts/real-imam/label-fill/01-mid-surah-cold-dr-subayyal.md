# Fill: imam-mid-surah-cold → ready (Dr Subayyal 4:129–130)

Read `prompts/real-imam/label-fill/_SHARED.md` first.

**Unblocked:** PR #17 Mac-green (4:129 ≠ 41:34). Restore clip with `npm run fixtures:imam` if missing. Ground truth: `prompts/real-imam/LABELS.md` (also mirrored under `artifacts/…` after restore).

## Goal

Flip suite `imam-mid-surah-cold` from stub → **ready** using the founder-labeled short clip (mid-surah cold start — not ayah 1).

## Clip (already on disk)

```
artifacts/recitation/imam/imam-mid-surah-cold/qari-a/imam-mid-surah-cold__dr-subayyal__004-129-130__raw.wav
```

Verified: 16 kHz mono PCM16 ~34s. Source: Dr-Subayyal Ikram short. Labels: An-Nisa **4:129–130** (LABELS.md; probe wrongly said 41:34 — ignore probe).

Do **not** use `imam-mid-surah-cold__dr-subayyal__UNKNOWN__raw.wav`.

## Manifest (`prompts/real-imam/manifest.stub.json`)

Update **only** the `imam-mid-surah-cold` row:

```json
{
  "suite_id": "imam-mid-surah-cold",
  "status": "ready",
  "clip_path": "imam-mid-surah-cold__dr-subayyal__004-129-130__raw.wav",
  "expected_first_lock": { "surah": 4, "ayah": 129 },
  "expected_sequence": [
    { "surah": 4, "ayah": 129 },
    { "surah": 4, "ayah": 130 }
  ],
  "notes": "Dr Subayyal short; An-Nisa 4:129-130 mid-surah cold; founder-verified 2026-09-16; license unresolved",
  "license_status": "unresolved"
}
```

Harness builds path `imam-mid-surah-cold/qari-a/<basename>` — do not change `qari_slots` unless needed (`qari-a` default).

## Out of scope

Other imam suites; qiyam sibling (session `02`); mid-ayah-pause; matcher/follower retune; liturgy TTS; committing audio.

## Success

1. Mac: `npm run test:replay -- imam-mid-surah-cold` **PASS** (not `missing_fixture` skip)
2. Mac: `npm run test:replay -- all` still **14/14**
3. Other real-imam stubs may still skip under `test:replay -- real-imam`
4. WAV remains gitignored; only manifest (+ tiny docs if needed) in the PR

## If locks fail on Mac

Stop. Do not retune. Ping Bot with failureMode / first_lock; open a **separate** algorithm prompt. Leave status `stub` or keep ready only if Bot explicitly wants measured-fail tracking (default: leave stub).

## Deliverable

Write continuity docs in this same PR: `HANDOFF.md` tip (always); `VALIDATION.md` / queue status when applicable (`prompts/_SHARED-HANDOFF.md`).

Clip basename, Mac JSON snippet, PR link.
