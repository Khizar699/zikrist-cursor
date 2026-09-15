import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

/** Keep in sync with SALAH_LITURGY_HASH_FIELDS in src/core/salah-liturgy.ts. */
const HASH_FIELDS = [
  'id',
  'category',
  'arabic_uthmani',
  'arabic_recognition_normalized',
  'english',
  'source_note',
  'license_status',
];
const REQUIRED_IDS = [
  'takbeer',
  'thana',
  'istiadha',
  'ruku_tasbih',
  'sujood_tasbih',
  'sami_allahu_liman_hamidah',
  'rabbana_wa_lakal_hamd',
  'tashahhud',
  'darood_ibrahim',
  'amin',
  'assalamu_alaikum_warahmatullah',
];
const DEFERRED_IDS = [
  'basmala_liturgy',
  'dua_qunoot',
  'sitting_between_sujood',
  'istiftah_wajjahtu',
  'darood_ibrahim_fil_alamin',
  'istiadha_samee_aleem',
];
const MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF\u0640]/g;

function normalize(uthmani) {
  return uthmani.normalize('NFC').replace(MARKS, '').replace(/ٱ/g, 'ا').replace(/[\s\u00A0\u2000-\u200B]+/g, ' ').trim();
}

function phraseHash(phrase) {
  return createHash('sha256').update(HASH_FIELDS.map((field) => phrase[field]).join('\n'), 'utf8').digest('hex');
}

export async function verifySalahLiturgyPack(path = 'assets/content/salah-liturgy.json') {
  const pack = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(pack.pack_id, 'salah-liturgy');
  assert.equal(pack.version, 1);
  assert.equal(pack.kind, 'salah_liturgy');
  assert.equal(pack.english_kind, 'liturgy_gloss');
  assert.match(String(pack.english_label).toLowerCase(), /liturgy/);
  assert.match(String(pack.english_label), /not a quran translation/i);
  assert.match(pack.license_status, /unreviewed/);
  const deferred = new Set(pack.deferred.map((row) => row.id));
  for (const id of DEFERRED_IDS) assert.ok(deferred.has(id), `deferred missing ${id}`);
  assert.ok(Array.isArray(pack.phrases) && pack.phrases.length >= REQUIRED_IDS.length);
  const ids = new Set();
  for (const phrase of pack.phrases) {
    assert.match(phrase.id, /^[a-z][a-z0-9_]*$/);
    assert.equal(ids.has(phrase.id), false, `duplicate ${phrase.id}`);
    ids.add(phrase.id);
    for (const field of [...HASH_FIELDS, 'sha256']) {
      assert.equal(typeof phrase[field], 'string', `${phrase.id}.${field}`);
      assert.ok(phrase[field].trim(), `${phrase.id}.${field}`);
    }
    assert.equal(phrase.arabic_recognition_normalized, normalize(phrase.arabic_uthmani), phrase.id);
    assert.equal(phrase.sha256, phraseHash(phrase), phrase.id);
    assert.doesNotMatch(phrase.english, /quran translation/i);
  }
  for (const id of REQUIRED_IDS) assert.ok(ids.has(id), `missing ${id}`);
  console.log(`Salah liturgy pack v${pack.version}: ${pack.phrases.length} phrases, unique ids, schema, and SHA-256 verified.`);
  return pack;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await verifySalahLiturgyPack();
}
