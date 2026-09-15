import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  REQUIRED_SALAH_LITURGY_IDS,
  SALAH_LITURGY_ENGLISH_KIND,
  SALAH_LITURGY_HASH_FIELDS,
  SALAH_LITURGY_KIND,
  assertSalahLiturgyPack,
  collectSalahLiturgyErrors,
  normalizeLiturgyArabic,
  phraseHashPayload,
  type SalahLiturgyPack,
} from '../src/core/salah-liturgy';

function loadPack(): SalahLiturgyPack {
  const data: unknown = JSON.parse(readFileSync('assets/content/salah-liturgy.json', 'utf8'));
  assertSalahLiturgyPack(data);
  return data;
}

const pack = loadPack();

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

test('the salah liturgy pack matches the v1 schema and unique-id contract', () => {
  assert.deepEqual(collectSalahLiturgyErrors(pack), []);
  assert.equal(pack.kind, SALAH_LITURGY_KIND);
  assert.equal(pack.english_kind, SALAH_LITURGY_ENGLISH_KIND);
  assert.match(pack.english_label, /liturgy/i);
  assert.match(pack.english_label, /not a Quran translation/i);
  const ids = pack.phrases.map((phrase) => phrase.id);
  assert.equal(ids.length, new Set(ids).size);
  for (const id of REQUIRED_SALAH_LITURGY_IDS) assert.ok(ids.includes(id), id);
});

test('each liturgy row hashes its canonical fields and matches stripped Arabic', () => {
  assert.deepEqual([...SALAH_LITURGY_HASH_FIELDS], [
    'id', 'category', 'arabic_uthmani', 'arabic_recognition_normalized',
    'english', 'source_note', 'license_status',
  ]);
  for (const phrase of pack.phrases) {
    assert.equal(phrase.arabic_recognition_normalized, normalizeLiturgyArabic(phrase.arabic_uthmani), phrase.id);
    assert.equal(phrase.sha256, sha256(phraseHashPayload(phrase)), phrase.id);
    assert.match(phrase.license_status, /editorial_liturgy_gloss/);
  }
});

test('v1 pins takbeer, thana, ruku, sujood, and Ibn Masʿūd tashahhud', () => {
  const byId = new Map(pack.phrases.map((phrase) => [phrase.id, phrase]));
  assert.equal(byId.get('takbeer')?.arabic_recognition_normalized, 'الله أكبر');
  assert.equal(byId.get('thana')?.arabic_recognition_normalized, 'سبحانك اللهم وبحمدك وتبارك اسمك وتعالى جدك ولا إله غيرك');
  assert.equal(byId.get('ruku_tasbih')?.arabic_recognition_normalized, 'سبحان ربي العظيم');
  assert.equal(byId.get('sujood_tasbih')?.arabic_recognition_normalized, 'سبحان ربي الأعلى');
  assert.ok(byId.get('tashahhud')?.arabic_recognition_normalized.startsWith('التحيات لله'));
  assert.match(pack.edition.tashahhud, /Ibn Masʿūd|Ibn Mas'ud|Bukhari 831/i);
});

test('qunoot and Quran Basmala stay deferred rather than fake surahs', () => {
  const deferred = new Set(pack.deferred.map((row) => row.id));
  assert.ok(deferred.has('dua_qunoot'));
  assert.ok(deferred.has('basmala_liturgy'));
  assert.ok(!pack.phrases.some((phrase) => phrase.id === 'dua_qunoot' || phrase.id === 'basmala_liturgy'));
});

test('schema checks reject duplicate ids and empty hashes', () => {
  const clone = structuredClone(pack);
  clone.phrases[1] = { ...clone.phrases[1]!, id: clone.phrases[0]!.id };
  assert.ok(collectSalahLiturgyErrors(clone).some((error) => error.includes('duplicate')));
  const broken = structuredClone(pack);
  broken.phrases[0] = { ...broken.phrases[0]!, sha256: '' };
  assert.ok(collectSalahLiturgyErrors(broken).some((error) => error.includes('sha256')));
});
