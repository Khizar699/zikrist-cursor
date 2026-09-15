# Shared: bump HANDOFF.md on every session PR

**Founder policy.** Every PR that merges to `main` **must** update `HANDOFF.md` in the **same** PR. Prompt Smith and cloud agents: this is a hard process rule, not optional docs polish.

## Required HANDOFF.md fields

1. **What landed** this session (honest; do not claim Mac-green or `ready` without evidence)
2. **Tip state** (branch / PR; what friends and new bots should assume)
3. **Open tracks** (next prompt / hold / blocked)
4. **Gates** — `npm run test:replay -- all` stays **14/14** Quran; note Linux is not that gate
5. **Fixture restore** — `npm run fixtures:recitation` and `npm run fixtures:imam` (tag `imam-fixtures-v1` / `zikrist-imam-fixtures-v1.zip`); liturgy `npm run liturgy:tts -- <id> --engine say` with ffmpeg on `PATH`
6. **Known fails** — at least Subayyal 4:129≠41:34 and Qiyam 36:16≠78:4 until those are Mac-green; never invent ayah labels

## Forbidden

- Merging to `main` without a `HANDOFF.md` diff
- Flipping real-imam suites to `ready` until `prompts/imam-mid-surah-cold-false-lock.md` is Mac-green
- Committing wav/mp3

See the **Maintainer rule** section at the top of `HANDOFF.md`.
