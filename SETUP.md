# First clone — run these in order

For anyone who downloads this repo from GitHub and wants the **iOS simulator app** working. Do not skip steps. Do not use Expo Go (ONNX and the microphone need a native build).

**Requirements:** macOS, Node **22.13+**, Xcode, CocoaPods (or this repo’s optional `.tooling` pods).

---

## 1. Install dependencies

```sh
cd zikrist-cursor
npm ci
```

If `npm ci` fails (no lock sync), use:

```sh
npm i
```

---

## 2. Download the recognition model (required)

The ONNX model is **not** in git (~104 MB). Without this step the app red-boxes on `fastconformer_full_mixed.onnx`.

```sh
npm run setup
```

This downloads the pinned model, verifies checksums, and checks that a leftover `ios/` tree is not broken.

**Optional — evaluation audio** (EveryAyah + imam wavs, gitignored):

```sh
npm run setup -- --fixtures
```

Same as running `npm run fixtures:recitation` then `npm run fixtures:imam`.

---

## 3. Build and launch iOS

```sh
npm run ios
```

First run takes a long time (Expo prebuild + CocoaPods + Xcode). Later runs are faster.

Physical iPhone:

```sh
npm run ios -- --device
```

(Configure Xcode signing / development team for device builds.)

Android (separate toolchain):

```sh
npm run android
```

---

## 4. If something already failed — common fixes

**Missing model / Unable to resolve `fastconformer_*.onnx`**

```sh
npm run setup
```

**`NSMicrophoneUsageDescription` missing, or bundle id is `org.name.Zikrist`**

```sh
npx expo prebuild --platform ios --clean
npm run ios
```

**Prebuild error in `with-private-storage` / shell scripts**

Pull latest `main` (this was fixed), then clean prebuild as above.

---

## 5. Later sessions on the same machine

```sh
npm run ios
```

Only re-run `npm run setup` after a fresh clone or if assets were deleted.

---

## Recognition regression (Mac bots — after fixtures)

```sh
npm test
npm run typecheck
npm run test:replay -- all
npm run test:coverage -- --list
npm run findings:report
```

Product goal: [AGENTS.md](AGENTS.md).
