import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { TextCTCDecoder, adaptQuranTextData, validateCtcTokenRoundTrip } from '@tilawa/core';

const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
for (const asset of (await json('assets/manifest.json')).filter((asset) => !asset.archive)) {
  const bytes = await readFile(asset.path);
  assert.equal(bytes.length, asset.bytes, asset.path);
  assert.equal(hash(bytes), asset.sha256, asset.path);
}
for (const name of ['vocab', 'quran_ctc_tokens', 'quran']) {
  assert.equal(hash(await readFile(`assets/model/${name}.data`)), hash(await readFile(`assets/model/${name}.json`)));
}
const canonical = await json('assets/content/quran-display.json');
const original = await readFile('assets/content/quran-uthmani.txt', 'utf8');
const verseMap = Object.fromEntries(original.split(/\r?\n/).filter((line) => /^\d+\|\d+\|/.test(line)).map((line) => {
  const [surah, ayah, ...text] = line.split('|'); return [`${surah}:${ayah}`, text.join('|')];
}));
assert.deepEqual(canonical.verses, verseMap, 'Canonical display must preserve source text exactly.');
assert.equal(Object.keys(verseMap).length, 6236);
assert.ok(canonical.notice.includes('PLEASE DO NOT REMOVE OR CHANGE THIS COPYRIGHT BLOCK'));
const quran = await json('assets/model/quran.json');
assert.equal(quran.length, 6236);
assert.equal(new Set(quran.map((verse) => `${verse.surah}:${verse.ayah}`)).size, 6236);
for (const verse of quran) assert.ok(verseMap[`${verse.surah}:${verse.ayah}`]);
const decoder = new TextCTCDecoder(await json('assets/model/vocab.json'), 1024);
const verses = adaptQuranTextData(quran, await json('assets/model/quran_ctc_tokens.json'), decoder);
const failures = validateCtcTokenRoundTrip(verses, decoder, verses.length);
assert.deepEqual(failures, []);
console.log('Model hashes, all 6,236 Arabic verses, canonical text, and all token round trips verified.');
for (const edition of await json('assets/content/languages.json')) {
  const filename = `artifacts/${edition.key}.sqlite`;
  let bytes;
  try { bytes = await readFile(filename); } catch {
    console.log(`${edition.key}: not downloaded on this development machine; runtime verifies the selected pack.`);
    continue;
  }
  assert.equal(hash(bytes), edition.sha256);
  const db = new DatabaseSync(filename, { readOnly: true });
  const rows = db.prepare('SELECT sura, aya, translation, footnotes FROM translations').all();
  assert.equal(rows.length, 6236);
  assert.equal(new Set(rows.map((row) => `${row.sura}:${row.aya}`)).size, 6236);
  for (const row of rows) {
    assert.ok(verseMap[`${row.sura}:${row.aya}`]);
    assert.ok(row.translation.trim());
    assert.equal(typeof row.footnotes, 'string');
  }
  db.close();
  console.log(`${edition.key}: hash, verse mapping, text and footnotes verified.`);
}
