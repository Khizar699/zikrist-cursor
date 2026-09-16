#!/usr/bin/env node
/**
 * One-shot first-clone setup for friends / new machines.
 *
 *   npm run setup              # model + verify (required for the app)
 *   npm run setup -- --fixtures  # also EveryAyah + imam wavs (recognition bots)
 *
 * Does not run CocoaPods / Xcode — `npm run ios` still owns the native build.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const pkg = require('../package.json');
const wantFixtures = process.argv.includes('--fixtures');

function fail(message) {
  console.error(`\nsetup failed: ${message}\n`);
  process.exit(1);
}

function run(label, command, args) {
  console.log(`\n→ ${label}`);
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false });
  if (result.error) fail(`${label}: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} exited ${result.status}`);
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
const engines = pkg.engines?.node ?? '>=22.13';
if (nodeMajor < 22) {
  fail(`Node ${engines} required (found ${process.versions.node}).`);
}

if (!existsSync(path.join(root, 'node_modules', 'expo'))) {
  fail('Dependencies missing. Run `npm ci` (or `npm i`) first, then `npm run setup`.');
}

run('download recognition model (~104 MB, gitignored)', process.execPath, [
  path.join(root, 'scripts/download-assets.mjs'),
]);
run('verify model + Quran integrity', process.execPath, [
  path.join(root, 'scripts/verify-assets.mjs'),
]);

if (wantFixtures) {
  run('download EveryAyah recitation fixtures', path.join(root, 'node_modules/.bin/tsx'), [
    path.join(root, 'scripts/download-recitation-fixtures.ts'),
  ]);
  run('download imam fixtures zip', path.join(root, 'node_modules/.bin/tsx'), [
    path.join(root, 'scripts/download-imam-fixtures.ts'),
  ]);
}

const model = path.join(root, 'assets/model/fastconformer_full_mixed.onnx');
if (!existsSync(model)) fail(`expected ${path.relative(root, model)} after download`);

const infoPlist = path.join(root, 'ios/Zikrist/Info.plist');
if (existsSync(infoPlist)) {
  const plist = readFileSync(infoPlist, 'utf8');
  if (!plist.includes('NSMicrophoneUsageDescription')) {
    fail(
      'ios/Zikrist/Info.plist is missing NSMicrophoneUsageDescription. ' +
        'Regenerate with: npx expo prebuild --platform ios --clean   then npm run ios',
    );
  }
  const pbx = path.join(root, 'ios/Zikrist.xcodeproj/project.pbxproj');
  if (existsSync(pbx)) {
    const project = readFileSync(pbx, 'utf8');
    if (project.includes('org.name.Zikrist') && !project.includes('app.zikrist.mobile')) {
      fail(
        'ios/ looks like a stock React Native template (org.name.Zikrist), not Expo prebuild. ' +
          'Fix: rm -rf ios && npx expo prebuild --platform ios --clean && npm run ios',
      );
    }
  }
} else {
  console.log('\nNote: no ios/ yet — `npm run ios` will generate it via Expo prebuild.');
}

console.log(`
Setup OK.

Next (app on simulator):
  npm run ios

Recognition / replay bots also need fixtures (if you skipped --fixtures):
  npm run fixtures:recitation
  npm run fixtures:imam

If the app red-boxes on the ONNX file: you skipped assets — re-run npm run setup.
If it says NSMicrophoneUsageDescription is missing:
  npx expo prebuild --platform ios --clean && npm run ios
`);
