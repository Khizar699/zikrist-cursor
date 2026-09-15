/**
 * Named headless-replay suite blueprints and gate helpers.
 * No ONNX / follower logic lives here — algorithm stays in src/core.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SAMPLE_RATE = 16000;
export const DEFAULT_TRAILING_SILENCE_SECONDS = 2;
export const STALL_TRAILING_SILENCE_SECONDS = 4;
export const COLD_START_TRIM_SECONDS = 0.75;
export const ENGLISH_NEGATIVE_CLIP = 'english-negative.wav';
export const DEFAULT_CLIP_DIR = 'artifacts/recitation';
export const REAL_IMAM_CLIP_DIR = 'artifacts/recitation/imam';
export const REAL_IMAM_MANIFEST = 'prompts/real-imam/manifest.stub.json';
export const MISSING_FIXTURE = 'missing_fixture';
export const SKIPPED_PENDING = 'skipped';

export type VerseRef = { surah: number; ayah: number };
export type MatchRow = { surah: number; ayah: number; audioSeconds: number; score: number };

export type ReplayGate =
  | 'ordered-sequence'
  | 'no-verse-locks'
  | 'basmala-hold'
  | 'stall-after-lock';

export type ClipRunMode = 'concat' | 'each-clip';
export type SuiteReadiness = 'ready' | 'pending';
export type SilenceInsert = { atAudioSeconds: number | null; durationSeconds: number };

export type SuiteBlueprint = {
  label: string;
  clips: string[];
  expect: VerseRef[];
  gate: ReplayGate;
  trimStartSeconds?: number;
  trailingSilenceSeconds?: number;
  insertSilence?: SilenceInsert[];
  clipRunMode?: ClipRunMode;
  clipDir?: string;
  readiness?: SuiteReadiness;
  expectedLocksPath?: string;
  description: string;
};

export type RealImamStubEntry = {
  suite_id: string;
  status: 'stub' | 'ready' | 'pending';
  clip_path: string | string[];
  qari_slots?: string[];
  expected_first_lock: VerseRef | null;
  expected_sequence: VerseRef[];
  notes: string;
  license_status: string;
  gate?: ReplayGate;
  clipRunMode?: ClipRunMode;
};

export type RealImamManifest = {
  version: number;
  clip_drop: string;
  audio_root?: string;
  suites: RealImamStubEntry[];
};

function verseFileName(surah: number, ayah: number): string {
  return `${String(surah).padStart(3, '0')}${String(ayah).padStart(3, '0')}.wav`;
}

function verseRange(surah: number, from: number, to: number): VerseRef[] {
  return Array.from({ length: to - from + 1 }, (_, index) => ({ surah, ayah: from + index }));
}

function clipsFor(surah: number, from: number, to: number): string[] {
  return verseRange(surah, from, to).map((ref) => verseFileName(ref.surah, ref.ayah));
}

const FATIHA_EXPECT = verseRange(1, 2, 7);
const IKHLAS_EXPECT = verseRange(112, 1, 4);
const NAS_EXPECT = verseRange(114, 1, 6);
const KAWTHAR_EXPECT = verseRange(108, 1, 3);
const FALAQ_EXPECT = verseRange(113, 1, 5);
const ASR_EXPECT = verseRange(103, 1, 3);
const QURAYSH_EXPECT = verseRange(106, 1, 4);
const LONGER_EXPECT = verseRange(2, 1, 5);

const FATIHA_CLIPS = clipsFor(1, 1, 7);
const IKHLAS_CLIPS = clipsFor(112, 1, 4);
const NAS_CLIPS = clipsFor(114, 1, 6);
const KAWTHAR_CLIPS = clipsFor(108, 1, 3);
const FALAQ_CLIPS = clipsFor(113, 1, 5);
const ASR_CLIPS = clipsFor(103, 1, 3);
const QURAYSH_CLIPS = clipsFor(106, 1, 4);
const LONGER_CLIPS = clipsFor(2, 1, 5);

export const CORE_SUITE_NAMES = ['fatiha', 'ikhlas', 'nas'] as const;

/** Default / all-suites order: core gates first, then short surahs, then edge cases. */
export const ALL_SUITE_NAMES = [
  'fatiha',
  'ikhlas',
  'nas',
  'kawthar',
  'falaq',
  'asr',
  'quraysh',
  'longer',
  'jump',
  'english-negative',
  'basmala-hold',
  'back-to-back',
  'cold-start-mid',
  'stall-after-lock',
] as const;

/** Pending real-imam pack. Not part of default / `all`. No audio until founder drops clips. */
export const REAL_IMAM_SUITE_NAMES = [
  'imam-mid-surah-cold',
  'imam-mid-ayah-pause',
  'imam-surah-switch',
  'imam-noise-bleed',
  'imam-multi-qari',
] as const;

export type ReadySuiteName = (typeof ALL_SUITE_NAMES)[number];
export type RealImamSuiteName = (typeof REAL_IMAM_SUITE_NAMES)[number];
export type SuiteName = ReadySuiteName | RealImamSuiteName;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function stubWavName(clipPath: string): string {
  const base = path.basename(clipPath);
  if (base.toLowerCase().endsWith('.wav')) return base;
  return base.replace(/\.txt$/i, '.wav');
}

function clipsFromStub(entry: RealImamStubEntry): string[] {
  const slots = entry.qari_slots?.length ? entry.qari_slots : ['qari-a'];
  const sources = Array.isArray(entry.clip_path) ? entry.clip_path : [entry.clip_path];
  const names = sources.map(stubWavName);
  const clips: string[] = [];
  for (const slot of slots) {
    for (const name of names) {
      clips.push(`${entry.suite_id}/${slot}/${name}`);
    }
  }
  return clips;
}

function loadRealImamManifest(): RealImamManifest {
  const file = path.join(repoRoot, REAL_IMAM_MANIFEST);
  return JSON.parse(fs.readFileSync(file, 'utf8')) as RealImamManifest;
}

function loadRealImamStub(name: RealImamSuiteName): RealImamStubEntry {
  const entry = loadRealImamManifest().suites.find((row) => row.suite_id === name);
  if (!entry) throw new Error(`Missing ${name} in ${REAL_IMAM_MANIFEST}`);
  return entry;
}

function blueprintFromRealImamStub(entry: RealImamStubEntry): SuiteBlueprint {
  return {
    label: entry.suite_id,
    clips: clipsFromStub(entry),
    expect: entry.expected_sequence,
    gate: entry.gate ?? 'ordered-sequence',
    clipRunMode: entry.clipRunMode ?? (entry.qari_slots && entry.qari_slots.length > 1 ? 'each-clip' : 'concat'),
    clipDir: REAL_IMAM_CLIP_DIR,
    readiness: entry.status === 'ready' ? 'ready' : 'pending',
    expectedLocksPath: REAL_IMAM_MANIFEST,
    description: entry.notes,
  };
}

const READY_SUITES: Record<ReadySuiteName, SuiteBlueprint> = {
  fatiha: {
    label: 'fatiha',
    clips: FATIHA_CLIPS,
    expect: FATIHA_EXPECT,
    gate: 'ordered-sequence',
    description: 'Al-Fatihah 001001–001007; first lock 1:2 then 1:3–1:7. Never Ibrahim 14:39/14:40.',
  },
  ikhlas: {
    label: 'ikhlas',
    clips: IKHLAS_CLIPS,
    expect: IKHLAS_EXPECT,
    gate: 'ordered-sequence',
    description: 'Al-Ikhlas 112:1–4 in order.',
  },
  nas: {
    label: 'nas',
    clips: NAS_CLIPS,
    expect: NAS_EXPECT,
    gate: 'ordered-sequence',
    description: 'An-Nas 114:1–6 in order.',
  },
  kawthar: {
    label: 'kawthar',
    clips: KAWTHAR_CLIPS,
    expect: KAWTHAR_EXPECT,
    gate: 'ordered-sequence',
    description: 'Al-Kawthar 108:1–3 in order.',
  },
  falaq: {
    label: 'falaq',
    clips: FALAQ_CLIPS,
    expect: FALAQ_EXPECT,
    gate: 'ordered-sequence',
    description: 'Al-Falaq 113:1–5 in order.',
  },
  asr: {
    label: 'asr',
    clips: ASR_CLIPS,
    expect: ASR_EXPECT,
    gate: 'ordered-sequence',
    description: 'Al-Asr 103:1–3 in order.',
  },
  quraysh: {
    label: 'quraysh',
    clips: QURAYSH_CLIPS,
    expect: QURAYSH_EXPECT,
    gate: 'ordered-sequence',
    description: 'Quraysh 106:1–4 in order.',
  },
  longer: {
    label: 'longer',
    clips: LONGER_CLIPS,
    expect: LONGER_EXPECT,
    gate: 'ordered-sequence',
    description: 'Al-Baqarah 2:1–5 (002001–002005). Not Mulk 67:1–3.',
  },
  jump: {
    label: 'jump',
    clips: [...KAWTHAR_CLIPS, ...IKHLAS_CLIPS],
    expect: [...KAWTHAR_EXPECT, ...IKHLAS_EXPECT],
    gate: 'ordered-sequence',
    description: 'Kawthar 108:1–3 then Ikhlas 112:1–4 (concatenated).',
  },
  'english-negative': {
    label: 'english-negative',
    clips: [ENGLISH_NEGATIVE_CLIP],
    expect: [],
    gate: 'no-verse-locks',
    description: 'Non-Quran English speech. PASS only if no verse commits.',
  },
  'basmala-hold': {
    label: 'basmala-hold',
    clips: [verseFileName(1, 1)],
    expect: [],
    gate: 'basmala-hold',
    description: '001001 alone must not lock 1:1 or any other verse.',
  },
  'back-to-back': {
    label: 'back-to-back',
    clips: [...ASR_CLIPS, ...QURAYSH_CLIPS],
    expect: [...ASR_EXPECT, ...QURAYSH_EXPECT],
    gate: 'ordered-sequence',
    description: 'Asr 103:1–3 then Quraysh 106:1–4 (concatenated).',
  },
  'cold-start-mid': {
    label: 'cold-start-mid',
    clips: [verseFileName(2, 2)],
    expect: [{ surah: 2, ayah: 2 }],
    gate: 'ordered-sequence',
    trimStartSeconds: COLD_START_TRIM_SECONDS,
    description: `Trim first ${COLD_START_TRIM_SECONDS}s of 002002 (Al-Baqarah 2:2) then locate.`,
  },
  'stall-after-lock': {
    label: 'stall-after-lock',
    clips: [verseFileName(112, 2)],
    expect: [{ surah: 112, ayah: 2 }],
    gate: 'stall-after-lock',
    trailingSilenceSeconds: STALL_TRAILING_SILENCE_SECONDS,
    description: `Ikhlas 112:2 then ${STALL_TRAILING_SILENCE_SECONDS}s fed trailing silence; keep last verse / do not jump.`,
  },
};

const REAL_IMAM_SUITES = Object.fromEntries(
  REAL_IMAM_SUITE_NAMES.map((name) => [name, blueprintFromRealImamStub(loadRealImamStub(name))]),
) as Record<RealImamSuiteName, SuiteBlueprint>;

const SUITES: Record<SuiteName, SuiteBlueprint> = { ...READY_SUITES, ...REAL_IMAM_SUITES };

export function isReadySuiteName(name: string): name is ReadySuiteName {
  return (ALL_SUITE_NAMES as readonly string[]).includes(name);
}

export function isRealImamSuiteName(name: string): name is RealImamSuiteName {
  return (REAL_IMAM_SUITE_NAMES as readonly string[]).includes(name);
}

export function isSuiteName(name: string): name is SuiteName {
  return isReadySuiteName(name) || isRealImamSuiteName(name);
}

export function suiteBlueprint(name: string): SuiteBlueprint {
  if (!isSuiteName(name)) {
    throw new Error(
      `Unknown suite "${name}". Use ${ALL_SUITE_NAMES.join(' | ')} | core | all | real-imam | ${REAL_IMAM_SUITE_NAMES.join(' | ')} | wav paths.`,
    );
  }
  return SUITES[name];
}

export function parseReplayCli(args: string[]): {
  help: boolean;
  list: boolean;
  checkFixtures: boolean;
  includePending: boolean;
  wavArgs: string[];
  namedArgs: string[];
} {
  return {
    help: args.includes('--help') || args.includes('-h'),
    list: args.includes('--list'),
    checkFixtures: args.includes('--check-fixtures'),
    includePending: args.includes('--include-pending'),
    wavArgs: args.filter((arg) => arg.endsWith('.wav') || arg.endsWith('.WAV')),
    namedArgs: args.filter((arg) => !arg.startsWith('--') && !arg.endsWith('.wav') && !arg.endsWith('.WAV')),
  };
}

export function parseSuiteSelection(args: string[], options?: { includePending?: boolean }): string[] {
  const names = args.filter((arg) => !arg.startsWith('--') && !arg.endsWith('.wav') && !arg.endsWith('.WAV'));
  const includePending = Boolean(options?.includePending);
  if (!names.length || names.includes('all')) {
    if (includePending || names.includes('real-imam')) {
      return [...ALL_SUITE_NAMES, ...REAL_IMAM_SUITE_NAMES];
    }
    return [...ALL_SUITE_NAMES];
  }
  const resolved: string[] = [];
  for (const name of names) {
    if (name === 'core') {
      resolved.push(...CORE_SUITE_NAMES);
      continue;
    }
    if (name === 'real-imam') {
      resolved.push(...REAL_IMAM_SUITE_NAMES);
      continue;
    }
    suiteBlueprint(name);
    resolved.push(name);
  }
  return [...new Set(resolved)];
}

export function suiteClipDirectory(suite: Pick<SuiteBlueprint, 'clipDir'>): string {
  return suite.clipDir ?? DEFAULT_CLIP_DIR;
}

export function loadRealImamStubEntry(name: string): RealImamStubEntry {
  if (!isRealImamSuiteName(name)) {
    throw new Error(`Not a real-imam suite: ${name}`);
  }
  return loadRealImamStub(name);
}

export function loadRealImamStubManifest(): RealImamManifest {
  return loadRealImamManifest();
}

export const RECITATION_RESTORE = 'npm run fixtures:recitation';
export const REAL_IMAM_RESTORE =
  'Convert founder media from ~/Desktop/zikrist-imam-clips/ to 16 kHz mono PCM16 WAV under artifacts/recitation/imam/<suite-id>/<qari>/ (prompts/real-imam/FIXTURES.md)';

export function fixtureRestoreHint(names: readonly string[]): string {
  const hasImam = names.some((name) => isRealImamSuiteName(name));
  const hasReady = names.some((name) => isReadySuiteName(name));
  if (hasImam && hasReady) return `${RECITATION_RESTORE}; ${REAL_IMAM_RESTORE}`;
  if (hasImam) return REAL_IMAM_RESTORE;
  return RECITATION_RESTORE;
}

/** Distinct each-clip labels when qari folders share a basename. */
export function eachClipTrialLabel(suiteLabel: string, clip: string): string {
  const ext = path.extname(clip);
  const stem = ext ? clip.slice(0, -ext.length) : clip;
  return `${suiteLabel}:${stem.replace(/[\\/]/g, ':')}`;
}

export function uniqueClipsForSuites(names: readonly string[]): string[] {
  const clips = new Set<string>();
  for (const name of names) {
    for (const clip of suiteBlueprint(name).clips) clips.add(clip);
  }
  return [...clips].sort();
}

export function verseClipIdsFromSuites(): string[] {
  return uniqueClipsForSuites(ALL_SUITE_NAMES)
    .filter((clip) => clip !== ENGLISH_NEGATIVE_CLIP)
    .map((clip) => clip.replace(/\.wav$/i, ''));
}

export function concatFloat32(chunks: Float32Array[]): Float32Array {
  const audio = new Float32Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    audio.set(chunk, offset);
    offset += chunk.length;
  }
  return audio;
}

export function silencePcm(seconds: number, sampleRate = SAMPLE_RATE): Float32Array {
  return new Float32Array(Math.max(0, Math.round(seconds * sampleRate)));
}

export function trimStartPcm(audio: Float32Array, seconds: number, sampleRate = SAMPLE_RATE): Float32Array {
  const skip = Math.min(audio.length, Math.max(0, Math.round(seconds * sampleRate)));
  if (skip <= 0) return audio;
  if (skip >= audio.length) {
    throw new Error(`trim_exhausted:${seconds}s`);
  }
  return audio.subarray(skip);
}

export function insertSilenceAt(
  audio: Float32Array,
  atAudioSeconds: number,
  durationSeconds: number,
  sampleRate = SAMPLE_RATE,
): Float32Array {
  const at = Math.max(0, Math.min(audio.length, Math.round(atAudioSeconds * sampleRate)));
  const silence = silencePcm(durationSeconds, sampleRate);
  const out = new Float32Array(audio.length + silence.length);
  out.set(audio.subarray(0, at), 0);
  out.set(silence, at);
  out.set(audio.subarray(at), at + silence.length);
  return out;
}

export function prepareSuiteAudio(
  clips: Float32Array[],
  suite: Pick<SuiteBlueprint, 'trimStartSeconds' | 'trailingSilenceSeconds' | 'insertSilence'>,
): { audio: Float32Array; trailingSilenceSeconds: number } {
  let audio = concatFloat32(clips);
  if (suite.trimStartSeconds) {
    audio = trimStartPcm(audio, suite.trimStartSeconds);
  }
  for (const gap of suite.insertSilence ?? []) {
    if (gap.atAudioSeconds == null) continue;
    audio = insertSilenceAt(audio, gap.atAudioSeconds, gap.durationSeconds);
  }
  return {
    audio,
    trailingSilenceSeconds: suite.trailingSilenceSeconds ?? DEFAULT_TRAILING_SILENCE_SECONDS,
  };
}

export function evaluateFailure(
  matches: MatchRow[],
  suite: Pick<SuiteBlueprint, 'expect' | 'gate'>,
): string | null {
  if (suite.gate === 'no-verse-locks') {
    if (!matches.length) return null;
    const first = matches[0]!;
    return `verse_lock_${first.surah}:${first.ayah}`;
  }
  if (suite.gate === 'basmala-hold') {
    if (!matches.length) return null;
    const first = matches[0]!;
    if (first.surah === 1 && first.ayah === 1) return 'locked_fatiha_1:1';
    return `locked_${first.surah}:${first.ayah}`;
  }
  if (suite.gate === 'stall-after-lock') {
    const want = suite.expect[0];
    if (!want) return 'missing_stall_expect';
    if (!matches.length) return 'no_matches';
    const first = matches[0]!;
    if (first.surah !== want.surah || first.ayah !== want.ayah) {
      return `first_lock_${first.surah}:${first.ayah}_expected_${want.surah}:${want.ayah}`;
    }
    if (matches.length > 1) {
      return `jumped_during_silence_${matches.slice(1).map((row) => `${row.surah}:${row.ayah}`).join(',')}`;
    }
    return null;
  }

  const expect = suite.expect;
  if (!expect.length) return matches.length ? null : 'no_matches';
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

export function wrongSurahStats(
  matches: MatchRow[],
  expect: VerseRef[],
  gate: ReplayGate,
): { wrongSurahCount: number; wrongSurahRate: number; firstLockWrongSurah: boolean } {
  if (gate === 'no-verse-locks' || gate === 'basmala-hold') {
    const count = matches.length;
    return {
      wrongSurahCount: count,
      wrongSurahRate: count ? 1 : 0,
      firstLockWrongSurah: count > 0,
    };
  }
  const allowed = new Set(expect.map((ref) => ref.surah));
  const wrong = matches.filter((row) => !allowed.has(row.surah));
  const first = matches[0];
  const expectedFirst = expect[0];
  return {
    wrongSurahCount: wrong.length,
    wrongSurahRate: matches.length ? wrong.length / matches.length : 0,
    firstLockWrongSurah: Boolean(first && expectedFirst && first.surah !== expectedFirst.surah),
  };
}

export function suiteHelpText(): string {
  const ready = ALL_SUITE_NAMES.map((name) => `  ${name.padEnd(22)} ${SUITES[name].description}`);
  const pending = REAL_IMAM_SUITE_NAMES.map((name) => `  ${name.padEnd(22)} [pending] ${SUITES[name].description}`);
  return [
    'Usage:',
    '  npm run test:replay',
    '  npm run test:replay -- all',
    '  npm run test:replay -- core',
    '  npm run test:replay -- real-imam',
    '  npm run test:replay -- --include-pending',
    '  npm run test:replay -- <suite>',
    '  npm run test:replay -- --check-fixtures',
    '  npm run test:replay -- --list',
    '  npm run test:replay -- artifacts/recitation/112001.wav ...',
    '',
    'Ready (default all, 14 suites):',
    ...ready,
    '',
    'Pending real-imam (skip with missing_fixture, not PASS; not in default all):',
    ...pending,
  ].join('\n');
}
