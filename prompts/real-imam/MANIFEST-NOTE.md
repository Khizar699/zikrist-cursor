# Stub manifest → ready via label-fill

`manifest.stub.json` is the replay registry.

- `imam-mid-surah-cold` is `status: ready` (label-fill **01**, Dr Subayyal An-Nisa **4:129–130**). Restore the WAV with `npm run fixtures:imam`; Mac must PASS (not skip). This file flip is not a Mac acoustic claim.
- `imam-mid-surah-cold-qiyam` is `status: ready` (label-fill **02**, Qiyam-ul-Lail Faisal Ya-Sin **36:16–18**). `npm run fixtures:imam` copies the clip into `imam-mid-surah-cold-qiyam/qari-a/`. Mac must PASS (not skip). Not a Mac acoustic claim in this fill PR.
- Other suite rows remain `status: stub`. Restoring the zip is not a `ready` flip.

Flip additional suites **only** in a dedicated label-fill session, one at a time, **after** Mac algo green. That flip is the **permanent ratchet lock** for that mosque sequence (`expected_sequence` from founder `LABELS.md` / `labels.json`). Do not weaken a ready expect later without a stricter replacement (`algo/RATCHET.md`).

Algo gate for mid-surah cold: PR **#17** (Mac-green). Founder labels are ground truth. Next: remaining founder-labeled clips (one prompt each), follow/handoff P0, and liturgy TTS `tts-fill/03-ruku.md`.
