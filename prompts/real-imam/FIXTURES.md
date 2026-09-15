# Real-imam / live-tilawah fixtures

Canonical layout (committed metadata, gitignored audio): **`fixtures/real-imam/`**.

Read `fixtures/real-imam/README.md` for clip ids, expected-locks schema, and how to register a suite.

Large audio is gitignored. Founder drops source media in `~/Desktop/zikrist-imam-clips/`.

## Status

- `pending` — WAV/MP3 not on disk; `npm run test:replay -- real-imam` → `missing_fixture` (not PASS)
- `ready` — clip present and a replay JSON exists; still not a production/imam-ready claim

Do not put imam audio under `artifacts/recitation/` (that tree is EveryAyah restore via `npm run fixtures:recitation`).
