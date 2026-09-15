/**
 * Headless acoustic replay for Sim QA.
 * Feeds 16 kHz mono PCM through real ONNX + RecitationFollower (same path as live mic).
 * Faster-than-live desktop replay — not a phone/mic latency measurement.
 *
 * Usage:
 *   npm run test:replay
 *   npm run test:replay -- all
 *   npm run test:replay -- core
 *   npm run test:replay -- kawthar
 *   npm run test:replay -- --check-fixtures
 *   npm run test:replay -- --list
 *   npm run test:replay -- artifacts/recitation/112001.wav ...
 */
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import * as ort from 'onnxruntime-node';
import { createTilawaSession } from '@tilawa/core';
import { ContinuationGate } from '../src/core/continuation-gate';
import { RecitationFollower } from '../src/core/follower';
import {
  recentRecognitionCycles,
  resetRecognitionCycles,
} from '../src/core/recognition-clocks';
import { LIVE_STREAMING_CONFIG } from '../src/core/streaming';
import {
  ALL_SUITE_NAMES,
  SAMPLE_RATE,
  evaluateFailure,
  parseSuiteSelection,
  prepareSuiteAudio,
  suiteBlueprint,
  suiteHelpText,
  uniqueClipsForSuites,
  wrongSurahStats,
  type MatchRow,
  type SuiteBlueprint,
} from './replay-suites';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const recitationDir = path.join(root, 'artifacts/recitation');
const CHUNK = 4000; // 250 ms
const SPEECH_RMS = 0.005;

function readWav(file: string): Float32Array {
  const bytes = fs.readFileSync(file);
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`Supply a WAV file (16 kHz mono PCM16): ${file}`);
  }
  let data: Buffer | undefined;
  let format: number | undefined;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const id = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    if (id === 'fmt ') {
      format = bytes.readUInt16LE(offset + 8);
      const channels = bytes.readUInt16LE(offset + 10);
      const rate = bytes.readUInt32LE(offset + 12);
      const bits = bytes.readUInt16LE(offset + 22);
      if (format !== 1 || channels !== 1 || rate !== SAMPLE_RATE || bits !== 16) {
        throw new Error(`WAV must be 16 kHz mono PCM16: ${file}`);
      }
    }
    if (id === 'data') data = bytes.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + (size % 2);
  }
  if (!data || format === undefined) throw new Error(`Missing WAV data/format: ${file}`);
  return Float32Array.from({ length: data.length / 2 }, (_, index) => data!.readInt16LE(index * 2) / 32768);
}

function clipPath(clip: string): string {
  return path.join(recitationDir, clip);
}

function fixtureStatus(names: string[]) {
  return names.map((name) => {
    const suite = suiteBlueprint(name);
    const missing = suite.clips.filter((clip) => !fs.existsSync(clipPath(clip)));
    return {
      suite: name,
      ready: missing.length === 0,
      missing,
      clips: suite.clips,
      description: suite.description,
    };
  });
}

async function createSession() {
  const modelPath = path.join(root, 'assets/model/fastconformer_full_mixed.onnx');
  if (!fs.existsSync(modelPath)) {
    throw new Error('missing_onnx: run npm run assets:download before test:replay');
  }
  const runtime = await ort.InferenceSession.create(modelPath, {
    intraOpNumThreads: 2,
    interOpNumThreads: 1,
    enableCpuMemArena: false,
  });
  const assets = {
    vocab: JSON.parse(fs.readFileSync(path.join(root, 'assets/model/vocab.json'), 'utf8')),
    quran: JSON.parse(fs.readFileSync(path.join(root, 'assets/model/quran.json'), 'utf8')),
    quranCtcTokens: JSON.parse(fs.readFileSync(path.join(root, 'assets/model/quran_ctc_tokens.json'), 'utf8')),
  };
  const outputName = runtime.outputNames[0];
  if (!outputName) throw new Error('ONNX model has no output');
  const session = createTilawaSession({
    async run(pcm) {
      const out = await runtime.run({
        audio_signal: new ort.Tensor('float32', pcm, [1, pcm.length]),
        length: new ort.Tensor('int64', BigInt64Array.from([BigInt(pcm.length)]), [1]),
      });
      const result = out[outputName]!;
      return {
        logprobs: result.data as Float32Array,
        timeSteps: result.dims[1]!,
        vocabSize: result.dims[2]!,
      };
    },
  }, {
    vocab: assets.vocab,
    quran: assets.quran,
    quranCtcTokens: assets.quranCtcTokens,
    blankId: 1024,
  }, { config: LIVE_STREAMING_CONFIG });
  session.db.warmSearchIndexes();
  return { session, runtime };
}

type Engine = Awaited<ReturnType<typeof createSession>>;

async function replaySuite(
  suite: SuiteBlueprint,
  files: string[],
  engine: Engine,
  loadMs: number,
) {
  for (const file of files) {
    if (!fs.existsSync(file)) throw new Error(`missing_clip:${path.basename(file)}`);
  }
  const { audio, trailingSilenceSeconds } = prepareSuiteAudio(files.map(readWav), suite);
  const padded = new Float32Array(audio.length + Math.round(SAMPLE_RATE * trailingSilenceSeconds));
  padded.set(audio);

  resetRecognitionCycles();
  const follower = new RecitationFollower(engine.session.db, engine.session);
  const gate = new ContinuationGate((ref) => engine.session.db.getNextVerse(ref.surah, ref.ayah));

  const matches: MatchRow[] = [];
  let voicedMs = 0;
  const processing = performance.now();

  for (let index = 0; index < padded.length; index += CHUNK) {
    const end = Math.min(index + CHUNK, padded.length);
    const chunk = padded.subarray(index, end);
    let sum = 0;
    for (const sample of chunk) sum += sample * sample;
    const rms = Math.sqrt(sum / Math.max(1, chunk.length));
    const voiced = rms >= SPEECH_RMS;
    if (voiced) voicedMs += (chunk.length / SAMPLE_RATE) * 1000;
    // Match live mic: do not feed unvoiced frames into the follower. Trailing
    // pad after the clip is still fed so a final flush / stall-after-lock can run.
    if (!voiced && index < audio.length) continue;
    const raw = await follower.feed(chunk);
    const accepted = gate.accept(raw, voicedMs, voiced);
    if (process.env.ZIKRIST_TRACE === '1' && (raw.length || accepted.length)) {
      console.log(JSON.stringify({
        t: end / SAMPLE_RATE,
        rms,
        raw: raw.map((message) => message.type + (message.type === 'verse_match' ? `:${message.surah}:${message.ayah}` : '')),
        accepted: accepted.map((message) => message.type + (message.type === 'verse_match' ? `:${message.surah}:${message.ayah}` : '')),
      }));
    }
    const audioSeconds = Math.min(end, audio.length) / SAMPLE_RATE;
    for (const message of accepted) {
      if (message.type === 'verse_match') {
        const row = {
          surah: message.surah,
          ayah: message.ayah,
          audioSeconds: Math.round(audioSeconds * 1000) / 1000,
          score: message.confidence,
        };
        const last = matches.at(-1);
        if (!last || last.surah !== row.surah || last.ayah !== row.ayah) {
          matches.push(row);
          console.log(`[${suite.label}] confirmed`, row);
        }
      }
    }
  }

  const failureMode = evaluateFailure(matches, suite);
  const stats = wrongSurahStats(matches, suite.expect, suite.gate);
  const report = {
    suite: suite.label,
    gate: suite.gate,
    environment: `${process.platform}/${process.arch} onnxruntime-node ${ort.env.versions?.node ?? 'unknown'}; headless follower replay, not phone mic latency`,
    inputSeconds: audio.length / SAMPLE_RATE,
    trailingSilenceSeconds,
    trimStartSeconds: suite.trimStartSeconds ?? 0,
    loadMs,
    processingMs: performance.now() - processing,
    matches,
    firstLockSeconds: matches[0]?.audioSeconds ?? null,
    clocks: {
      recent: recentRecognitionCycles(),
      peakRssMb: process.resourceUsage().maxRSS / 1024,
    },
    failureMode,
    wrongSurahCount: stats.wrongSurahCount,
    wrongSurahRate: stats.wrongSurahRate,
    firstLockWrongSurah: stats.firstLockWrongSurah,
    files: files.map((file) => path.relative(root, file)),
  };

  const outDir = path.join(root, 'artifacts/qa-runs');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `replay-${suite.label}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(root, 'artifacts/benchmark-latest.json'), JSON.stringify(report, null, 2));
  return { report, outPath };
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(suiteHelpText());
  process.exit(0);
}
if (args.includes('--list')) {
  for (const name of ALL_SUITE_NAMES) {
    const suite = suiteBlueprint(name);
    console.log(`${name}\t${suite.description}`);
  }
  process.exit(0);
}

const wavArgs = args.filter((arg) => arg.endsWith('.wav') || arg.endsWith('.WAV'));
const namedArgs = args.filter((arg) => !arg.startsWith('--') && !arg.endsWith('.wav') && !arg.endsWith('.WAV'));
const selectedSuites = wavArgs.length && !namedArgs.length
  ? []
  : parseSuiteSelection(namedArgs);

if (args.includes('--check-fixtures')) {
  const names = selectedSuites.length ? selectedSuites : [...ALL_SUITE_NAMES];
  const status = fixtureStatus(names);
  const missingClips = [...new Set(status.flatMap((row) => row.missing))];
  console.log(JSON.stringify({
    recitationDir: path.relative(root, recitationDir),
    uniqueClips: uniqueClipsForSuites(names),
    missingClips,
    suites: status,
    restore: 'npm run fixtures:recitation',
  }, null, 2));
  if (missingClips.length) {
    console.error(`Missing ${missingClips.length} fixture(s). Run npm run fixtures:recitation`);
    process.exitCode = 1;
  }
  process.exit();
}

const results: { label: string; outPath: string; failureMode: string | null; wrongSurahRate: number }[] = [];
const loadStart = performance.now();
const engine = await createSession();
const loadMs = performance.now() - loadStart;
let firstLoadAssigned = false;

try {
  for (const file of wavArgs) {
    const custom: SuiteBlueprint = {
      label: 'custom',
      clips: [path.basename(file)],
      expect: [],
      gate: 'ordered-sequence',
      description: 'Ad-hoc WAV path',
    };
    const { report, outPath } = await replaySuite(custom, [path.resolve(file)], engine, firstLoadAssigned ? 0 : loadMs);
    firstLoadAssigned = true;
    results.push({
      label: 'custom',
      outPath,
      failureMode: report.failureMode,
      wrongSurahRate: report.wrongSurahRate,
    });
  }

  for (const name of selectedSuites) {
    const suite = suiteBlueprint(name);
    const files = suite.clips.map(clipPath);
    const { report, outPath } = await replaySuite(suite, files, engine, firstLoadAssigned ? 0 : loadMs);
    firstLoadAssigned = true;
    results.push({
      label: suite.label,
      outPath,
      failureMode: report.failureMode,
      wrongSurahRate: report.wrongSurahRate,
    });
  }
} finally {
  await engine.runtime.release();
}

console.log(JSON.stringify({ results }, null, 2));
const failed = results.filter((row) => row.failureMode);
if (failed.length) {
  console.error('Replay gate failed:', failed.map((row) => `${row.label}:${row.failureMode}`).join(', '));
  process.exitCode = 1;
}
