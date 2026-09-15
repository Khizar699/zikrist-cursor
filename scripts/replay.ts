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
 *   npm run test:replay -- real-imam
 *   npm run test:replay -- liturgy
 *   npm run test:replay -- salah-liturgy
 *   npm run test:replay -- --include-pending
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
  filterQuranMessagesForLiturgy,
  liturgyFollowContextBeforeFeed,
  matcherFromPack,
  packFromUnknown,
  type SalahLiturgyMatcher,
} from '../src/core/salah-liturgy-matcher';
import {
  ALL_SUITE_NAMES,
  DEFAULT_CLIP_DIR,
  LITURGY_SUITE_NAMES,
  MISSING_FIXTURE,
  REAL_IMAM_SUITE_NAMES,
  SAMPLE_RATE,
  SKIPPED_PENDING,
  evaluateFailure,
  isLiturgySuiteName,
  isRealImamSuiteName,
  parseReplayCli,
  parseSuiteSelection,
  prepareSuiteAudio,
  suiteBlueprint,
  suiteClipDirectory,
  suiteClipRefs,
  suiteHelpText,
  suiteSkipsWhenClipMissing,
  uniqueClipsForSuites,
  wrongSurahStats,
  type MatchRow,
  type PhraseLockRow,
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

function clipPath(clip: string, suite?: Pick<SuiteBlueprint, 'clipDir'>, dir?: string): string {
  return path.join(root, dir ?? suiteClipDirectory(suite ?? {}), clip);
}

function missingClips(suite: SuiteBlueprint): string[] {
  return suite.clips.filter((clip) => !fs.existsSync(clipPath(clip, suite)));
}

function missingQuranClips(suite: SuiteBlueprint): string[] {
  const dir = suite.quranClipDir ?? DEFAULT_CLIP_DIR;
  return (suite.quranClips ?? []).filter((clip) => !fs.existsSync(clipPath(clip, suite, dir)));
}

function runnableFiles(suite: SuiteBlueprint): string[] {
  return suiteClipRefs(suite).map((ref) => clipPath(ref.file, suite, ref.dir));
}

function convertHint(suite: SuiteBlueprint, wavClip: string): string | undefined {
  const mp3Clip = wavClip.replace(/\.wav$/i, '.mp3');
  const mp3Path = clipPath(mp3Clip, suite);
  if (!fs.existsSync(mp3Path)) return undefined;
  const wavPath = clipPath(wavClip, suite);
  return `found ${path.relative(root, mp3Path)}; convert: ffmpeg -y -i ${path.relative(root, mp3Path)} -ar 16000 -ac 1 -c:a pcm_s16le ${path.relative(root, wavPath)}`;
}

function writeReport(label: string, report: unknown): string {
  const outDir = path.join(root, 'artifacts/qa-runs');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `replay-${label.replace(/[/:]/g, '_')}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(root, 'artifacts/benchmark-latest.json'), JSON.stringify(report, null, 2));
  return outPath;
}

function fixtureStatus(names: string[]) {
  return names.map((name) => {
    const suite = suiteBlueprint(name);
    const missing = missingClips(suite);
    const missingQuran = missingQuranClips(suite);
    return {
      suite: name,
      ready: missing.length === 0 && missingQuran.length === 0,
      status: missing.length === 0
        ? (missingQuran.length === 0 ? 'ready' : 'missing')
        : (suiteSkipsWhenClipMissing(suite) ? SKIPPED_PENDING : 'missing'),
      missing,
      missingQuranClips: missingQuran,
      clips: suite.clips,
      quranClips: suite.quranClips ?? [],
      clipDir: suiteClipDirectory(suite),
      expectPhraseIds: suite.expectPhraseIds ?? [],
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

function createLiturgyMatcher(): SalahLiturgyMatcher {
  const data: unknown = JSON.parse(fs.readFileSync(path.join(root, 'assets/content/salah-liturgy.json'), 'utf8'));
  return matcherFromPack(packFromUnknown(data));
}

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
  // Default 14 Quran suites keep follower+gate only. Liturgy suites use the same
  // PCM → lastHeardTokens → SalahLiturgyMatcher path as live listening.
  const liturgyMatcher = suite.scoreLiturgy === true ? createLiturgyMatcher() : null;

  const matches: MatchRow[] = [];
  const phrases: PhraseLockRow[] = [];
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
    const prior = liturgyMatcher ? liturgyFollowContextBeforeFeed(follower) : null;
    const raw = await follower.feed(chunk);
    const audioSeconds = Math.round((Math.min(end, audio.length) / SAMPLE_RATE) * 1000) / 1000;
    let quran = raw;
    if (liturgyMatcher && prior) {
      const liturgy = liturgyMatcher.observe({
        tokens: follower.lastHeardTokens,
        atMs: audioSeconds * 1000,
        ...prior,
        voiced,
      });
      if (liturgy) {
        const lastPhrase = phrases.at(-1);
        if (!lastPhrase || lastPhrase.phraseId !== liturgy.phraseId) {
          phrases.push({
            phraseId: liturgy.phraseId,
            audioSeconds,
            confidence: liturgy.confidence,
          });
          console.log(`[${suite.label}] liturgy`, {
            phraseId: liturgy.phraseId,
            audioSeconds,
            confidence: liturgy.confidence,
          });
        }
        quran = filterQuranMessagesForLiturgy(raw);
        follower.reset();
        gate.reset();
      }
    }
    const accepted = gate.accept(quran, voicedMs, voiced);
    if (process.env.ZIKRIST_TRACE === '1' && (raw.length || accepted.length || phrases.length)) {
      console.log(JSON.stringify({
        t: end / SAMPLE_RATE,
        rms,
        raw: raw.map((message) => message.type + (message.type === 'verse_match' ? `:${message.surah}:${message.ayah}` : '')),
        accepted: accepted.map((message) => message.type + (message.type === 'verse_match' ? `:${message.surah}:${message.ayah}` : '')),
        liturgy: phrases.at(-1)?.phraseId ?? null,
      }));
    }
    for (const message of accepted) {
      if (message.type === 'verse_match') {
        const row = {
          surah: message.surah,
          ayah: message.ayah,
          audioSeconds,
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

  const failureMode = evaluateFailure(matches, suite, phrases);
  const stats = wrongSurahStats(matches, suite.expect, suite.gate);
  const lastPhrase = phrases.at(-1);
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
    phrases,
    phraseId: lastPhrase?.phraseId ?? null,
    audioSeconds: lastPhrase?.audioSeconds ?? null,
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

  const outPath = writeReport(suite.label, report);
  return { report, outPath };
}

type ResultRow = {
  label: string;
  outPath: string;
  failureMode: string | null;
  wrongSurahRate: number;
  status?: string;
};

function recordMissingFixture(suite: SuiteBlueprint, missing: string[]): ResultRow {
  const hints = missing.map((clip) => convertHint(suite, clip)).filter((hint): hint is string => Boolean(hint));
  const report = {
    suite: suite.label,
    status: SKIPPED_PENDING,
    gate: suite.gate,
    failureMode: MISSING_FIXTURE,
    phraseId: null,
    audioSeconds: null,
    phrases: [] as PhraseLockRow[],
    expectPhraseIds: suite.expectPhraseIds ?? [],
    missingClips: missing,
    convertHints: hints,
    matches: [],
    firstLockSeconds: null,
    wrongSurahCount: 0,
    wrongSurahRate: 0,
    firstLockWrongSurah: false,
    clipDir: suiteClipDirectory(suite),
    quranClips: suite.quranClips ?? [],
    expectedLocksPath: suite.expectedLocksPath ?? null,
    description: suite.description,
  };
  const outPath = writeReport(suite.label, report);
  console.error(`[${suite.label}] skip ${MISSING_FIXTURE} ${missing.join(', ')}${hints.length ? ` (${hints.join('; ')})` : ''} (not PASS)`);
  return {
    label: suite.label,
    outPath,
    failureMode: MISSING_FIXTURE,
    wrongSurahRate: 0,
    status: SKIPPED_PENDING,
  };
}

const cli = parseReplayCli(process.argv.slice(2));
if (cli.help) {
  console.log(suiteHelpText());
  process.exit(0);
}
if (cli.list) {
  console.log('Ready (default all, 14 suites):');
  for (const name of ALL_SUITE_NAMES) {
    const suite = suiteBlueprint(name);
    console.log(`${name}\tready\t${suite.description}`);
  }
  console.log('Pending real-imam (`npm run test:replay -- real-imam`; stubs skip with missing_fixture, not PASS):');
  for (const name of REAL_IMAM_SUITE_NAMES) {
    const suite = suiteBlueprint(name);
    const missing = missingClips(suite);
    const status = missing.length ? SKIPPED_PENDING : 'ready';
    console.log(`${name}\t${status}\t${suite.description}`);
  }
  console.log('Salah liturgy (`npm run test:replay -- liturgy`; stubs skip missing_fixture; ready suites need generated WAV):');
  for (const name of LITURGY_SUITE_NAMES) {
    const suite = suiteBlueprint(name);
    const missing = missingClips(suite);
    const status = missing.length
      ? (suiteSkipsWhenClipMissing(suite) ? SKIPPED_PENDING : 'missing')
      : 'ready';
    console.log(`${name}\t${status}\t${suite.description}`);
  }
  process.exit(0);
}

const selectedSuites = cli.wavArgs.length && !cli.namedArgs.length
  ? []
  : parseSuiteSelection(cli.namedArgs, { includePending: cli.includePending });

if (cli.checkFixtures) {
  const names = selectedSuites.length ? selectedSuites : [...ALL_SUITE_NAMES];
  const status = fixtureStatus(names);
  const missing = [...new Set(status.flatMap((row) => row.missing))];
  const pendingOnly = names.length > 0 && names.every((name) => suiteSkipsWhenClipMissing(suiteBlueprint(name)));
  const liturgyOnly = names.length > 0 && names.every((name) => isLiturgySuiteName(name));
  const imamOnly = names.length > 0 && names.every((name) => isRealImamSuiteName(name));
  const restore = liturgyOnly
    ? 'Ready: npm run liturgy:tts -- liturgy-takbeer or liturgy-thana --engine say (Mac; ffmpeg on PATH e.g. /tmp/ffmpeg-static; say Majed ar_001). Stubs skip missing_fixture until their fill session. Mixed suites reuse EveryAyah Fatiha WAVs from artifacts/recitation/ after npm run fixtures:recitation. Do not invent silent WAVs.'
    : imamOnly
      ? 'Drop 16 kHz mono WAV under artifacts/recitation/imam/<suite-id>/<qari>/ from ~/Desktop/zikrist-imam-clips/ (prompts/real-imam/FIXTURES.md)'
      : 'npm run fixtures:recitation';
  console.log(JSON.stringify({
    recitationDir: path.relative(root, recitationDir),
    uniqueClips: uniqueClipsForSuites(names),
    missingClips: missing,
    suites: status,
    restore,
  }, null, 2));
  const blocking = status.filter((row) => row.missing.length && row.status !== SKIPPED_PENDING);
  if (pendingOnly && missing.length) {
    const pack = liturgyOnly ? 'salah-liturgy' : imamOnly ? 'real-imam' : 'pending';
    console.error(`skip missing_fixture: ${missing.length} ${pack} clip(s) (not PASS).`);
  } else if (blocking.length) {
    const blockingClips = [...new Set(blocking.flatMap((row) => row.missing))];
    console.error(`Missing ${blockingClips.length} fixture(s). Run npm run fixtures:recitation`);
    process.exitCode = 1;
  }
  process.exit();
}

const results: ResultRow[] = [];
const runnable: { suite: SuiteBlueprint; files: string[] }[] = [];

for (const name of selectedSuites) {
  const suite = suiteBlueprint(name);
  const missing = missingClips(suite);
  if (missing.length) {
    if (suiteSkipsWhenClipMissing(suite)) {
      results.push(recordMissingFixture(suite, missing));
      continue;
    }
    const hint = suite.scoreLiturgy === true
      ? `. Generate with: npm run liturgy:tts -- ${suite.label}`
      : '';
    throw new Error(`missing_clip:${missing.map((clip) => path.basename(clip)).join(',')}${hint}`);
  }
  const missingQuran = missingQuranClips(suite);
  if (missingQuran.length) {
    throw new Error(`missing_clip:${missingQuran.map((clip) => path.basename(clip)).join(',')}`);
  }
  runnable.push({ suite, files: runnableFiles(suite) });
}

const needsEngine = cli.wavArgs.length > 0 || runnable.length > 0;
let engine: Engine | undefined;
let loadMs = 0;
let firstLoadAssigned = false;

try {
  if (needsEngine) {
    const loadStart = performance.now();
    engine = await createSession();
    loadMs = performance.now() - loadStart;
  }

  for (const file of cli.wavArgs) {
    if (!engine) throw new Error('missing_onnx');
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

  for (const item of runnable) {
    if (!engine) throw new Error('missing_onnx');
    const trials = item.suite.clipRunMode === 'each-clip'
      ? item.suite.clips.map((clip, index) => ({
        suite: {
          ...item.suite,
          label: `${item.suite.label}:${path.basename(clip, path.extname(clip))}`,
          clips: [clip],
        },
        files: [item.files[index]!],
      }))
      : [item];
    for (const trial of trials) {
      const { report, outPath } = await replaySuite(trial.suite, trial.files, engine, firstLoadAssigned ? 0 : loadMs);
      firstLoadAssigned = true;
      results.push({
        label: trial.suite.label,
        outPath,
        failureMode: report.failureMode,
        wrongSurahRate: report.wrongSurahRate,
      });
    }
  }
} finally {
  await engine?.runtime.release();
}

console.log(JSON.stringify({ results }, null, 2));
const skipped = results.filter((row) => row.status === SKIPPED_PENDING);
const failed = results.filter((row) => row.failureMode && row.status !== SKIPPED_PENDING);
if (skipped.length) {
  console.error('Skipped pending (missing_fixture, not PASS):', skipped.map((row) => row.label).join(', '));
}
if (failed.length) {
  console.error('Replay gate failed:', failed.map((row) => `${row.label}:${row.failureMode}`).join(', '));
  process.exitCode = 1;
}
