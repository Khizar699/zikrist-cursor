# Suite: surah switch mid-session (real-imam)

## Goal

When audio exists, `npm run test:replay -- imam-surah-switch` reacquires the new surah after a natural (or hard-cut) switch. Placeholder: **108:1–3 then 112:1–4** (same ordered gate as synthetic `jump`, but one imam recording / longer tails).

Until the WAV exists: `missing_fixture`.

## Context

Synthetic `jump` (Kawthar then Ikhlas concat of EveryAyah verse files) already covers the algorithm on studio clips. This suite is for founder/imam audio. Do not regress `jump` or `back-to-back` on the 14-suite gate.

## Out of scope

Concatenating EveryAyah files and calling them imam audio. Liturgy. Follower retune until the real clip’s `failureMode` is known.

## Success

Suite stub + documented expect; 14/14 intact. After clip: ordered 108 then 112 (or updated JSON) without sticky wrong locks.
