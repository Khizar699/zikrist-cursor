/**
 * Restore EveryAyah/Alafasy evaluation clips (SSSAAA.wav) plus english-negative.
 * Gitignores artifacts/; this is the committed path to get fixtures onto a machine.
 *
 * An accessible EveryAyah URL is not a redistribution or training grant.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGLISH_NEGATIVE_CLIP, SAMPLE_RATE, verseClipIdsFromSuites } from './replay-suites';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const recitationDir = path.join(root, 'artifacts/recitation');
const EVERYAYAH = 'https://everyayah.com/data/Alafasy_128kbps';
const EVERYAYAH_FALLBACK = 'https://verses.quran.com/Alafasy/mp3';
const OPEN_SPEECH_ENGLISH = 'https://www.voiptroubleshooter.com/open_speech/american/OSR_us_000_0010_8k.wav';
const USER_AGENT = 'Zikrist/0.1 (evaluation replay fixtures)';

function requireFfmpeg() {
  const result = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error('ffmpeg is required to convert recitation fixtures to 16 kHz mono PCM16');
  }
}

async function download(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
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

async function ensureVerseClip(id: string) {
  const wav = path.join(recitationDir, `${id}.wav`);
  const mp3 = path.join(recitationDir, `${id}.mp3`);
  if (fs.existsSync(wav) && fs.statSync(wav).size > 1000) return 'exists';
  let bytes: Buffer | undefined;
  const urls = [`${EVERYAYAH}/${id}.mp3`, `${EVERYAYAH_FALLBACK}/${id}.mp3`];
  let lastError: unknown;
  for (const url of urls) {
    try {
      bytes = await download(url);
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!bytes) throw lastError ?? new Error(`failed to download ${id}`);
  fs.writeFileSync(mp3, bytes);
  convertToWav(mp3, wav);
  return 'downloaded';
}

function synthesizeEnglish(destination: string): boolean {
  const espeak = spawnSync('espeak-ng', ['--version'], { encoding: 'utf8' });
  if (espeak.status !== 0) return false;
  const raw = destination.replace(/\.wav$/i, '.espeak.wav');
  const spoken = [
    'This is an ordinary English conversation about weather, traffic, and weekend plans.',
    'There is no Quran recitation here.',
    'How was your commute this morning?',
  ].join(' ');
  const spokenResult = spawnSync('espeak-ng', [
    '-v', 'en-us',
    '-s', '140',
    '-w', raw,
    spoken,
  ], { encoding: 'utf8' });
  if (spokenResult.status !== 0) return false;
  convertToWav(raw, destination);
  fs.rmSync(raw, { force: true });
  return true;
}

async function ensureEnglishNegative() {
  const wav = path.join(recitationDir, ENGLISH_NEGATIVE_CLIP);
  if (fs.existsSync(wav) && fs.statSync(wav).size > 1000) return 'exists';
  if (synthesizeEnglish(wav)) return 'synthesized';
  const source = path.join(recitationDir, 'english-negative-source.wav');
  fs.writeFileSync(source, await download(OPEN_SPEECH_ENGLISH));
  convertToWav(source, wav);
  return 'downloaded-open-speech';
}

function writeSourceNotice() {
  const text = [
    'Evaluation-only recitation fixtures. Not bundled with the app. Gitignored under artifacts/.',
    '',
    `Reciter clips: Mishary Rashid Alafasy via EveryAyah (${EVERYAYAH}/SSSAAA.mp3).`,
    'Converted locally with ffmpeg to 16 kHz mono PCM16 WAV.',
    'english-negative.wav: espeak-ng synthesis when available, otherwise Open Speech Repository English.',
    'An accessible URL is not permission to train or redistribute a dataset.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(recitationDir, 'SOURCE.txt'), text);
}

fs.mkdirSync(recitationDir, { recursive: true });
requireFfmpeg();

const ids = verseClipIdsFromSuites();
const summary: Record<string, string> = {};
for (const id of ids) {
  process.stdout.write(`fixture ${id} ... `);
  const status = await ensureVerseClip(id);
  summary[id] = status;
  console.log(status);
}
process.stdout.write(`fixture ${ENGLISH_NEGATIVE_CLIP} ... `);
summary[ENGLISH_NEGATIVE_CLIP] = await ensureEnglishNegative();
console.log(summary[ENGLISH_NEGATIVE_CLIP]);
writeSourceNotice();
console.log(JSON.stringify({ recitationDir: path.relative(root, recitationDir), count: Object.keys(summary).length, summary }, null, 2));
