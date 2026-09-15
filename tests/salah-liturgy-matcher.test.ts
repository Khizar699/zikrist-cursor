import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { VerseMatchMessage } from '@tilawa/core';
import {
  liturgyFollowContextBeforeFeed,
  matcherFromPack,
  packFromUnknown,
  runLiturgyAgainstQuran,
  type LiturgyObserveInput,
  type SalahLiturgyMatcher,
} from '../src/core/salah-liturgy-matcher';

const pack = packFromUnknown(JSON.parse(readFileSync('assets/content/salah-liturgy.json', 'utf8')));
const phraseTokens = (id: string): string[] => {
  const phrase = pack.phrases.find((row) => row.id === id);
  assert.ok(phrase, id);
  return phrase.arabic_recognition_normalized.split(/\s+/).filter(Boolean);
};

function matcher(): SalahLiturgyMatcher {
  return matcherFromPack(pack);
}

function input(tokens: string[], extra: Partial<LiturgyObserveInput> = {}): LiturgyObserveInput {
  return {
    tokens,
    atMs: extra.atMs ?? 1000,
    quranPhase: extra.quranPhase ?? 'acquiring',
    quranLock: extra.quranLock ?? null,
    ayahComplete: extra.ayahComplete,
    voiced: extra.voiced ?? true,
  };
}

function verse(surah: number, ayah: number): VerseMatchMessage {
  return {
    type: 'verse_match', surah, ayah, confidence: 0.9,
    verse_text: '', surah_name: '', surrounding_verses: [],
  };
}

test('takbeer locks on الله أكبر and not on الله alone', () => {
  const engine = matcher();
  const lock = engine.observe(input(phraseTokens('takbeer')));
  assert.equal(lock?.kind, 'salah_liturgy');
  assert.equal(lock?.phraseId, 'takbeer');
  assert.equal(lock?.category, 'takbeer');
  assert.equal(typeof lock?.atMs, 'number');
  assert.ok((lock?.confidence ?? 0) >= 0.99);
  assert.equal(matcher().observe(input(['الله'])), null);
});

test('takbeer does not spam mid-ayah Quran follow or inside the repeat window', () => {
  const mid = matcher().observe(input(phraseTokens('takbeer'), {
    quranPhase: 'following',
    quranLock: { surah: 1, ayah: 2 },
    ayahComplete: false,
  }));
  assert.equal(mid, null);
  const engine = matcher();
  assert.equal(engine.observe(input(phraseTokens('takbeer'), { atMs: 1000 }))?.phraseId, 'takbeer');
  assert.equal(engine.observe(input(phraseTokens('takbeer'), { atMs: 1500 })), null);
  assert.equal(engine.observe(input(phraseTokens('takbeer'), {
    atMs: 3300,
    quranPhase: 'following',
    quranLock: { surah: 1, ayah: 7 },
    ayahComplete: true,
  }))?.phraseId, 'takbeer');
});

test('thana, ruku, sujood, tashahhud, darood, and salam lock with corpus ids', () => {
  assert.equal(matcher().observe(input(phraseTokens('thana')))?.phraseId, 'thana');
  assert.equal(matcher().observe(input(phraseTokens('ruku_tasbih')))?.phraseId, 'ruku_tasbih');
  assert.equal(
    matcher().observe(input(phraseTokens('ruku_tasbih_wabihamdihi')))?.phraseId,
    'ruku_tasbih_wabihamdihi',
  );
  assert.equal(matcher().observe(input(phraseTokens('sujood_tasbih')))?.phraseId, 'sujood_tasbih');
  assert.equal(matcher().observe(input(phraseTokens('darood_ibrahim')))?.phraseId, 'darood_ibrahim');
  assert.equal(
    matcher().observe(input(phraseTokens('assalamu_alaikum_warahmatullah')))?.phraseId,
    'assalamu_alaikum_warahmatullah',
  );
});

test('tashahhud can lock across overlapping token windows', () => {
  const engine = matcher();
  const words = phraseTokens('tashahhud');
  assert.equal(engine.observe(input(words.slice(0, 10), { atMs: 1000 })), null);
  assert.equal(engine.observe(input(words.slice(6, 20), { atMs: 1400 })), null);
  const lock = engine.observe(input(words.slice(16), { atMs: 1800 }));
  assert.equal(lock?.phraseId, 'tashahhud');
  assert.equal(lock?.category, 'tashahhud');
});

test('istiʿadha locks; Falaq-like قل أعوذ برب does not', () => {
  assert.equal(matcher().observe(input(phraseTokens('istiadha')))?.phraseId, 'istiadha');
  assert.equal(matcher().observe(input(['قل', 'أعوذ', 'برب', 'الفلق'])), null);
});

test('short jami_bayn locks; isolated amin locks only when not mid-ayah', () => {
  assert.equal(
    matcher().observe(input(phraseTokens('rabbana_wa_lakal_hamd')))?.phraseId,
    'rabbana_wa_lakal_hamd',
  );
  assert.equal(matcher().observe(input(['آمين']))?.phraseId, 'amin');
  assert.equal(matcher().observe(input(['آمين'], {
    quranPhase: 'following',
    quranLock: { surah: 1, ayah: 7 },
    ayahComplete: false,
  })), null);
});

test('Quran-like Fatiha, Ikhlas, Asr, and Basmala windows do not emit liturgy', () => {
  const engine = matcher();
  assert.equal(engine.observe(input(['الحمد', 'لله', 'رب', 'العالمين'])), null);
  assert.equal(engine.observe(input(['قل', 'هو', 'الله', 'أحد'])), null);
  assert.equal(engine.observe(input(['qul', 'huwa', 'allahu', 'ahad'])), null);
  assert.equal(engine.observe(input(['والعصر'])), null);
  assert.equal(engine.observe(input(['بسم', 'الله', 'الرحمن', 'الرحيم'])), null);
});

test('liturgy windows drop Quran verse commits in the tested harness; Fatiha does not', () => {
  const thana = runLiturgyAgainstQuran(
    matcher(),
    input(phraseTokens('thana')),
    [verse(2, 32)],
  );
  assert.equal(thana.liturgy?.phraseId, 'thana');
  assert.equal(thana.quran.some((message) => message.type === 'verse_match'), false);

  const takbeer = runLiturgyAgainstQuran(
    matcher(),
    input(phraseTokens('takbeer'), { quranPhase: 'acquiring', quranLock: null }),
    [verse(21, 57)],
  );
  assert.equal(takbeer.liturgy?.phraseId, 'takbeer');
  assert.equal(takbeer.quran.some((message) => message.type === 'verse_match'), false);

  const fatiha = runLiturgyAgainstQuran(
    matcher(),
    input(['الحمد', 'لله', 'رب', 'العالمين']),
    [verse(1, 2)],
  );
  assert.equal(fatiha.liturgy, null);
  assert.deepEqual(fatiha.quran.map((message) => message.type === 'verse_match' ? `${message.surah}:${message.ayah}` : message.type), ['1:2']);
});

test('short liturgy uses follow state from before feed, not after a same-hop lock', () => {
  const before = liturgyFollowContextBeforeFeed({
    phase: 'acquiring',
    lockedRef: null,
    lockedAyahComplete: false,
  });
  assert.equal(before.quranPhase, 'acquiring');
  assert.equal(before.quranLock, null);
  const afterFalseLock = liturgyFollowContextBeforeFeed({
    phase: 'following',
    lockedRef: { surah: 21, ayah: 57 },
    lockedAyahComplete: false,
  });
  assert.equal(
    matcher().observe(input(phraseTokens('takbeer'), afterFalseLock)),
    null,
  );
  assert.equal(
    matcher().observe(input(phraseTokens('takbeer'), before))?.phraseId,
    'takbeer',
  );
});
