/**
 * Named headless-replay suite blueprints and gate helpers.
 * No ONNX / follower logic lives here — algorithm stays in src/core.
 */

export const SAMPLE_RATE = 16000;
export const DEFAULT_TRAILING_SILENCE_SECONDS = 2;
export const STALL_TRAILING_SILENCE_SECONDS = 4;
export const COLD_START_TRIM_SECONDS = 0.75;
export const ENGLISH_NEGATIVE_CLIP = 'english-negative.wav';

export type VerseRef = { surah: number; ayah: number };
export type MatchRow = { surah: number; ayah: number; audioSeconds: number; score: number };

export type ReplayGate =
  | 'ordered-sequence'
  | 'no-verse-locks'
  | 'basmala-hold'
  | 'stall-after-lock';

export type SuiteBlueprint = {
  label: string;
  clips: string[];
  expect: VerseRef[];
  gate: ReplayGate;
  trimStartSeconds?: number;
  trailingSilenceSeconds?: number;
  description: string;
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

export type SuiteName = (typeof ALL_SUITE_NAMES)[number];

const SUITES: Record<SuiteName, SuiteBlueprint> = {
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

export function isSuiteName(name: string): name is SuiteName {
  return (ALL_SUITE_NAMES as readonly string[]).includes(name);
}

export function suiteBlueprint(name: string): SuiteBlueprint {
  if (!isSuiteName(name)) {
    throw new Error(
      `Unknown suite "${name}". Use ${ALL_SUITE_NAMES.join(' | ')} | core | all | wav paths.`,
    );
  }
  return SUITES[name];
}

export function parseSuiteSelection(args: string[]): string[] {
  const names = args.filter((arg) => !arg.startsWith('--') && !arg.endsWith('.wav') && !arg.endsWith('.WAV'));
  if (!names.length || names.includes('all')) return [...ALL_SUITE_NAMES];
  const resolved: string[] = [];
  for (const name of names) {
    if (name === 'core') {
      resolved.push(...CORE_SUITE_NAMES);
      continue;
    }
    suiteBlueprint(name);
    resolved.push(name);
  }
  return [...new Set(resolved)];
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

export function prepareSuiteAudio(
  clips: Float32Array[],
  suite: Pick<SuiteBlueprint, 'trimStartSeconds' | 'trailingSilenceSeconds'>,
): { audio: Float32Array; trailingSilenceSeconds: number } {
  let audio = concatFloat32(clips);
  if (suite.trimStartSeconds) {
    audio = trimStartPcm(audio, suite.trimStartSeconds);
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
  const lines = ALL_SUITE_NAMES.map((name) => `  ${name.padEnd(18)} ${SUITES[name].description}`);
  return [
    'Usage:',
    '  npm run test:replay',
    '  npm run test:replay -- all',
    '  npm run test:replay -- core',
    '  npm run test:replay -- <suite>',
    '  npm run test:replay -- --check-fixtures',
    '  npm run test:replay -- --list',
    '  npm run test:replay -- artifacts/recitation/112001.wav ...',
    '',
    'Suites:',
    ...lines,
  ].join('\n');
}
