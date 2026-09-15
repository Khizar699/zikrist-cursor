# Real-imam / live-tilawah fixtures

Large audio is gitignored. Founder drops source media in `~/Desktop/zikrist-imam-clips/`. Replay reads **16 kHz mono PCM16 WAV** only — convert before staging (MP3/video left in the drop folder will not satisfy the suite):

```bash
ffmpeg -y -i ~/Desktop/zikrist-imam-clips/SOURCE.mp4 \
  -ar 16000 -ac 1 -c:a pcm_s16le \
  artifacts/recitation/imam/<suite-id>/qari-a/<clip-id>.wav
```

## Layout

```
artifacts/recitation/imam/
  manifest.json
  <suite-id>/<qari-or-source>/<files>.wav
  _stubs/   # placeholder entries until clips arrive
```

## Suite ids

See `prompts/real-imam/00-OVERNIGHT-QUEUE.md` and `01-fixture-scaffold.md`.

## Status

- `stub` — no real audio; automated suite must **skip**, not PASS  
- `ready` — clip present + Mac-verified notes  
