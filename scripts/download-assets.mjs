import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { readFile, writeFile, mkdir, rename, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';

const manifest = JSON.parse(await readFile(new URL('../assets/manifest.json', import.meta.url), 'utf8'));
const root = path.resolve(import.meta.dirname, '..');
for (const asset of manifest.filter((asset) => !asset.archive)) {
  const destination = path.join(root, asset.path);
  let bytes;
  try { bytes = await readFile(destination); } catch { /* First setup. */ }
  const hash = (value) => createHash('sha256').update(value).digest('hex');
  if (!bytes || hash(bytes) !== asset.sha256) {
    console.log(`Downloading ${path.basename(destination)} (${(asset.bytes / 1e6).toFixed(1)} MB)`);
    const response = await fetch(asset.url, { headers: { 'User-Agent': 'Zikrist/0.1 (evaluation)' }, signal: AbortSignal.timeout(180_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${asset.url}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (hash(bytes) !== asset.sha256 || bytes.length !== asset.bytes) throw new Error(`Checksum mismatch: ${asset.path}. Do not update the trusted manifest automatically.`);
    await mkdir(path.dirname(destination), { recursive: true });
    const stage = `${destination}.partial`;
    try { await writeFile(stage, bytes); await rename(stage, destination); }
    finally { await rm(stage, { force: true }); }
  }
}
// Metro treats .json as JavaScript modules. .data keeps these large tables as
// lazy file assets, without embedding them in the compiled application bundle.
for (const name of ['vocab', 'quran_ctc_tokens', 'quran']) {
  await copyFile(path.join(root, `assets/model/${name}.json`), path.join(root, `assets/model/${name}.data`));
}
console.log('Pinned recognition assets are ready. Translation packs download inside the app.');
