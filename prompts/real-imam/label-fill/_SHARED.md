# Shared rules — real-imam label-fill (stub → ready)

**Ground truth:** `prompts/real-imam/LABELS.md` + `prompts/real-imam/labels.json` (founder-verified 2026-09-16; also under `artifacts/recitation/imam/` after `fixtures:imam`).  
**Do not** use `probes/hypothesized-locks.txt` as labels (probe mismatches are documented in LABELS.md).

## Audio

- Already staged under gitignored `artifacts/recitation/imam/<suite-id>/qari-a/`.
- Prefer the **named** WAV whose filename embeds the verified range (e.g. `__004-129-130__`), not `__UNKNOWN__`.
- Must be **16 kHz mono PCM16**. If a source is wrong format: `ffmpeg -y -i in.wav -ac 1 -ar 16000 -sample_fmt s16 out.wav` in place (keep gitignored).
- **Never** commit WAV/MP3. **Never** invent silent stubs that would PASS.
- Replay resolves clips as `artifacts/recitation/imam/<suite_id>/<qari_slot>/<basename(clip_path)>` (`clipsFromStub` in `scripts/replay-suites.ts`). So `clip_path` in the manifest is the **basename** (or a path whose basename matches the file under `qari-a/`).

## Manifest

Edit **only** the target suite row in `prompts/real-imam/manifest.stub.json`:

- `status: "ready"`
- `clip_path`: basename of the labeled WAV
- `expected_first_lock` / `expected_sequence` from LABELS / `labels.json` `suite_candidates`
- `notes`: source short name + ayah range + license caveat
- `license_status`: keep `unresolved` unless founder cleared rights
- Default `gate`: `ordered-sequence` (omit unless needed)
- Default single clip → omit `clipRunMode` (concat). Do **not** pack two different surah ranges into one suite row — one expect list per suite id.

## Forbidden

- Matcher / follower / ONNX / UI retune
- Marking `ready` while the suite still skips `missing_fixture`
- Filling `imam-mid-ayah-pause` (no founder pause mark yet — leave stub)
- Using s9P@4:56 **Qunut** as Quran expect (dua / liturgy later — not this pack)
- Flipping more than one suite (or one new sibling suite) per session
- Mega-prompt that retunes algorithm when Mac fails locks

## If Mac fails locks

Do **not** retune in the fill PR. Open a **separate** algorithm prompt (one failure mode). Leave suite `stub` or document measured miss in notes and ping Bot — do not fake PASS.

## Hard gate every session

Mac: `npm run test:replay -- all` = **14/14** (Quran synthetic). Soft optional only: `prompts/nas-no-post-end-jump.md`. **Continuity docs:** bump `HANDOFF.md` tip in the same PR; update `VALIDATION.md` and queue status when they apply (`prompts/_SHARED-HANDOFF.md`).

## Verify

```bash
npm run test:replay -- <suite_id>    # must PASS (not skip)
npm run test:replay -- real-imam     # other stubs may still skip
npm run test:replay -- all           # 14/14
```

## Deliverable

Plus continuity docs: `HANDOFF.md` tip always; `VALIDATION.md` / queues when applicable (`prompts/_SHARED-HANDOFF.md`).

Suite id, clip basename, Mac JSON snippet (`first_lock` / failureMode), confirm WAV stayed gitignored.
