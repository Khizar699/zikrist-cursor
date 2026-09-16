# Stub manifest → ready via label-fill

`manifest.stub.json` is the replay registry.

- `imam-mid-surah-cold` is `status: ready` (label-fill **01**, Dr Subayyal An-Nisa **4:129–130**). Restore the WAV with `npm run fixtures:imam`; Mac must PASS (not skip). This file flip is not a Mac acoustic claim.
- Other suite rows remain `status: stub`. Restoring the zip is not a `ready` flip.

Flip additional suites **only** in a dedicated label-fill session, one at a time. Algo gate for mid-surah cold: PR **#17** (Mac-green). Founder labels (`LABELS.md`, `labels.json`) are ground truth. Next fill: `label-fill/02-mid-surah-cold-qiyam.md`.
