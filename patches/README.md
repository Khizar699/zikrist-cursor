# Pinned Tilawa memory patch

`@tilawa+core+0.1.0.patch` adopts the source changes in upstream [PR 18](https://github.com/yazinsai/tilawa/pull/18), head `0856cd1491a08c3c437f52add6a07ca22acc3183`, for `levenshtein.ts`, `quran-db.ts`, `session.ts`, and `tracker.ts`. The corresponding dist JavaScript was transpiled with TypeScript. The original MIT license applies.

The patch replaces repeated string n-gram sets with packed sorted integers, caches corpus n-grams, reuses Levenshtein scratch rows, and avoids redundant audio copies. It also returns the locate champion below score 0.8 (Zikrist applies its own lock bar instead of searching twice), refuses to fall back to all 6,236 verses on short or thin n-gram queries, records ONNX/decode/locate timings on `TranscribeResult`, and exposes `warmSearchIndexes()` so prefix/global span tables are built at model load. The runtime adapter treats borrowed audio as immutable. The app serializes inference so shared scratch buffers are not used concurrently within a JavaScript runtime.

`patch-package` applies this patch during `npm ci` / `npm install`. `tests/tilawa-patch.test.ts` compares the real Quran candidate shortlist against the original Set fallback path. Asset verification checks every CTC token round trip.

This is an adopted upstream proposal, not a released fix or a guarantee of low total application memory. Desktop replay still showed roughly 667 MB peak process RSS; ONNX allocations, text indexes and the JavaScript runtime all contribute. Measure on real mid-range phones before claiming compatibility.

A scoped npm override updates `xcode > uuid` to 11.1.1 so native prebuild uses the compatible `v4()` API. Native prebuild and package auditing must be rerun when changing this override.

`expo-constants+57.0.18.patch` fixes the iOS constants build script for project paths containing spaces. It quotes the script path and `basename` argument, and shell-escapes an optional `PROJECT_ROOT`. Without this patch the native build fails in `Zikrist 2` with an “is a directory” error. The Expo package's MIT license applies.
