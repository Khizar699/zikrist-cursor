/**
 * Headless acoustic replay for Sim QA.
 * Feeds 16 kHz mono PCM through real ONNX + RecitationFollower (same path as live mic).
 * Faster-than-live desktop replay — not a phone/mic latency measurement.
 *
 * Usage:
 *   npm run test:replay
 *   npm run test:replay -- fatiha
 *   npm run test:replay -- ikhlas
 *   npm run test:replay -- nas
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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAMPLE_RATE = 16000;
const CHUNK = 4000; // 250 ms
const SPEECH_RMS = 0.005;

type MatchRow = { surah: number; ayah: number; audioSeconds: number; score: number };

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

function concatWavs(files: string[]): Float32Array {
  const chunks = files.map(readWav);
  const audio = new Float32Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    audio.set(chunk, offset);
    offset += chunk.length;
  }
  return audio;
}

function suiteFiles(name: string): { label: string; files: string[]; expect?: { surah: number; ayah: number }[] } {
  const rec = path.join(root, 'artifacts/recitation');
  if (name === 'fatiha') {
    const files = [1, 2, 3, 4, 5, 6, 7].map((ayah) => path.join(rec, `00100${ayah}.wav`));
    return {
      label: 'fatiha',
      files,
      expect: [
        { surah: 1, ayah: 2 },
        { surah: 1, ayah: 3 },
        { surah: 1, ayah: 4 },
        { surah: 1, ayah: 5 },
        { surah: 1, ayah: 6 },
        { surah: 1, ayah: 7 },
      ],
    };
  }
  if (name === 'ikhlas') {
    return {
      label: 'ikhlas',
      files: [1, 2, 3, 4].map((ayah) => path.join(rec, `11200${ayah}.wav`)),
      expect: [
        { surah: 112, ayah: 1 },
        { surah: 112, ayah: 2 },
        { surah: 112, ayah: 3 },
        { surah: 112, ayah: 4 },
      ],
    };
  }
  if (name === 'nas') {
    return {
      label: 'nas',
      files: [1, 2, 3, 4, 5, 6].map((ayah) => path.join(rec, `11400${ayah}.wav`)),
      expect: [
        { surah: 114, ayah: 1 },
        { surah: 114, ayah: 2 },
        { surah: 114, ayah: 3 },
        { surah: 114, ayah: 4 },
        { surah: 114, ayah: 5 },
        { surah: 114, ayah: 6 },
      ],
    };
  }
  if (name === 'kawthar') {
    return {
      label: 'kawthar',
      files: [1, 2, 3].map((ayah) => path.join(rec, `10800${ayah}.wav`)),
      expect: [1, 2, 3].map((ayah) => ({ surah: 108, ayah })),
    };
  }
  if (name === 'falaq') {
    return {
      label: 'falaq',
      files: [1, 2, 3, 4, 5].map((ayah) => path.join(rec, `11300${ayah}.wav`)),
      expect: [1, 2, 3, 4, 5].map((ayah) => ({ surah: 113, ayah })),
    };
  }
  if (name === 'asr') {
    return {
      label: 'asr',
      files: [1, 2, 3].map((ayah) => path.join(rec, `10300${ayah}.wav`)),
      expect: [1, 2, 3].map((ayah) => ({ surah: 103, ayah })),
    };
  }
  if (name === 'quraysh') {
    return {
      label: 'quraysh',
      files: [1, 2, 3, 4].map((ayah) => path.join(rec, `10600${ayah}.wav`)),
      expect: [1, 2, 3, 4].map((ayah) => ({ surah: 106, ayah })),
    };
  }
  throw new Error(`Unknown suite "${name}". Use fatiha | ikhlas | nas | kawthar | falaq | asr | quraysh | wav paths.`);
}

function evaluateFailure(
  matches: MatchRow[],
  expect?: { surah: number; ayah: number }[],
): string | null {
  if (!expect?.length) return matches.length ? null : 'no_matches';
  if (!matches.length) return 'no_matches';
  const first = matches[0]!;
  if (expect[0]!.surah === 1 && expect[0]!.ayah === 2) {
    if (first.surah === 14 && (first.ayah === 39 || first.ayah === 40)) {
      return `first_lock_ibrahim_${first.surah}:${first.ayah}`;
    }
    if (first.surah !== 1 || first.ayah !== 2) {
      return `first_lock_${first.surah}:${first.ayah}_expected_1:2`;
    }
  }
  for (let index = 0; index < expect.length; index++) {
    const want = expect[index]!;
    const got = matches[index];
    if (!got) return `stall_missing_${want.surah}:${want.ayah}_after_${matches.length}_matches`;
    if (got.surah !== want.surah || got.ayah !== want.ayah) {
      return `sequence_break_at_${index}_got_${got.surah}:${got.ayah}_expected_${want.surah}:${want.ayah}`;
    }
  }
  return null;
}

async function createSession() {
  const modelPath = path.join(root, 'assets/model/fastconformer_full_mixed.onnx');
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

async function replaySuite(label: string, files: string[], expect?: { surah: number; ayah: number }[]) {
  for (const file of files) {
    if (!fs.existsSync(file)) throw new Error(`missing_clip:${path.basename(file)}`);
  }
  const audio = concatWavs(files);
  const padded = new Float32Array(audio.length + SAMPLE_RATE * 2);
  padded.set(audio);

  const loadStart = performance.now();
  const { session, runtime } = await createSession();
  const loadMs = performance.now() - loadStart;
  resetRecognitionCycles();
  const follower = new RecitationFollower(session.db, session);
  const gate = new ContinuationGate((ref) => session.db.getNextVerse(ref.surah, ref.ayah));

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
    // pad after the clip is still fed so a final flush can run.
    if (!voiced && index < audio.length) continue;
    const raw = await follower.feed(chunk);
    const accepted = gate.accept(raw, voicedMs, voiced);
    if (process.env.ZIKRIST_TRACE === '1' && (raw.length || accepted.length)) {
      console.log(JSON.stringify({ t: end / SAMPLE_RATE, rms, raw: raw.map((m) => m.type + (m.type === 'verse_match' ? `:${m.surah}:${m.ayah}` : '')), accepted: accepted.map((m) => m.type + (m.type === 'verse_match' ? `:${m.surah}:${m.ayah}` : '')) }));
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
          console.log(`[${label}] confirmed`, row);
        }
      }
    }
  }

  const failureMode = evaluateFailure(matches, expect);
  const report = {
    suite: label,
    environment: `${process.platform}/${process.arch} onnxruntime-node ${ort.env.versions?.node ?? 'unknown'}; headless follower replay, not phone mic latency`,
    inputSeconds: audio.length / SAMPLE_RATE,
    loadMs,
    processingMs: performance.now() - processing,
    matches,
    firstLockSeconds: matches[0]?.audioSeconds ?? null,
    clocks: {
      recent: recentRecognitionCycles(),
      peakRssMb: process.resourceUsage().maxRSS / 1024,
    },
    failureMode,
    files: files.map((file) => path.relative(root, file)),
  };

  const outDir = path.join(root, 'artifacts/qa-runs');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `replay-${label}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(root, 'artifacts/benchmark-latest.json'), JSON.stringify(report, null, 2));
  await runtime.release();
  return { report, outPath };
}

const args = process.argv.slice(2);
const suites = args.length === 0 ? ['fatiha', 'ikhlas', 'nas', 'kawthar', 'falaq', 'asr', 'quraysh'] : args;
const results: { label: string; outPath: string; failureMode: string | null }[] = [];

for (const arg of suites) {
  if (arg.endsWith('.wav') || arg.endsWith('.WAV')) {
    const { report, outPath } = await replaySuite('custom', [path.resolve(arg)]);
    results.push({ label: 'custom', outPath, failureMode: report.failureMode });
    continue;
  }
  const suite = suiteFiles(arg);
  const { report, outPath } = await replaySuite(suite.label, suite.files, suite.expect);
  results.push({ label: suite.label, outPath, failureMode: report.failureMode });
}

console.log(JSON.stringify({ results }, null, 2));
const failed = results.filter((row) => row.failureMode);
if (failed.length) {
  console.error('Replay gate failed:', failed.map((row) => `${row.label}:${row.failureMode}`).join(', '));
  process.exitCode = 1;
}
