/**
 * Restore founder imam evaluation clips from a GitHub Release zip.
 *
 * Large audio stays gitignored under artifacts/recitation/imam/. Labels also live in
 * git at prompts/real-imam/LABELS.md (ground truth). Not git LFS. Not app assets.
 *
 *   npm run fixtures:imam
 *   npm run fixtures:imam -- --force
 *
 * Tag: ZIKRIST_IMAM_RELEASE_TAG (default imam-fixtures-v1).
 * Asset name stays zikrist-imam-fixtures-v1.zip.
 *
 * Rights for imam/bystander recordings remain unresolved. A public URL is not a
 * redistribution or training grant.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const DEFAULT_IMAM_RELEASE_TAG = 'imam-fixtures-v1';
export const IMAM_RELEASE_REPO = 'Khizar699/zikrist-cursor';
export const IMAM_RELEASE_ASSET = 'zikrist-imam-fixtures-v1.zip';
export const IMAM_AUDIO_ROOT = 'artifacts/recitation/imam';
export const USER_AGENT = 'Zikrist/0.1 (evaluation imam fixtures)';
export const DOWNLOAD_TIMEOUT_MS = 30 * 60 * 1000;
export const MIN_WAV_BYTES = 1000;

/** Zip still stores this clip under the original mid-surah-cold folder. */
export const QIYAM_SIBLING_CLIP = 'imam-mid-surah-cold__qiyam-faisal__036-016-018__raw.wav';
const QIYAM_SIBLING_SOURCE = path.join('imam-mid-surah-cold', 'qari-a', QIYAM_SIBLING_CLIP);
const QIYAM_SIBLING_DEST_DIR = path.join('imam-mid-surah-cold-qiyam', 'qari-a');

const PAYLOAD_MARKERS = [
  'LABELS.md',
  'labels.json',
  '_inbox',
  'sources',
  'imam-mid-surah-cold',
  'imam-surah-switch',
  'imam-noise-bleed',
  'imam-multi-qari',
  'imam-mid-ayah-pause',
];

export type ImamFixturesArgs = {
  force: boolean;
  help: boolean;
};

export function resolveImamReleaseTag(env: NodeJS.Dict<string> = process.env): string {
  const tag = env.ZIKRIST_IMAM_RELEASE_TAG?.trim();
  return tag && tag.length > 0 ? tag : DEFAULT_IMAM_RELEASE_TAG;
}

export function imamFixturesReleasesPageUrl(repo = IMAM_RELEASE_REPO): string {
  return `https://github.com/${repo}/releases`;
}

export function imamFixturesReleaseUrl(options?: {
  tag?: string;
  repo?: string;
  asset?: string;
  env?: NodeJS.Dict<string>;
}): string {
  const tag = options?.tag ?? resolveImamReleaseTag(options?.env);
  const repo = options?.repo ?? IMAM_RELEASE_REPO;
  const asset = options?.asset ?? IMAM_RELEASE_ASSET;
  return `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}/${asset}`;
}

export function parseImamFixturesArgs(argv: string[]): ImamFixturesArgs {
  let force = false;
  let help = false;
  for (const arg of argv) {
    if (arg === '--force' || arg === '-f') force = true;
    else if (arg === '--help' || arg === '-h') help = true;
    else throw new Error(`Unknown argument ${arg}. Use --force or --help.`);
  }
  return { force, help };
}

export function imamDir(repoRoot = root): string {
  return path.join(repoRoot, IMAM_AUDIO_ROOT);
}

function isInside(rootDir: string, candidate: string): boolean {
  const base = path.resolve(rootDir);
  const resolved = path.resolve(candidate);
  return resolved === base || resolved.startsWith(`${base}${path.sep}`);
}

export function findSuiteWav(dir: string): string | null {
  if (!fs.existsSync(dir)) return null;
  const base = path.resolve(dir);
  const stack = [base];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (!isInside(base, current)) continue;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (!isInside(base, full) || entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && /\.wav$/i.test(entry.name)) {
        try {
          if (fs.statSync(full).size >= MIN_WAV_BYTES) return full;
        } catch {
          continue;
        }
      }
    }
  }
  return null;
}

export function imamFixturesAlreadyPresent(directory = imamDir()): boolean {
  const labels = path.join(directory, 'LABELS.md');
  if (!fs.existsSync(labels) || !fs.statSync(labels).isFile()) return false;
  return findSuiteWav(directory) !== null;
}

/** Copy Qiyam 36:16–18 under the sibling suite id so clipsFromStub resolves. */
export function stageImamMidSurahColdQiyamClip(directory = imamDir()): boolean {
  const src = path.join(directory, QIYAM_SIBLING_SOURCE);
  if (!fs.existsSync(src) || !fs.statSync(src).isFile()) return false;
  const destDir = path.join(directory, QIYAM_SIBLING_DEST_DIR);
  const dest = path.join(destDir, QIYAM_SIBLING_CLIP);
  fs.mkdirSync(destDir, { recursive: true });
  const srcSize = fs.statSync(src).size;
  if (fs.existsSync(dest) && fs.statSync(dest).size === srcSize) return true;
  fs.copyFileSync(src, dest);
  return true;
}

export function missingImamReleaseError(url: string, status = 404, tag = resolveImamReleaseTag()): Error {
  return new Error(
    [
      `Imam fixture zip is not on GitHub Releases yet (HTTP ${status}).`,
      `Expected tag: ${tag}`,
      `Expected asset: ${IMAM_RELEASE_ASSET}`,
      `Download URL: ${url}`,
      `Releases page: ${imamFixturesReleasesPageUrl()}`,
      'Maintainer: create that tag and upload the zip (~557 MB). Friends should not use git LFS; audio stays out of git.',
    ].join('\n'),
  );
}

export function hasPayloadMarker(directory: string): boolean {
  return PAYLOAD_MARKERS.some((marker) => fs.existsSync(path.join(directory, marker)));
}

export function resolveImamPayloadRoot(extracted: string): string {
  if (hasPayloadMarker(extracted)) return extracted;
  const nestedDefault = path.join(extracted, 'artifacts/recitation/imam');
  if (hasPayloadMarker(nestedDefault) || fs.existsSync(nestedDefault)) return nestedDefault;
  const dirs = fs.existsSync(extracted)
    ? fs.readdirSync(extracted, { withFileTypes: true }).filter((entry) => (
      entry.isDirectory() && entry.name !== '__MACOSX' && !entry.name.startsWith('.')
    ))
    : [];
  if (dirs.length === 1) {
    const nested = path.join(extracted, dirs[0]!.name);
    if (hasPayloadMarker(nested)) return nested;
    const deeper = path.join(nested, 'artifacts/recitation/imam');
    if (hasPayloadMarker(deeper) || fs.existsSync(deeper)) return deeper;
  }
  throw new Error(
    `Zip did not contain expected imam layout (LABELS.md, labels.json, suite folders, _inbox/, or sources/) under ${extracted}`,
  );
}

export function nextSteps(tag: string): string[] {
  return [
    `Restored ${IMAM_AUDIO_ROOT}/ from GitHub Release tag ${tag}.`,
    'Ground truth labels stay in git: prompts/real-imam/LABELS.md and labels.json.',
    'Ready real-imam: imam-mid-surah-cold (Subayyal 4:129-130) and imam-mid-surah-cold-qiyam (Ya-Sin 36:16-18). Other suites stay stub.',
    'Continue:',
    '  npm run test:replay -- imam-mid-surah-cold',
    '  npm run test:replay -- imam-mid-surah-cold-qiyam',
    '  npm run liturgy:tts -- liturgy-takbeer --engine say',
    '  npm run test:replay -- all',
    '  npm run test:replay -- real-imam',
    'Liturgy TTS wavs are gitignored. See SETUP.md.',
  ];
}

function printHelp() {
  console.log([
    'Restore founder imam evaluation clips from GitHub Releases (not git LFS).',
    '',
    '  npm run fixtures:imam',
    '  npm run fixtures:imam -- --force',
    '',
    `Default tag: ${DEFAULT_IMAM_RELEASE_TAG}`,
    'Override:    ZIKRIST_IMAM_RELEASE_TAG',
    `Asset:       ${IMAM_RELEASE_ASSET}`,
    `URL:         ${imamFixturesReleaseUrl()}`,
    '',
    'Unpacks into artifacts/recitation/imam/ (gitignored).',
    'Skips when LABELS.md and at least one suite wav already exist.',
  ].join('\n'));
}

async function downloadToFile(url: string, destination: string, tag: string) {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'follow',
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (response.status === 404) throw missingImamReleaseError(url, 404, tag);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} downloading ${url}\nReleases page: ${imamFixturesReleasesPageUrl()}`);
  }
  if (!response.body) throw new Error(`Empty body downloading ${url}`);
  await pipeline(
    Readable.fromWeb(response.body as import('node:stream/web').ReadableStream<Uint8Array>),
    fs.createWriteStream(destination),
  );
}

function requireUnzipTool() {
  const unzip = spawnSync('unzip', ['-v'], { encoding: 'utf8' });
  if (unzip.status === 0) return 'unzip';
  const python = spawnSync('python3', ['-c', 'import zipfile'], { encoding: 'utf8' });
  if (python.status === 0) return 'python3';
  throw new Error('Need `unzip` or `python3` to unpack the imam fixture zip.');
}

function extractZip(zipPath: string, dest: string, tool: 'unzip' | 'python3') {
  fs.mkdirSync(dest, { recursive: true });
  if (tool === 'unzip') {
    const result = spawnSync('unzip', ['-o', '-q', zipPath, '-d', dest], { encoding: 'utf8' });
    if (result.status !== 0) {
      throw new Error(`unzip failed: ${result.stderr || result.stdout || `exit ${result.status}`}`);
    }
    return;
  }
  const script = [
    'import os, sys, zipfile',
    'zf = zipfile.ZipFile(sys.argv[1])',
    'dest = os.path.abspath(sys.argv[2])',
    'for info in zf.infolist():',
    '    name = info.filename.replace("\\\\", "/")',
    '    if name.startswith("/") or ".." in name.split("/"):',
    '        raise SystemExit(f"unsafe zip path: {info.filename}")',
    '    target = os.path.abspath(os.path.join(dest, name))',
    '    if target != dest and not target.startswith(dest + os.sep):',
    '        raise SystemExit(f"unsafe zip path: {info.filename}")',
    'zf.extractall(dest)',
  ].join('\n');
  const result = spawnSync('python3', ['-c', script, zipPath, dest], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`python zip extract failed: ${result.stderr || result.stdout || `exit ${result.status}`}`);
  }
}

function assertExtractedInside(directory: string) {
  const base = path.resolve(directory);
  const stack = [base];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (!isInside(base, current)) {
      throw new Error(`Zip extract escaped destination: ${current}`);
    }
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (!isInside(base, full)) throw new Error(`Zip extract escaped destination: ${full}`);
      if (entry.isDirectory() && !entry.isSymbolicLink()) stack.push(full);
    }
  }
}

export async function restoreImamFixtures(options?: {
  argv?: string[];
  env?: NodeJS.Dict<string>;
  repoRoot?: string;
}): Promise<{ status: 'skipped' | 'restored' | 'help'; url: string; tag: string }> {
  const args = parseImamFixturesArgs(options?.argv ?? process.argv.slice(2));
  const tag = resolveImamReleaseTag(options?.env);
  const url = imamFixturesReleaseUrl({ tag, env: options?.env });
  if (args.help) {
    printHelp();
    return { status: 'help', url, tag };
  }
  const directory = imamDir(options?.repoRoot);
  if (!args.force && imamFixturesAlreadyPresent(directory)) {
    console.log(`Imam fixtures already present under ${path.relative(options?.repoRoot ?? root, directory)}. Use --force to re-download.`);
    stageImamMidSurahColdQiyamClip(directory);
    for (const line of nextSteps(tag)) console.log(line);
    return { status: 'skipped', url, tag };
  }
  const tool = requireUnzipTool();
  fs.mkdirSync(directory, { recursive: true });
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'zikrist-imam-'));
  const zipPath = path.join(work, IMAM_RELEASE_ASSET);
  const extractDir = path.join(work, 'extract');
  try {
    console.log(`Downloading ${url}`);
    console.log('Expected size is about 557 MB. This can take several minutes.');
    await downloadToFile(url, zipPath, tag);
    extractZip(zipPath, extractDir, tool);
    assertExtractedInside(extractDir);
    const payload = resolveImamPayloadRoot(extractDir);
    fs.cpSync(payload, directory, { recursive: true });
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
  if (!imamFixturesAlreadyPresent(directory)) {
    console.warn('Unpacked zip, but LABELS.md plus a suite wav were not both found. Check the zip layout.');
  }
  stageImamMidSurahColdQiyamClip(directory);
  for (const line of nextSteps(tag)) console.log(line);
  return { status: 'restored', url, tag };
}

const invokedDirectly = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  try {
    await restoreImamFixtures();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
