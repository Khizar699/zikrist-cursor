import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QuranDB, type QuranVerse, type QuranChampionMatch, type TranscribeResult } from '@tilawa/core';
import {
  RecitationFollower,
  FOLLOW_TRIGGER_SEC,
  LOCK_GRACE_FAILS,
  type TranscribeFn,
} from '../src/core/follower';
import { formatAyahRef, latestDebugHud, resetDebugHud } from '../src/core/debug-hud';
import { lastRecognitionCycle, resetRecognitionCycles } from '../src/core/recognition-clocks';
import type { RecognitionMessage, VerseRef } from '../src/core/types';

/** In-memory mushaf rows only. No translation packs, no SQLite, no network.
 * Locks: monotonic follow, ayah-1 surah handoff, madd/CTC cousins that must
 * not Global Search. */
function verse(surah: number, ayah: number, words: string[], name = 'Test'): QuranVerse {
  const phonemes_joined = words.join(' ');
  return {
    surah, ayah, text_uthmani: phonemes_joined, surah_name: name, surah_name_en: name,
    phonemes: phonemes_joined, phonemes_joined, phoneme_words: words,
  };
}

function champion(row: QuranVerse, score: number, extra: Partial<QuranChampionMatch> = {}): QuranChampionMatch {
  return {
    surah: row.surah, ayah: row.ayah, text: row.phonemes_joined, phonemes_joined: row.phonemes_joined,
    score, raw_score: score, bonus: 0, ...extra,
  };
}

function spoken(row: QuranVerse, score = 0.86, extra: Partial<QuranChampionMatch> = {}): TranscribeResult {
  return { text: row.phonemes_joined, rawPhonemes: row.phonemes_joined, championMatch: champion(row, score, extra) };
}

function script(results: TranscribeResult[]): TranscribeFn {
  const queue = [...results];
  return async () => queue.shift() ?? { text: '', rawPhonemes: '' };
}

function audio(seconds: number, amplitude = 0.2): Float32Array {
  return new Float32Array(Math.round(16000 * seconds)).fill(amplitude);
}

function hop(): Float32Array {
  return audio(FOLLOW_TRIGGER_SEC);
}

function silence(seconds: number): Float32Array {
  return audio(seconds, 0);
}

function dbFrom(rows: QuranVerse[]): QuranDB {
  return new QuranDB(rows.map((item) => ({ ...item, phoneme_words: [...item.phoneme_words] })));
}

function trackingDb(rows: QuranVerse[]) {
  const db = dbFrom(rows);
  const lookups: VerseRef[] = [];
  const originalGet = db.getVerse.bind(db);
  db.getVerse = (surah: number, ayah: number) => {
    lookups.push({ surah, ayah });
    return originalGet(surah, ayah);
  };
  let searches = 0;
  const originalSearch = db.bestJoint03Match.bind(db);
  db.bestJoint03Match = (text: string) => {
    searches += 1;
    return originalSearch(text);
  };
  return {
    db,
    lookups: () => lookups.slice(),
    searches: () => searches,
    clearLookups() { lookups.length = 0; },
  };
}

function refs(messages: RecognitionMessage[]): string[] {
  return messages.filter((message) => message.type === 'verse_match').map((message) => `${message.surah}:${message.ayah}`);
}

function mushafOrder(key: string): number {
  const [surah, ayah] = key.split(':').map(Number);
  return (surah ?? 0) * 1000 + (ayah ?? 0);
}

function assertMonotonic(committed: string[]): void {
  for (let index = 1; index < committed.length; index++) {
    const previous = committed[index - 1]!;
    const current = committed[index]!;
    assert.ok(
      mushafOrder(current) >= mushafOrder(previous),
      `lock moved backwards ${previous} → ${current}`,
    );
  }
}

test('Sequential tracking advances monotonically with low latency', async () => {
  resetDebugHud();
  resetRecognitionCycles();
  const fatiha = [
    verse(1, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم'], 'Al-Fatihah'),
    verse(1, 2, ['الحمد', 'لله', 'رب', 'العلمين'], 'Al-Fatihah'),
    verse(1, 3, ['الرحمن', 'الرحيم'], 'Al-Fatihah'),
    verse(1, 4, ['ملك', 'يوم', 'الدين'], 'Al-Fatihah'),
  ];
  const one = fatiha[0]!;
  const two = fatiha[1]!;
  const three = fatiha[2]!;
  const { db, searches } = trackingDb(fatiha);
  const engine = new RecitationFollower(db, script([
    spoken(one),
    spoken(two),
    { text: three.phonemes_joined, rawPhonemes: three.phonemes_joined },
  ]));

  const committed: string[] = [];
  const followingSpaces: string[] = [];
  const hopMs: number[] = [];

  const observe = async (samples: Float32Array) => {
    const started = Date.now();
    committed.push(...refs(await engine.feed(samples)));
    hopMs.push(Date.now() - started);
    if (engine.phase === 'following') {
      const snap = latestDebugHud();
      followingSpaces.push(snap.searchSpace);
      assert.notEqual(snap.searchSpace, 'Global Search');
      assert.notEqual(snap.mode, 'GLOBAL');
      assert.equal(engine.phase, 'following');
      const cycle = lastRecognitionCycle();
      if (cycle?.phase === 'following') assert.equal(cycle.locateMs, 0);
    }
  };

  await observe(audio(1));
  const searchesBeforeFollow = searches();
  await observe(audio(1));
  assert.ok(committed.includes('1:2'), `expected 1:2 lock, got ${committed.join(',') || '(none)'}`);
  assert.equal(engine.phase, 'following');
  const searchesAtLock = searches();
  await observe(hop());

  assertMonotonic(committed);
  assert.ok(committed.includes('1:3'), `expected 1:3 lock, got ${committed.join(',') || '(none)'}`);
  assert.equal(committed.at(-1), '1:3');
  assert.deepEqual(engine.lockedRef, { surah: 1, ayah: 3 });
  assert.equal(engine.phase, 'following');
  assert.equal(searches(), searchesAtLock, 'following hops must not start Global Search');
  assert.ok(followingSpaces.length >= 1);
  assert.ok(followingSpaces.every((space) => space.startsWith('Locked:')));
  assert.ok(hopMs.at(-1)! < 100, `1:2→1:3 hop exceeded low-latency budget: ${hopMs.at(-1)}ms`);
  assert.equal(latestDebugHud().searchSpace, 'Locked: Ayahs 2–4');
  assert.ok(searchesBeforeFollow <= searchesAtLock);
});

test('Surah handoff strictly locks Ayah 1 and ignores mid/end-surah candidates', async () => {
  resetDebugHud();
  resetRecognitionCycles();
  const kafirun6 = verse(109, 6, ['لكم', 'دينكم', 'ولي', 'دين'], 'Al-Kafirun');
  const fil1 = verse(105, 1, ['ألم', 'تر', 'كيف', 'فعل', 'ربك', 'باصحب', 'الفيل'], 'Al-Fil');
  const fil5 = verse(105, 5, ['فجعلهم', 'كعصف', 'ماكول'], 'Al-Fil');
  const nisa1 = verse(4, 1, ['يايها', 'الناس', 'اتقوا', 'ربكم'], 'An-Nisa');
  const nisa142 = verse(4, 142, ['ان', 'المنافقين', 'يخادعون', 'الله', 'وهو', 'خادعهم'], 'An-Nisa');
  const { db, lookups, searches, clearLookups } = trackingDb([kafirun6, fil1, fil5, nisa1, nisa142]);
  const engine = new RecitationFollower(db, script([
    spoken(kafirun6),
    {
      text: 'ألم تر كيف فعل ربك',
      rawPhonemes: 'ألم تر كيف فعل ربك',
      championMatch: champion(nisa142, 0.99, {
        runners_up: [{
          surah: 105, ayah: 5, raw_score: 0.94, bonus: 0, score: 0.94,
          phonemes_joined: fil5.phonemes_joined,
        }],
      }),
    },
  ]));

  assert.deepEqual(refs(await engine.feed(audio(1))), ['109:6']);
  assert.equal(engine.phase, 'following');
  clearLookups();
  const jumped = refs(await engine.feed(hop()));
  const pool = lookups().filter((ref) => ref.surah !== 109);

  assert.ok(pool.length >= 1, 'expected a next-surah opening scan');
  assert.ok(pool.every((ref) => ref.ayah <= 2), `handoff pool leaked ayah>2: ${pool.map((ref) => `${ref.surah}:${ref.ayah}`).join(',')}`);
  assert.ok(!lookups().some((ref) => ref.surah === 4 && ref.ayah === 142), '4:142 must not enter the handoff pool');
  assert.ok(!lookups().some((ref) => ref.surah === 105 && ref.ayah === 5), '105:5 must not enter the handoff pool');
  assert.deepEqual(jumped, ['105:1']);
  assert.equal(formatAyahRef(engine.lockedRef), '[105:1]');
  assert.equal(engine.phase, 'following');
  assert.equal(searches(), 0);
  assert.notEqual(latestDebugHud().searchSpace, 'Global Search');
  assert.notEqual(latestDebugHud().mode, 'GLOBAL');
});

test('Tajweed elongation and breath pauses preserve sticky Ayah lock', async () => {
  resetDebugHud();
  resetRecognitionCycles();
  const six = verse(1, 6, ['اهدنا', 'الصرط', 'المستقيم'], 'Al-Fatihah');
  const seven = verse(1, 7, ['صرط', 'الذين', 'انعمت', 'عليهم', 'غير', 'المغضوب', 'عليهم', 'ولا', 'الضالين'], 'Al-Fatihah');
  const baqarah = verse(2, 1, ['الم'], 'Al-Baqarah');
  const { db, searches } = trackingDb([six, seven, baqarah]);
  const engine = new RecitationFollower(db, script([
    spoken(seven),
    { text: 'غير المغضوب عليهم ولا الضااالين', rawPhonemes: 'غير المغضوب عليهم ولا الضااالين' },
    { text: '', rawPhonemes: '' },
  ]));

  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:7']);
  assert.deepEqual(engine.lockedRef, { surah: 1, ayah: 7 });

  assert.deepEqual(refs(await engine.feed(hop())), []);
  let snap = latestDebugHud();
  assert.equal(engine.phase, 'following');
  assert.deepEqual(engine.lockedRef, { surah: 1, ayah: 7 });
  assert.ok(snap.misses <= LOCK_GRACE_FAILS);
  assert.notEqual(snap.searchSpace, 'Global Search');
  assert.equal(snap.mode, 'TRACKING');

  assert.deepEqual(refs(await engine.feed(silence(1))), []);
  snap = latestDebugHud();
  assert.equal(engine.phase, 'following');
  assert.deepEqual(engine.lockedRef, { surah: 1, ayah: 7 });
  assert.notEqual(formatAyahRef(engine.lockedRef), '[2:1]');
  assert.ok(
    snap.misses < snap.missThreshold,
    `breath pause dropped sticky lock: misses ${snap.misses}/${snap.missThreshold}`,
  );
  assert.notEqual(snap.searchSpace, 'Global Search');
  assert.notEqual(snap.mode, 'GLOBAL');
  assert.equal(searches(), 0);
  assert.equal(lastRecognitionCycle()?.locateMs, 0);
});
