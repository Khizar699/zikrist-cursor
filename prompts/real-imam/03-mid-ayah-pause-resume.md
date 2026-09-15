# Suite: mid-ayah pause / resume (real-imam)

## Goal

When audio exists, `npm run test:replay -- imam-mid-ayah-pause` holds or re-locks the **same** ayah across a mid-ayah pause, then continues. Must not jump to a wrong surah.

Until the WAV exists: `missing_fixture`.

## Depends on

`fixtures/real-imam/suites/imam-mid-ayah-pause.json`. Distinct from synthetic `stall-after-lock` (112:2 + **fed** trailing pad after a completed lock).

## Inspected

Replay skips unvoiced frames **inside** the clip (same as live mic). A pause that is already in the recording is simulated correctly without extra PCM. Optional harness hook: `insertSilence` with `atAudioSeconds` set after the clip is dropped if the file itself has no gap.

Placeholder expect: 2:255 then 2:256 (long ayah so a mid-phrase pause is possible). Edit JSON to match the recording.

## Out of scope

UI polish; liturgy; fake silence WAVs; follower retune until a real clip fails.

## Success

Scaffold skip/`missing_fixture`; 14/14 Quran gate. After clip: no wrong-surah flash across the pause; sequence matches JSON.
