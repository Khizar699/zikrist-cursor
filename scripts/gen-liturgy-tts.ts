/**
 * Synthesize 16 kHz mono PCM16 WAV for salah liturgy replay suites.
 *
 * Spoken text comes from `assets/content/salah-liturgy.json` (`arabic_uthmani`)
 * for the suite's expected phrase id. Destination is the harness clip path from
 * `prompts/salah-liturgy/manifest.stub.json`. Never writes a silent placeholder.
 *
 * Mac (Bot / Sim QA) — ready single-phrase suites (liturgy-takbeer, liturgy-thana):
 *   python3 -m pip install --user edge-tts
 *   npm run liturgy:tts -- liturgy-thana
 *   npm run test:replay -- liturgy-thana
 *
 * Fallback when edge-tts is unavailable or 403 (macOS):
 *   npm run liturgy:tts -- liturgy-thana --engine say
 *   (needs `say` + ffmpeg; prefers an Arabic voice such as Majed/Maged;
 *    writes the same dest as clip_path — filename stays stable)
 *
 * Audio stays gitignored under artifacts/recitation/liturgy/. Do not commit WAV/MP3.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  LITURGY_CLIP_DIR,
  SAMPLE_RATE,
  loadSalahLiturgyStubEntry,
  suiteBlueprint,
  type LiturgySuiteName,
} from './replay-suites';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACK_PATH = path.join(root, 'assets/content/salah-liturgy.json');
const DEFAULT_SUITE: LiturgySuiteName = 'liturgy-takbeer';
const EDGE_TTS_VOICE = 'ar-SA-HamedNeural';
const EDGE_TTS_RATE = '-25%';
const SAY_VOICE_CANDIDATES = ['Maged', 'Majed', 'Laila', 'Tarik', 'Mona'];
const MIN_DURATION_SECONDS = 0.25;
const MIN_RMS = 0.01;

export type LiturgyTtsEngine = 'auto' | 'edge-tts' | 'say';

export type LiturgyTtsPlan = {
  suiteId: LiturgySuiteName;
  phraseId: string;
  spokenArabic: string;
  recognitionArabic: string;
  destRelative: string;
  destAbsolute: string;
  preferredVoice: string;
};

export type SalahLiturgyPackFile = {
  phrases: {
    id: string;
    arabic_uthmani: string;
    arabic_recognition_normalized: string;
  }[];
};

export function parseLiturgyTtsArgs(argv: string[]): {
  help: boolean;
  dryRun: boolean;
  engine: LiturgyTtsEngine;
  voice?: string;
  rate?: string;
  suiteId: string;
} {
  const consumed = new Set<number>();
  let engine: LiturgyTtsEngine = 'auto';
  let voice: string | undefined;
  let rate: string | undefined;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]!;
    if (arg === '--engine') {
      const value = argv[index + 1];
      if (value === 'auto' || value === 'edge-tts' || value === 'say') engine = value;
      else throw new Error(`Unknown --engine ${value ?? '(missing)'}. Use auto | edge-tts | say.`);
      consumed.add(index);
      consumed.add(index + 1);
      continue;
    }
    if (arg === '--voice') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('Missing --voice name');
      voice = value;
      consumed.add(index);
      consumed.add(index + 1);
      continue;
    }
    if (arg === '--rate' || arg.startsWith('--rate=')) {
      const value = arg.startsWith('--rate=') ? arg.slice('--rate='.length) : argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('Missing --rate value (example: -25%)');
      rate = value;
      consumed.add(index);
      if (!arg.startsWith('--rate=')) consumed.add(index + 1);
    }
  }
  const flags = argv.filter((arg, index) => !consumed.has(index) && arg.startsWith('--'));
  const positional = argv.filter((arg, index) => !consumed.has(index) && !arg.startsWith('--'));
  return {
    help: flags.includes('--help') || flags.includes('-h'),
    dryRun: flags.includes('--dry-run'),
    engine,
    voice,
    rate,
    suiteId: positional[0] ?? DEFAULT_SUITE,
  };
}

export function loadLiturgyPack(packPath = PACK_PATH): SalahLiturgyPackFile {
  return JSON.parse(fs.readFileSync(packPath, 'utf8')) as SalahLiturgyPackFile;
}

export function spokenArabicForPhrase(pack: SalahLiturgyPackFile, phraseId: string): {
  arabic_uthmani: string;
  arabic_recognition_normalized: string;
} {
  const phrase = pack.phrases.find((row) => row.id === phraseId);
  if (!phrase) throw new Error(`Unknown liturgy phrase id "${phraseId}" in ${path.relative(root, PACK_PATH)}`);
  if (!phrase.arabic_uthmani.trim()) throw new Error(`Empty arabic_uthmani for ${phraseId}`);
  return {
    arabic_uthmani: phrase.arabic_uthmani,
    arabic_recognition_normalized: phrase.arabic_recognition_normalized,
  };
}

export function resolveLiturgyTtsPlan(suiteId: string, pack = loadLiturgyPack()): LiturgyTtsPlan {
  const entry = loadSalahLiturgyStubEntry(suiteId);
  if (entry.status !== 'ready') {
    throw new Error(
      `Suite ${suiteId} is still ${entry.status}. Flip status/clip_path in ${path.relative(root, 'prompts/salah-liturgy/manifest.stub.json')} first (one suite per fill session).`,
    );
  }
  const phraseId = entry.expect_phrase_ids[0];
  if (!phraseId) throw new Error(`Suite ${suiteId} has no expect_phrase_ids`);
  if (entry.expect_phrase_ids.length !== 1) {
    throw new Error(`This script synthesizes one liturgy phrase clip. ${suiteId} expects ${entry.expect_phrase_ids.join(',')}.`);
  }
  const arabic = spokenArabicForPhrase(pack, phraseId);
  const suite = suiteBlueprint(suiteId);
  const destRelative = path.join(suite.clipDir ?? LITURGY_CLIP_DIR, suite.clips[0]!);
  return {
    suiteId: suiteId as LiturgySuiteName,
    phraseId,
    spokenArabic: arabic.arabic_uthmani,
    recognitionArabic: arabic.arabic_recognition_normalized,
    destRelative,
    destAbsolute: path.join(root, destRelative),
    preferredVoice: EDGE_TTS_VOICE,
  };
}

export function inspectWav16kMonoPcm16(bytes: Buffer): { sampleRate: number; channels: number; bits: number; pcm: Buffer; durationSeconds: number } {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a WAV file');
  }
  let pcm: Buffer | undefined;
  let format: number | undefined;
  let channels: number | undefined;
  let sampleRate: number | undefined;
  let bits: number | undefined;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const id = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    if (id === 'fmt ') {
      format = bytes.readUInt16LE(offset + 8);
      channels = bytes.readUInt16LE(offset + 10);
      sampleRate = bytes.readUInt32LE(offset + 12);
      bits = bytes.readUInt16LE(offset + 22);
    }
    if (id === 'data') pcm = bytes.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + (size % 2);
  }
  if (!pcm || format === undefined || channels === undefined || sampleRate === undefined || bits === undefined) {
    throw new Error('Missing WAV data/format');
  }
  if (format !== 1 || channels !== 1 || sampleRate !== SAMPLE_RATE || bits !== 16) {
    throw new Error(`WAV must be 16 kHz mono PCM16 (got format=${format} ch=${channels} rate=${sampleRate} bits=${bits})`);
  }
  return {
    sampleRate,
    channels,
    bits,
    pcm,
    durationSeconds: pcm.length / 2 / sampleRate,
  };
}

export function pcmRms(pcm: Buffer): number {
  if (pcm.length < 2) return 0;
  let sum = 0;
  const samples = pcm.length / 2;
  for (let index = 0; index < pcm.length; index += 2) {
    const sample = pcm.readInt16LE(index) / 32768;
    sum += sample * sample;
  }
  return Math.sqrt(sum / samples);
}

export function assertSpokenClip(bytes: Buffer): { durationSeconds: number; rms: number } {
  const wav = inspectWav16kMonoPcm16(bytes);
  const rms = pcmRms(wav.pcm);
  if (wav.durationSeconds < MIN_DURATION_SECONDS) {
    throw new Error(`Clip too short (${wav.durationSeconds.toFixed(3)}s). Refusing silent/fake WAV.`);
  }
  if (rms < MIN_RMS) {
    throw new Error(`Clip RMS ${rms.toFixed(4)} looks silent. Refusing silent/fake WAV.`);
  }
  return { durationSeconds: wav.durationSeconds, rms };
}

function which(command: string): boolean {
  const result = spawnSync('which', [command], { encoding: 'utf8' });
  return result.status === 0;
}

function requireFfmpeg() {
  const result = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error('ffmpeg is required to write 16 kHz mono PCM16. Install ffmpeg, then retry.');
  }
}

function run(command: string, args: string[], options?: { cwd?: string }): string {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    cwd: options?.cwd,
    timeout: 120_000,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr || result.stdout || result.error?.message}`);
  }
  return result.stdout;
}

function convertToWav(input: string, output: string) {
  requireFfmpeg();
  run('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', input,
    '-ar', String(SAMPLE_RATE),
    '-ac', '1',
    '-c:a', 'pcm_s16le',
    output,
  ]);
}

function edgeTtsAvailable(): { bin: string; argsPrefix: string[] } | null {
  if (which('edge-tts')) return { bin: 'edge-tts', argsPrefix: [] };
  const py = spawnSync('python3', ['-m', 'edge_tts', '--help'], { encoding: 'utf8' });
  if (py.status === 0) return { bin: 'python3', argsPrefix: ['-m', 'edge_tts'] };
  return null;
}

function synthesizeEdgeTts(text: string, voice: string, destWav: string, rate = EDGE_TTS_RATE) {
  const edge = edgeTtsAvailable();
  if (!edge) {
    throw new Error(
      'edge-tts not found. On Mac: python3 -m pip install --user edge-tts\n'
      + 'Or retry with: npm run liturgy:tts -- <suite> --engine say',
    );
  }
  const tmp = path.join(os.tmpdir(), `zikrist-liturgy-tts-${process.pid}.mp3`);
  try {
    run(edge.bin, [...edge.argsPrefix, '--voice', voice, `--rate=${rate}`, '--text', text, '--write-media', tmp]);
    convertToWav(tmp, destWav);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

function listSayVoices(): string {
  const result = spawnSync('say', ['-v', '?'], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout : '';
}

function pickSayVoice(requested?: string): string {
  if (requested) return requested;
  const listed = listSayVoices();
  for (const name of SAY_VOICE_CANDIDATES) {
    if (listed.includes(name)) return name;
  }
  const arabic = listed.split('\n').find((line) => /\bar[_-]/i.test(line) || /arabic/i.test(line));
  if (arabic) return arabic.trim().split(/\s+/)[0]!;
  throw new Error(
    'No Arabic macOS say voice found (tried Maged/Laila/Tarik). Install an Arabic voice in System Settings, or use --engine edge-tts.',
  );
}

function synthesizeSay(text: string, voice: string, destWav: string) {
  if (!which('say')) {
    throw new Error('macOS `say` not found. Use --engine edge-tts on this machine.');
  }
  const tmp = path.join(os.tmpdir(), `zikrist-liturgy-tts-${process.pid}.aiff`);
  try {
    run('say', ['-v', voice, '-o', tmp, text]);
    convertToWav(tmp, destWav);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

export function helpText(): string {
  return [
    'Usage:',
    '  npm run liturgy:tts -- liturgy-takbeer',
    '  npm run liturgy:tts -- liturgy-thana',
    '  npm run liturgy:tts -- liturgy-thana --dry-run',
    '  npm run liturgy:tts -- liturgy-thana --engine edge-tts --voice ar-SA-HamedNeural --rate=-25%',
    '  npm run liturgy:tts -- liturgy-thana --engine say',
    '',
    'Reads pack arabic_uthmani (not a hardcoded English string). Writes 16 kHz mono PCM16',
    'to the suite clip_path (stable filename; --engine say uses the same dest).',
    'Audio is gitignored; do not commit WAV/MP3. Does not invent silence.',
  ].join('\n');
}

export async function generateLiturgyTts(options: {
  suiteId: string;
  engine: LiturgyTtsEngine;
  voice?: string;
  rate?: string;
  dryRun?: boolean;
}): Promise<{ plan: LiturgyTtsPlan; engineUsed?: string; voiceUsed?: string; rateUsed?: string; durationSeconds?: number; rms?: number }> {
  const plan = resolveLiturgyTtsPlan(options.suiteId);
  if (options.dryRun) return { plan };
  fs.mkdirSync(path.dirname(plan.destAbsolute), { recursive: true });
  const tmpOut = `${plan.destAbsolute}.${process.pid}.tmp.wav`;
  try {
    let engineUsed: string;
    let voiceUsed: string;
    let rateUsed: string | undefined;
    const edge = edgeTtsAvailable();
    if (options.engine === 'edge-tts' || (options.engine === 'auto' && edge)) {
      voiceUsed = options.voice ?? EDGE_TTS_VOICE;
      rateUsed = options.rate ?? EDGE_TTS_RATE;
      synthesizeEdgeTts(plan.spokenArabic, voiceUsed, tmpOut, rateUsed);
      engineUsed = 'edge-tts';
    } else if (options.engine === 'say' || (options.engine === 'auto' && which('say'))) {
      voiceUsed = pickSayVoice(options.voice);
      synthesizeSay(plan.spokenArabic, voiceUsed, tmpOut);
      engineUsed = 'say';
    } else {
      throw new Error(
        'No TTS engine. Mac: python3 -m pip install --user edge-tts\n'
        + `  npm run liturgy:tts -- ${options.suiteId}\n`
        + `Or: npm run liturgy:tts -- ${options.suiteId} --engine say`,
      );
    }
    const bytes = fs.readFileSync(tmpOut);
    const stats = assertSpokenClip(bytes);
    fs.renameSync(tmpOut, plan.destAbsolute);
    return { plan, engineUsed, voiceUsed, rateUsed, durationSeconds: stats.durationSeconds, rms: stats.rms };
  } finally {
    fs.rmSync(tmpOut, { force: true });
  }
}

async function main() {
  const args = parseLiturgyTtsArgs(process.argv.slice(2));
  if (args.help) {
    console.log(helpText());
    return;
  }
  const result = await generateLiturgyTts({
    suiteId: args.suiteId,
    engine: args.engine,
    voice: args.voice,
    rate: args.rate,
    dryRun: args.dryRun,
  });
  const payload = {
    suite: result.plan.suiteId,
    phraseId: result.plan.phraseId,
    spokenArabic: result.plan.spokenArabic,
    dest: result.plan.destRelative,
    dryRun: Boolean(args.dryRun),
    engineUsed: result.engineUsed ?? null,
    voiceUsed: result.voiceUsed ?? null,
    rateUsed: result.rateUsed ?? null,
    durationSeconds: result.durationSeconds ?? null,
    rms: result.rms ?? null,
    next: args.dryRun
      ? 'Re-run without --dry-run after installing edge-tts or using --engine say'
      : `npm run test:replay -- ${result.plan.suiteId}`,
  };
  console.log(JSON.stringify(payload, null, 2));
}

const invokedDirectly = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  await main();
}
