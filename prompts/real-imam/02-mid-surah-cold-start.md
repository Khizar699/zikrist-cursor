# Suite: mid-surah cold start (real-imam scaffold)

## Goal

Add named replay suite `imam-mid-surah-cold`: listener starts **after** surah opening (e.g. mid Baqarah or mid short surah). Wire expectations; stub audio until clips arrive.

## Depends on

`01-fixture-scaffold` naming/manifest.

## Expectations (when audio ready)

- First lock is a **mid-surah** ayah (not forced to ayah 1 / wrong surah)  
- Follow continues forward without false early acquire to unrelated surah  
- Regression: existing Fatiha cold-start-mid synthetic suite still green  

## Out of scope

Follower retune unless suite cannot express skip/stub; prefer harness-only this session.

## Success

Suite registered; stub skips cleanly; README documents expected_first_lock placeholder; Quran 14/14 intact.
