/**
 * Phase C model bakeoff. Same RecitationFollower; swap only TranscribeFn.
 * Default stays Tilawa until a streaming engine is legally usable and wins
 * follow latency + skip rate (`prompts/model-bakeoff.md`).
 *
 *   npm run test:bakeoff
 *   npm run test:bakeoff -- --engine tilawa
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BAKEOFF_DEFAULT_ENGINE,
  BAKEOFF_SUITE_NAMES,
  resolveBakeoffEngine,
  streamingWinsFollow,
  type BakeoffClocks,
} from '../src/core/bakeoff';
import { createSession, replaySuite } from './replay';
import {
  MISSING_FIXTURE,
  SKIPPED_PENDING,
  parseReplayCli,
  suiteBlueprint,
  suiteClipRefs,
  suiteSkipsWhenClipMissing,
} from './replay-suites';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HAFIZ_USAMA = path.join(
  root,
  'artifacts/recitation/imam/imam-multi-qari/qari-a/imam-multi-qari__hafiz-usama__001-027-015__raw.wav',
);

function filesFor(suite: ReturnType<typeof suiteBlueprint>): string[] {
  return suiteClipRefs(suite).map((ref) => path.join(root, ref.dir, ref.file));
}

async function main(): Promise<void> {
  const cli = parseReplayCli(process.argv.slice(2));
  const resolved = resolveBakeoffEngine(cli.engine);
  if (resolved.status === 'blocked') {
    console.error(JSON.stringify({
      engine: cli.engine,
      status: 'blocked',
      reason: resolved.reason,
      default: BAKEOFF_DEFAULT_ENGINE,
      note: 'Phase C does not swap the shipping TranscribeFn. Stay on Tilawa.',
    }, null, 2));
    process.exitCode = 1;
    return;
  }
  const engineId = resolved.engineId;
  const loadStart = performance.now();
  const engine = await createSession();
  const loadMs = performance.now() - loadStart;
  const rows: {
    suite: string;
    status: string;
    failureMode: string | null;
    bakeoff?: BakeoffClocks;
    outPath?: string;
  }[] = [];

  try {
    for (const name of BAKEOFF_SUITE_NAMES) {
      const suite = suiteBlueprint(name);
      const files = filesFor(suite);
      const missing = files.filter((file) => !fs.existsSync(file)).map((file) => path.relative(root, file));
      if (missing.length) {
        const status = suiteSkipsWhenClipMissing(suite) ? SKIPPED_PENDING : 'missing';
        console.error(`[${suite.label}] skip ${MISSING_FIXTURE} ${missing.join(', ')} (not PASS)`);
        rows.push({ suite: suite.label, status, failureMode: MISSING_FIXTURE });
        if (status !== SKIPPED_PENDING) process.exitCode = 1;
        continue;
      }
      const { report, outPath } = await replaySuite(suite, files, engine, rows.every((row) => !row.bakeoff) ? loadMs : 0, engineId);
      console.log(`[${suite.label}] bakeoff`, report.bakeoff);
      rows.push({
        suite: suite.label,
        status: report.failureMode ? 'fail' : 'pass',
        failureMode: report.failureMode,
        bakeoff: report.bakeoff,
        outPath,
      });
      if (report.failureMode) process.exitCode = 1;
    }

    if (fs.existsSync(HAFIZ_USAMA)) {
      const custom = {
        label: 'hafiz-usama',
        clips: [path.basename(HAFIZ_USAMA)],
        expect: [
          { surah: 1, ayah: 2 },
          { surah: 1, ayah: 3 },
          { surah: 1, ayah: 4 },
          { surah: 1, ayah: 5 },
          { surah: 1, ayah: 6 },
          { surah: 1, ayah: 7 },
          { surah: 27, ayah: 15 },
        ],
        gate: 'ordered-sequence' as const,
        description: 'Tip product-bar clip (Fatiha then An-Naml 27:15)',
      };
      const { report, outPath } = await replaySuite(custom, [HAFIZ_USAMA], engine, 0, engineId);
      console.log(`[${custom.label}] bakeoff`, report.bakeoff);
      rows.push({
        suite: custom.label,
        status: report.failureMode ? 'fail' : 'pass',
        failureMode: report.failureMode,
        bakeoff: report.bakeoff,
        outPath,
      });
      // Known product-bar miss (`product-hafiz-usama-27-15`). Measure clocks; do not fail the bakeoff harness.
    } else {
      console.error(`[hafiz-usama] skip ${MISSING_FIXTURE} (not PASS; restore npm run fixtures:imam)`);
      rows.push({ suite: 'hafiz-usama', status: SKIPPED_PENDING, failureMode: MISSING_FIXTURE });
    }
  } finally {
    await engine.runtime.release();
  }

  const follow = rows.map((row) => row.bakeoff).filter((clocks): clocks is BakeoffClocks => Boolean(clocks));
  const trackingP95 = follow.map((clocks) => clocks.trackingP95Ms).filter((ms): ms is number => ms != null);
  const skipRates = follow.map((clocks) => clocks.skipRate);
  const summary = {
    engineId,
    defaultEngine: BAKEOFF_DEFAULT_ENGINE,
    swappedDefault: false,
    streamingCandidateRan: false,
    streamingWinsFollow: streamingWinsFollow(
      { trackingP95Ms: trackingP95[0] ?? null, skipRate: skipRates[0] ?? 0 },
      { trackingP95Ms: null, skipRate: 0 },
    ),
    suites: rows,
    trackingP95Ms: trackingP95,
    skipRates,
    note: 'Control is Tilawa FastConformer. No legally usable streaming Quran-token TranscribeFn ran. Not a phone measurement.',
  };
  const outDir = path.join(root, 'artifacts/qa-runs');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `bakeoff-${engineId}.json`);
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ outPath, summary }, null, 2));
}

await main();
