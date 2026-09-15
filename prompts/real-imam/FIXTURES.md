# Real-imam / live-tilawah fixtures

Large audio is gitignored. Founder drops source media in `~/Desktop/zikrist-imam-clips/`.

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
