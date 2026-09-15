# Shared TTS / clip rules (all liturgy fill sessions)

## Audio

- 16 kHz mono PCM16 WAV
- Path: `artifacts/recitation/liturgy/<suite_id>/<suite_id>__tts-or-source__<tag>.wav`
- Update `prompts/salah-liturgy/manifest.stub.json` for that suite only: `status: ready`, real `clip_path` relative to `audio_root`, keep `expect_phrase_ids` / gate unchanged unless documenting a measured partial for tashahhud
- License: note TTS engine / voice / rights in suite `notes` + `license_status` (still may be `unresolved` for commercial)

## Spoken text

Use pack `arabic_uthmani` / recognition text from `assets/content/salah-liturgy.json` for the target `phraseId`. Do not invent wording.

## Scoring path

Existing harness: PCM → follower heard tokens → `SalahLiturgyMatcher`. Do not add token-only fixtures that PASS without audio.

## Forbidden

- Matcher threshold changes
- Committing WAV/MP3 into git
- Marking `ready` while still skipping
- Imam / mosque clip work
- Expanding deferred pack phrases
