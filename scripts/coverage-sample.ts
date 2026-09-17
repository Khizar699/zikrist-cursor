/**
 * Tier A stratified mushaf cold-start coverage.
 * Prints honest M/N and upserts open findings into prompts/real-imam/findings/ledger.jsonl.
 *
 *   npm run test:coverage -- --list
 *   npm run test:coverage -- --dry-run
 *   npm run test:coverage
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import * as ort from 'onnxruntime-node';
import { createTilawaSession } from '@tilawa/core';
import { RecitationFollower } from '../src/core/follower';
import { ContinuationGate } from '../src/core/continuation-gate';
import { LIVE_STREAMING_CONFIG } from '../src/core/streaming';
import { resetRecognitionCycles } from '../src/core/recognition-clocks';
import {
  SAMPLE_RATE,
  DEFAULT_TRAILING_SILENCE_SECONDS,
  type MatchRow,
  type SuiteBlueprint,
  prepareSuiteAudio,
} from './replay-suites';
import {
  TIER_A_COLD_STARTS,
  classifyColdStart,
  coverageFindingId,
  appendFinding,
  type FindingRow,
  type CoverageSample,
} from './lib/findings';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const recitationDir = path.join(root, 'artifacts/recitation');
const CHUNK = Math.round(SAMPLE_RATE * 0.4);
const SPEECH_RMS = 0.01;
const EVERYAYAH = 'https://everyayah.com/data/Alafasy_128kbps';
const EVERYAYAH_FALLBACK = 'https://verses.quran.com/Alafasy/mp3';

const args = process.argv.slice(2);
const listOnly = args.includes('--list');
const dryRun = args.includes('--dry-run');
const noDownload = args.includes('--no-download');

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

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Zikrist/0.1 (coverage sample)' },
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

function convertToWav(input: string, output: string) {
  const result = spawnSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', input,
    '-ar', String(SAMPLE_RATE),
    '-ac', '1',
    '-c:a', 'pcm_s16le',
    output,
  ], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed for ${path.basename(input)}: ${result.stderr || result.stdout}`);
  }
}

async function ensureVerseClip(id: string): Promise<'exists' | 'downloaded' | 'missing'> {
  const wav = path.join(recitationDir, `${id}.wav`);
  if (fs.existsSync(wav) && fs.statSync(wav).size > 1000) return 'exists';
  if (noDownload || dryRun) return 'missing';
  fs.mkdirSync(recitationDir, { recursive: true });
  const ffmpeg = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (ffmpeg.status !== 0) throw new Error('ffmpeg required to download coverage clips');
  const mp3 = path.join(recitationDir, `${id}.mp3`);
  let bytes: Buffer | undefined;
  let lastError: unknown;
  for (const url of [`${EVERYAYAH}/${id}.mp3`, `${EVERYAYAH_FALLBACK}/${id}.mp3`]) {
    try {
      bytes = await download(url);
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!bytes) {
    console.error(`coverage: download failed for ${id}`, lastError);
    return 'missing';
  }
  fs.writeFileSync(mp3, bytes);
  convertToWav(mp3, wav);
  return 'downloaded';
}

async function createSession() {
  const modelPath = path.join(root, 'assets/model/fastconformer_full_mixed.onnx');
  if (!fs.existsSync(modelPath)) {
    throw new Error('missing_onnx: run npm run setup (or assets:download) before test:coverage');
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

async function replayColdStart(
  sample: CoverageSample,
  file: string,
  engine: Awaited<ReturnType<typeof createSession>>,
): Promise<MatchRow[]> {
  const suite: SuiteBlueprint = {
    label: `coverage-${sample.id}`,
    clips: [path.basename(file)],
    expect: [{ surah: sample.surah, ayah: sample.ayah }],
    gate: 'ordered-sequence',
    description: sample.notes,
  };
  const { audio, trailingSilenceSeconds } = prepareSuiteAudio([readWav(file)], suite);
  const padded = new Float32Array(audio.length + Math.round(SAMPLE_RATE * (trailingSilenceSeconds || DEFAULT_TRAILING_SILENCE_SECONDS)));
  padded.set(audio);
  resetRecognitionCycles();
  const follower = new RecitationFollower(engine.session.db, engine.session);
  const gate = new ContinuationGate((ref) => engine.session.db.getNextVerse(ref.surah, ref.ayah));
  const matches: MatchRow[] = [];
  let voicedMs = 0;
  for (let index = 0; index < padded.length; index += CHUNK) {
    const end = Math.min(index + CHUNK, padded.length);
    const chunk = padded.subarray(index, end);
    let sum = 0;
    for (const sampleValue of chunk) sum += sampleValue * sampleValue;
    const rms = Math.sqrt(sum / Math.max(1, chunk.length));
    const voiced = rms >= SPEECH_RMS;
    if (voiced) voicedMs += (chunk.length / SAMPLE_RATE) * 1000;
    if (!voiced && index < audio.length) continue;
    const raw = await follower.feed(chunk);
    const audioSeconds = Math.round((Math.min(end, audio.length) / SAMPLE_RATE) * 1000) / 1000;
    const accepted = gate.accept(raw, voicedMs, voiced);
    for (const message of accepted) {
      if (message.type !== 'verse_match') continue;
      const row = {
        surah: message.surah,
        ayah: message.ayah,
        audioSeconds,
        score: message.confidence,
      };
      const last = matches.at(-1);
      if (!last || last.surah !== row.surah || last.ayah !== row.ayah) matches.push(row);
    }
  }
  return matches;
}

function printList() {
  console.log('Tier A cold-start sample (coverage scoreboard, not merge floor):\n');
  for (const sample of TIER_A_COLD_STARTS) {
    console.log(`${sample.id}\t${sample.surah}:${sample.ayah}\t${sample.region}\t${sample.notes}`);
  }
  console.log(`\nN=${TIER_A_COLD_STARTS.length}. Run without --list on Mac after npm run setup.`);
}

async function main() {
  if (listOnly) {
    printList();
    return;
  }

  const env = `${process.platform}/${process.arch}`;
  let pass = 0;
  let fail = 0;
  let skipped = 0;
  const rows: Array<{ id: string; want: string; got: string; status: string; class?: string }> = [];

  if (dryRun) {
    for (const sample of TIER_A_COLD_STARTS) {
      const wav = path.join(recitationDir, `${sample.id}.wav`);
      const ready = fs.existsSync(wav) && fs.statSync(wav).size > 1000;
      if (ready) {
        rows.push({ id: sample.id, want: `${sample.surah}:${sample.ayah}`, got: '(not replayed)', status: 'fixture_ready' });
      } else {
        skipped += 1;
        rows.push({ id: sample.id, want: `${sample.surah}:${sample.ayah}`, got: 'missing_fixture', status: 'skip' });
      }
    }
    console.log(JSON.stringify({
      tier: 'A',
      mode: 'dry-run',
      environment: env,
      sampleSize: TIER_A_COLD_STARTS.length,
      fixtureReady: TIER_A_COLD_STARTS.length - skipped,
      missingFixtures: skipped,
      score: null,
      note: 'dry-run does not measure recognition; run without --dry-run on Mac with ONNX',
      rows,
    }, null, 2));
    return;
  }

  let engine: Awaited<ReturnType<typeof createSession>> | undefined;
  try {
    engine = await createSession();
    for (const sample of TIER_A_COLD_STARTS) {
      const clipStatus = await ensureVerseClip(sample.id);
      const wav = path.join(recitationDir, `${sample.id}.wav`);
      if (clipStatus === 'missing' || !fs.existsSync(wav)) {
        skipped += 1;
        const finding: FindingRow = {
          finding_id: coverageFindingId(sample),
          status: 'open',
          class: 'missing_fixture',
          owner: 'fixture',
          want: [{ surah: sample.surah, ayah: sample.ayah }],
          got: [],
          source: 'coverage_tier_a',
          suite_or_clip: `${sample.id}.wav`,
          clip_class: sample.clip_class,
          created_at: new Date().toISOString(),
          notes: `Tier A dry miss fixture for ${sample.notes}`,
          closed_by: null,
          environment: env,
        };
        appendFinding(finding);
        rows.push({ id: sample.id, want: `${sample.surah}:${sample.ayah}`, got: 'missing_fixture', status: 'skip', class: 'missing_fixture' });
        continue;
      }

      const started = performance.now();
      const matches = await replayColdStart(sample, wav, engine);
      const elapsed = Math.round(performance.now() - started);
      const want = { surah: sample.surah, ayah: sample.ayah };
      const verdict = classifyColdStart(want, matches);
      const gotLabel = matches[0] ? `${matches[0].surah}:${matches[0].ayah}` : 'none';
      if (verdict.ok) {
        pass += 1;
        rows.push({ id: sample.id, want: `${want.surah}:${want.ayah}`, got: gotLabel, status: 'pass' });
      } else {
        fail += 1;
        const finding: FindingRow = {
          finding_id: coverageFindingId(sample),
          status: 'open',
          class: verdict.class,
          owner: verdict.owner,
          want: [want],
          got: matches.map((row) => ({
            surah: row.surah,
            ayah: row.ayah,
            at_seconds: row.audioSeconds,
          })),
          source: 'coverage_tier_a',
          suite_or_clip: `${sample.id}.wav`,
          clip_class: sample.clip_class,
          created_at: new Date().toISOString(),
          notes: `Tier A cold-start fail (${sample.notes}); ${elapsed}ms`,
          closed_by: null,
          environment: env,
        };
        appendFinding(finding);
        rows.push({
          id: sample.id,
          want: `${want.surah}:${want.ayah}`,
          got: gotLabel,
          status: 'fail',
          class: verdict.class,
        });
      }
    }
  } finally {
    await engine?.runtime.release();
  }

  const measured = pass + fail;
  const summary = {
    tier: 'A',
    mode: 'replay',
    environment: env,
    sampleSize: TIER_A_COLD_STARTS.length,
    pass,
    fail,
    skippedMissingFixture: skipped,
    score: measured === 0 ? null : `${pass}/${measured}`,
    note: 'Coverage scoreboard only — not the 14-suite merge floor. Floor restore (jump + english-negative) remains P0.',
    rows,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (fail > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
