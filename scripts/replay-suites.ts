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
export const LITURGY_CLIP_DIR = 'artifacts/recitation/liturgy';
export const LITURGY_MANIFEST = 'prompts/salah-liturgy/manifest.stub.json';
export const MISSING_FIXTURE = 'missing_fixture';
export const SKIPPED_PENDING = 'skipped';

export type VerseRef = { surah: number; ayah: number };
export type MatchRow = { surah: number; ayah: number; audioSeconds: number; score: number };
export type PhraseLockRow = { phraseId: string; audioSeconds: number; confidence?: number };

export type ReplayGate =
  | 'ordered-sequence'
  | 'no-verse-locks'
  | 'basmala-hold'
  | 'stall-after-lock'
  | 'liturgy-phrase'
  | 'liturgy-then-quran'
  | 'quran-then-liturgy'
  | 'no-quran-no-liturgy';

export type ClipRunMode = 'concat' | 'each-clip';
export type SuiteReadiness = 'ready' | 'pending';
export type SilenceInsert = { atAudioSeconds: number | null; durationSeconds: number };
export type QuranClipPlacement = 'before' | 'after';

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
  expectPhraseIds?: string[];
  allowPartialLiturgy?: boolean;
  quranClips?: string[];
  quranClipDir?: string;
  quranClipPlacement?: QuranClipPlacement;
  scoreLiturgy?: boolean;
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

export type SalahLiturgyStubEntry = {
  suite_id: string;
  status: 'stub' | 'ready' | 'pending';
  expect_phrase_ids: string[];
  expect_quran: VerseRef[];
  notes: string;
  license_status: string;
  clip_path?: string | string[];
  gate?: ReplayGate;
  allow_partial_liturgy?: boolean;
  quran_clip_placement?: QuranClipPlacement;
};

export type SalahLiturgyManifest = {
  version: number;
  kind: string;
  audio_root?: string;
  clip_drop_notes?: string;
  suites: SalahLiturgyStubEntry[];
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

/** Real-imam pack. Not part of default / `all`. Ready rows need restored WAVs; stubs skip. */
export const REAL_IMAM_SUITE_NAMES = [
  'imam-mid-surah-cold',
  'imam-mid-surah-cold-qiyam',
  'imam-mid-ayah-pause',
  'imam-surah-switch',
  'imam-noise-bleed',
  'imam-multi-qari',
] as const;

/** Pending salah liturgy pack. Not part of default / `all`. No liturgy WAV until dropped. */
export const LITURGY_SUITE_NAMES = [
  'liturgy-takbeer',
  'liturgy-thana',
  'liturgy-ruku',
  'liturgy-sujood',
  'liturgy-tashahhud',
  'liturgy-then-fatiha',
  'fatiha-then-takbeer',
  'liturgy-english-negative',
] as const;

export const LITURGY_SELECTION_ALIASES = ['liturgy', 'salah-liturgy'] as const;

export type ReadySuiteName = (typeof ALL_SUITE_NAMES)[number];
export type RealImamSuiteName = (typeof REAL_IMAM_SUITE_NAMES)[number];
export type LiturgySuiteName = (typeof LITURGY_SUITE_NAMES)[number];
export type SuiteName = ReadySuiteName | RealImamSuiteName | LiturgySuiteName;

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

function defaultLiturgyClipPath(suiteId: string): string {
  return `_stubs/${suiteId}__pending__STUB.txt`;
}

function clipsFromLiturgyStub(entry: SalahLiturgyStubEntry): string[] {
  const sources = entry.clip_path
    ? (Array.isArray(entry.clip_path) ? entry.clip_path : [entry.clip_path])
    : [defaultLiturgyClipPath(entry.suite_id)];
  return sources.map((clip) => `${entry.suite_id}/${stubWavName(clip)}`);
}

function liturgyGate(entry: SalahLiturgyStubEntry): ReplayGate {
  if (entry.gate) return entry.gate;
  if (entry.suite_id === 'liturgy-english-negative') return 'no-quran-no-liturgy';
  if (entry.suite_id === 'liturgy-then-fatiha') return 'liturgy-then-quran';
  if (entry.suite_id === 'fatiha-then-takbeer') return 'quran-then-liturgy';
  return 'liturgy-phrase';
}

function mixedQuranClips(entry: SalahLiturgyStubEntry): string[] | undefined {
  if (!entry.expect_quran.length) return undefined;
  const first = entry.expect_quran[0];
  if (first?.surah === 1 && first.ayah === 2) return FATIHA_CLIPS;
  return entry.expect_quran.map((ref) => verseFileName(ref.surah, ref.ayah));
}

function loadLiturgyManifest(): SalahLiturgyManifest {
  const file = path.join(repoRoot, LITURGY_MANIFEST);
  return JSON.parse(fs.readFileSync(file, 'utf8')) as SalahLiturgyManifest;
}

function loadLiturgyStub(name: LiturgySuiteName): SalahLiturgyStubEntry {
  const entry = loadLiturgyManifest().suites.find((row) => row.suite_id === name);
  if (!entry) throw new Error(`Missing ${name} in ${LITURGY_MANIFEST}`);
  return entry;
}

function blueprintFromLiturgyStub(entry: SalahLiturgyStubEntry): SuiteBlueprint {
  const quranClips = mixedQuranClips(entry);
  return {
    label: entry.suite_id,
    clips: clipsFromLiturgyStub(entry),
    expect: entry.expect_quran,
    gate: liturgyGate(entry),
    clipDir: LITURGY_CLIP_DIR,
    readiness: entry.status === 'ready' ? 'ready' : 'pending',
    expectedLocksPath: LITURGY_MANIFEST,
    description: entry.notes,
    expectPhraseIds: entry.expect_phrase_ids,
    allowPartialLiturgy: entry.allow_partial_liturgy === true,
    quranClips,
    quranClipDir: quranClips?.length ? DEFAULT_CLIP_DIR : undefined,
    quranClipPlacement: entry.quran_clip_placement ?? (quranClips?.length ? 'after' : undefined),
    scoreLiturgy: true,
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

const LITURGY_SUITES = Object.fromEntries(
  LITURGY_SUITE_NAMES.map((name) => [name, blueprintFromLiturgyStub(loadLiturgyStub(name))]),
) as Record<LiturgySuiteName, SuiteBlueprint>;

const SUITES: Record<SuiteName, SuiteBlueprint> = { ...READY_SUITES, ...REAL_IMAM_SUITES, ...LITURGY_SUITES };

export function isReadySuiteName(name: string): name is ReadySuiteName {
  return (ALL_SUITE_NAMES as readonly string[]).includes(name);
}

export function isRealImamSuiteName(name: string): name is RealImamSuiteName {
  return (REAL_IMAM_SUITE_NAMES as readonly string[]).includes(name);
}

export function isLiturgySuiteName(name: string): name is LiturgySuiteName {
  return (LITURGY_SUITE_NAMES as readonly string[]).includes(name);
}

export function isLiturgySelectionAlias(name: string): boolean {
  return (LITURGY_SELECTION_ALIASES as readonly string[]).includes(name);
}

export function isPendingReplaySuiteName(name: string): boolean {
  return isRealImamSuiteName(name) || isLiturgySuiteName(name);
}

/** Stubs skip missing_fixture. Ready liturgy/imam rows must not skip — they error until the WAV exists. */
export function suiteSkipsWhenClipMissing(suite: Pick<SuiteBlueprint, 'readiness'>): boolean {
  return suite.readiness === 'pending';
}

export function isSuiteName(name: string): name is SuiteName {
  return isReadySuiteName(name) || isRealImamSuiteName(name) || isLiturgySuiteName(name);
}

export function suiteBlueprint(name: string): SuiteBlueprint {
  if (!isSuiteName(name)) {
    throw new Error(
      `Unknown suite "${name}". Use ${ALL_SUITE_NAMES.join(' | ')} | core | all | real-imam | ${REAL_IMAM_SUITE_NAMES.join(' | ')} | liturgy | salah-liturgy | ${LITURGY_SUITE_NAMES.join(' | ')} | wav paths.`,
    );
  }
  return SUITES[name];
}

export function parseReplayCli(args: string[]): {
  help: boolean;
  list: boolean;
  checkFixtures: boolean;
  includePending: boolean;
  engine: string;
  wavArgs: string[];
  namedArgs: string[];
} {
  let engine = 'tilawa';
  const rest: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!;
    if (arg === '--engine') {
      engine = args[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (arg.startsWith('--engine=')) {
      engine = arg.slice('--engine='.length);
      continue;
    }
    rest.push(arg);
  }
  return {
    help: rest.includes('--help') || rest.includes('-h'),
    list: rest.includes('--list'),
    checkFixtures: rest.includes('--check-fixtures'),
    includePending: rest.includes('--include-pending'),
    engine: engine.trim() || 'tilawa',
    wavArgs: rest.filter((arg) => arg.endsWith('.wav') || arg.endsWith('.WAV')),
    namedArgs: rest.filter((arg) => !arg.startsWith('--') && !arg.endsWith('.wav') && !arg.endsWith('.WAV')),
  };
}

export function parseSuiteSelection(args: string[], options?: { includePending?: boolean }): string[] {
  const names = args.filter((arg) => !arg.startsWith('--') && !arg.endsWith('.wav') && !arg.endsWith('.WAV'));
  const includePending = Boolean(options?.includePending);
  if (!names.length || names.includes('all')) {
    const extra: string[] = [];
    if (includePending || names.includes('real-imam')) extra.push(...REAL_IMAM_SUITE_NAMES);
    if (includePending || names.some((name) => isLiturgySelectionAlias(name))) extra.push(...LITURGY_SUITE_NAMES);
    return extra.length ? [...ALL_SUITE_NAMES, ...extra] : [...ALL_SUITE_NAMES];
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
    if (isLiturgySelectionAlias(name)) {
      resolved.push(...LITURGY_SUITE_NAMES);
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

export function loadSalahLiturgyStubEntry(name: string): SalahLiturgyStubEntry {
  if (!isLiturgySuiteName(name)) {
    throw new Error(`Not a salah liturgy suite: ${name}`);
  }
  return loadLiturgyStub(name);
}

export function loadSalahLiturgyStubManifest(): SalahLiturgyManifest {
  return loadLiturgyManifest();
}

export type SuiteClipRef = { file: string; dir: string; role: 'liturgy' | 'quran' };

export function suiteClipRefs(suite: Pick<SuiteBlueprint, 'clips' | 'clipDir' | 'quranClips' | 'quranClipDir' | 'quranClipPlacement'>): SuiteClipRef[] {
  const liturgy = suite.clips.map((file) => ({
    file,
    dir: suiteClipDirectory(suite),
    role: 'liturgy' as const,
  }));
  const quran = (suite.quranClips ?? []).map((file) => ({
    file,
    dir: suite.quranClipDir ?? DEFAULT_CLIP_DIR,
    role: 'quran' as const,
  }));
  if (suite.quranClipPlacement === 'before') return [...quran, ...liturgy];
  return [...liturgy, ...quran];
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

export function isLiturgyGate(gate: ReplayGate): boolean {
  return gate === 'liturgy-phrase'
    || gate === 'liturgy-then-quran'
    || gate === 'quran-then-liturgy'
    || gate === 'no-quran-no-liturgy';
}

function phraseExpectationFailure(
  phrases: readonly PhraseLockRow[],
  expected: readonly string[],
  allowPartial: boolean,
): string | null {
  if (!expected.length) {
    return phrases.length ? `liturgy_lock_${phrases[0]!.phraseId}` : null;
  }
  if (!phrases.length) return 'no_liturgy_lock';
  if (allowPartial) {
    for (const id of expected) {
      if (!phrases.some((row) => row.phraseId === id)) return `missing_phrase_${id}`;
    }
    return null;
  }
  for (let index = 0; index < expected.length; index++) {
    const want = expected[index]!;
    const got = phrases[index];
    if (!got) return `missing_phrase_${want}`;
    if (got.phraseId !== want) {
      return `phrase_break_at_${index}_got_${got.phraseId}_expected_${want}`;
    }
  }
  return null;
}

export function evaluateLiturgyFailure(
  matches: MatchRow[],
  phrases: readonly PhraseLockRow[],
  suite: Pick<SuiteBlueprint, 'expect' | 'gate' | 'expectPhraseIds' | 'allowPartialLiturgy'>,
): string | null {
  const expectedPhrases = suite.expectPhraseIds ?? [];
  if (suite.gate === 'no-quran-no-liturgy') {
    if (matches.length) {
      const first = matches[0]!;
      return `verse_lock_${first.surah}:${first.ayah}`;
    }
    if (phrases.length) return `liturgy_lock_${phrases[0]!.phraseId}`;
    return null;
  }
  if (suite.gate === 'liturgy-phrase') {
    if (matches.length) {
      const first = matches[0]!;
      return `verse_lock_${first.surah}:${first.ayah}`;
    }
    return phraseExpectationFailure(phrases, expectedPhrases, suite.allowPartialLiturgy === true);
  }
  if (suite.gate === 'liturgy-then-quran') {
    const phraseFail = phraseExpectationFailure(phrases, expectedPhrases, false);
    if (phraseFail) return phraseFail;
    const firstQuran = matches[0];
    const firstPhrase = phrases[0];
    if (firstQuran && firstPhrase && firstQuran.audioSeconds + 1e-9 < firstPhrase.audioSeconds) {
      return `quran_before_liturgy_${firstQuran.surah}:${firstQuran.ayah}`;
    }
    return evaluateFailure(matches, { expect: suite.expect, gate: 'ordered-sequence' });
  }
  if (suite.gate === 'quran-then-liturgy') {
    const quranFail = evaluateFailure(
      matches.slice(0, suite.expect.length),
      { expect: suite.expect, gate: 'ordered-sequence' },
    );
    if (quranFail) return quranFail;
    if (matches.length > suite.expect.length) {
      const extra = matches[suite.expect.length]!;
      return `verse_after_quran_${extra.surah}:${extra.ayah}`;
    }
    const lastQuran = matches[suite.expect.length - 1];
    const liturgyAfter = lastQuran
      ? phrases.filter((row) => row.audioSeconds + 1e-9 >= lastQuran.audioSeconds)
      : phrases;
    return phraseExpectationFailure(
      liturgyAfter.length ? liturgyAfter : phrases,
      expectedPhrases,
      false,
    );
  }
  return 'missing_liturgy_gate';
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
  suite: Pick<SuiteBlueprint, 'expect' | 'gate' | 'expectPhraseIds' | 'allowPartialLiturgy'>,
  phrases: readonly PhraseLockRow[] = [],
): string | null {
  if (isLiturgyGate(suite.gate)) {
    return evaluateLiturgyFailure(matches, phrases, suite);
  }
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
  if (gate === 'no-verse-locks' || gate === 'basmala-hold' || gate === 'no-quran-no-liturgy' || gate === 'liturgy-phrase') {
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
  const pending = REAL_IMAM_SUITE_NAMES.map((name) => {
    const suite = SUITES[name];
    const tag = suite.readiness === 'ready' ? '[ready — restore WAV then score]' : '[pending]';
    return `  ${name.padEnd(22)} ${tag} ${suite.description}`;
  });
  const liturgy = LITURGY_SUITE_NAMES.map((name) => {
    const suite = SUITES[name];
    const tag = suite.readiness === 'ready' ? '[ready — generate WAV then score]' : '[pending]';
    return `  ${name.padEnd(22)} ${tag} ${suite.description}`;
  });
  return [
    'Usage:',
    '  npm run test:replay',
    '  npm run test:replay -- all',
    '  npm run test:replay -- core',
    '  npm run test:replay -- real-imam',
    '  npm run test:replay -- liturgy',
    '  npm run test:replay -- salah-liturgy',
    '  npm run test:replay -- --include-pending',
    '  npm run test:replay -- <suite>',
    '  npm run test:replay -- --check-fixtures',
    '  npm run test:replay -- --list',
    '  npm run test:replay -- artifacts/recitation/112001.wav ...',
    '  npm run test:replay -- --engine tilawa',
    '  npm run test:bakeoff',
    '  npm run liturgy:tts -- liturgy-takbeer',
    '  npm run liturgy:tts -- liturgy-thana --engine say',
    '',
    'Ready (default all, 14 suites):',
    ...ready,
    '',
    'Real-imam (not in default all; stubs skip missing_fixture; ready suites need restored WAV):',
    ...pending,
    '',
    'Salah liturgy (not in default all; stubs skip missing_fixture; ready suites need generated WAV):',
    ...liturgy,
  ].join('\n');
}
