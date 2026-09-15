import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import {
  SAMPLE_RATE,
  loadSalahLiturgyStubEntry,
  suiteBlueprint,
} from '../scripts/replay-suites';
import {
  assertSpokenClip,
  inspectWav16kMonoPcm16,
  loadLiturgyPack,
  parseLiturgyTtsArgs,
  pcmRms,
  resolveLiturgyTtsPlan,
  spokenArabicForPhrase,
} from '../scripts/gen-liturgy-tts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function pcm16Wav(samples: number[], sampleRate = SAMPLE_RATE): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  for (let index = 0; index < samples.length; index++) {
    data.writeInt16LE(samples[index]!, index * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

test('liturgy TTS plan reads pack arabic_uthmani for takbeer and the ready clip_path', () => {
  const pack = loadLiturgyPack();
  const phrase = spokenArabicForPhrase(pack, 'takbeer');
  const fromDisk = JSON.parse(
    fs.readFileSync(path.join(root, 'assets/content/salah-liturgy.json'), 'utf8'),
  ) as { phrases: { id: string; arabic_uthmani: string }[] };
  const row = fromDisk.phrases.find((item) => item.id === 'takbeer');
  assert.equal(row?.arabic_uthmani, 'اللَّهُ أَكْبَرُ');
  assert.equal(phrase.arabic_uthmani, row?.arabic_uthmani);
  assert.notEqual(phrase.arabic_uthmani, 'Allahu Akbar');
  const plan = resolveLiturgyTtsPlan('liturgy-takbeer', pack);
  assert.equal(plan.phraseId, 'takbeer');
  assert.equal(plan.spokenArabic, phrase.arabic_uthmani);
  assert.equal(plan.destRelative, 'artifacts/recitation/liturgy/liturgy-takbeer/liturgy-takbeer__edge-tts__ar-SA-HamedNeural.wav');
  assert.deepEqual(suiteBlueprint('liturgy-takbeer').clips, [
    'liturgy-takbeer/liturgy-takbeer__edge-tts__ar-SA-HamedNeural.wav',
  ]);
  assert.equal(loadSalahLiturgyStubEntry('liturgy-takbeer').status, 'ready');
});

test('liturgy TTS parser defaults to liturgy-takbeer and refuses other stub suites', () => {
  assert.deepEqual(parseLiturgyTtsArgs([]), {
    help: false,
    dryRun: false,
    engine: 'auto',
    voice: undefined,
    rate: undefined,
    suiteId: 'liturgy-takbeer',
  });
  assert.equal(parseLiturgyTtsArgs(['liturgy-takbeer', '--dry-run']).dryRun, true);
  assert.deepEqual(parseLiturgyTtsArgs(['--engine', 'say']), {
    help: false,
    dryRun: false,
    engine: 'say',
    voice: undefined,
    rate: undefined,
    suiteId: 'liturgy-takbeer',
  });
  assert.equal(parseLiturgyTtsArgs(['--engine', 'edge-tts', '--voice', 'ar-SA-HamedNeural']).suiteId, 'liturgy-takbeer');
  assert.equal(parseLiturgyTtsArgs(['--rate=-25%']).rate, '-25%');
  assert.throws(() => resolveLiturgyTtsPlan('liturgy-thana'), /still stub/);
});

test('spoken-clip checks reject silent PCM16 and accept voiced 16 kHz mono', () => {
  const silent = pcm16Wav(Array.from({ length: SAMPLE_RATE }, () => 0));
  const wav = inspectWav16kMonoPcm16(silent);
  assert.equal(wav.sampleRate, SAMPLE_RATE);
  assert.equal(wav.channels, 1);
  assert.equal(pcmRms(wav.pcm), 0);
  assert.throws(() => assertSpokenClip(silent), /silent/);
  const voiced = pcm16Wav(Array.from({ length: SAMPLE_RATE }, (_, index) => Math.round(Math.sin(index / 12) * 12000)));
  const ok = assertSpokenClip(voiced);
  assert.ok(ok.durationSeconds >= 0.9);
  assert.ok(ok.rms > 0.01);
});
