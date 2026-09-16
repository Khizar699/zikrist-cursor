# Stub manifest → ready via label-fill

`manifest.stub.json` is the replay registry. Suites start as `status: stub`.

Flip to **`ready` only** in a dedicated label-fill session (`prompts/real-imam/label-fill/`), one suite at a time, after Mac `test:replay -- <suite>` PASS. Algo gate for mid-surah cold: PR **#17** (Mac-green).

Founder labels (`LABELS.md`, `labels.json`) are ground truth — not alone a readiness flip. Restoring wavs via `fixtures:imam` is not a readiness flip.
