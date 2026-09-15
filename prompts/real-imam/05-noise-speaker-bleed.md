# Suite: noise / speaker bleed (real-imam)

## Goal

When audio exists, `npm run test:replay -- imam-noise-bleed` follows the intended tilawah under ambient noise, hall bleed, or a second voice. Placeholder expect: **112:1–4**. Pass = ordered target locks, not surah thrash.

Until the WAV exists: `missing_fixture`.

## Failure modes (when scored)

| Mode | Meaning |
|------|---------|
| `sequence_break_at_*` / wrong first lock | Locked an ayah that is not the intended sequence |
| `wrongSurahRate` &gt; 0 | Bleed/noise became a different surah |
| `spam_relock` (notes) | Rapid flip-flopping; still surfaces as extra `matches` / sequence break |

Do not claim noise-robust SOTA. Soft miss (no lock) is better than a random surah.

## Out of scope

Training new models; mixing EveryAyah with fake noise; liturgy.

## Success

Suite registered as pending; 14/14 untouched. After clip: document `failureMode` and `wrongSurahRate` honestly.
