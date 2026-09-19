import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QuranDB, type QuranVerse, type QuranChampionMatch, type TranscribeResult } from '@tilawa/core';
import {
  RecitationFollower,
  FOLLOW_TRIGGER_SEC,
  KEEP_AFTER_COMMIT_SEC,
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

test('Al-Fatihah 1:2→1:3 advances without reacquire on a shared-prefix window', async () => {
  resetDebugHud();
  resetRecognitionCycles();
  const fatiha = [
    verse(1, 2, ['الحمد', 'لله', 'رب', 'العلمين'], 'Al-Fatihah'),
    verse(1, 3, ['الرحمن', 'الرحيم'], 'Al-Fatihah'),
    verse(1, 4, ['ملك', 'يوم', 'الدين'], 'Al-Fatihah'),
  ];
  const two = fatiha[0]!;
  const three = fatiha[1]!;
  const mixed = `${two.phonemes_joined} ${three.phonemes_joined}`;
  const { db, searches } = trackingDb(fatiha);
  const engine = new RecitationFollower(db, script([
    spoken(two),
    { text: mixed, rawPhonemes: mixed },
    { text: 'zzzz', rawPhonemes: 'zzzz' },
  ]));

  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:2']);
  assert.equal(engine.phase, 'following');
  const searchesAtLock = searches();
  assert.deepEqual(refs(await engine.feed(hop())), ['1:3']);
  assert.equal(engine.phase, 'following');
  assert.deepEqual(engine.lockedRef, { surah: 1, ayah: 3 });
  await engine.feed(hop());
  assert.equal(engine.phase, 'following', 'garbled hop after 1:3 must not reacquire');
  assert.equal(searches(), searchesAtLock);
});

test('completed ayah keeps lock across breath pause and partial next opening', async () => {
  resetDebugHud();
  resetRecognitionCycles();
  const fatiha = [
    verse(1, 2, ['الحمد', 'لله', 'رب', 'العلمين'], 'Al-Fatihah'),
    verse(1, 3, ['الرحمن', 'الرحيم'], 'Al-Fatihah'),
    verse(1, 4, ['ملك', 'يوم', 'الدين'], 'Al-Fatihah'),
    verse(2, 1, ['الم'], 'Al-Baqarah'),
  ];
  const two = fatiha[0]!;
  const three = fatiha[1]!;
  const { db, searches } = trackingDb(fatiha);
  const engine = new RecitationFollower(db, script([
    spoken(two),
    { text: two.phonemes_joined, rawPhonemes: two.phonemes_joined },
    { text: 'الرح', rawPhonemes: 'الرح' },
    { text: '', rawPhonemes: '' },
    { text: three.phonemes_joined, rawPhonemes: three.phonemes_joined },
  ]));

  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:2']);
  await engine.feed(hop());
  assert.equal(engine.phase, 'following');
  assert.deepEqual(engine.lockedRef, { surah: 1, ayah: 2 });

  await engine.feed(hop());
  let snap = latestDebugHud();
  assert.equal(engine.phase, 'following', 'partial next opening must not reacquire');
  assert.ok(engine.lockedRef?.surah === 1 && engine.lockedRef.ayah >= 2);
  assert.ok(snap.misses < LOCK_GRACE_FAILS);
  assert.notEqual(snap.mode, 'GLOBAL');

  await engine.feed(silence(1));
  snap = latestDebugHud();
  assert.equal(engine.phase, 'following', 'breath pause must stay on sequential bridge');
  assert.notEqual(snap.mode, 'GLOBAL');
  assert.ok(engine.lockedRef?.surah === 1 && engine.lockedRef.ayah >= 2);

  const afterNext = refs(await engine.feed(hop()));
  if (afterNext.length) assert.deepEqual(afterNext, ['1:3']);
  assert.equal(engine.lockedRef?.surah, 1);
  assert.ok((engine.lockedRef?.ayah ?? 0) >= 3);
  assert.equal(engine.phase, 'following');
  assert.equal(searches(), 0);
});

test('usable ASR during uncertain follow does not drop lock before grace misses', async () => {
  resetDebugHud();
  const fatiha = [
    verse(1, 2, ['الحمد', 'لله', 'رب', 'العلمين'], 'Al-Fatihah'),
    verse(1, 3, ['الرحمن', 'الرحيم'], 'Al-Fatihah'),
    verse(1, 4, ['مالك', 'يوم', 'الدين'], 'Al-Fatihah'),
  ];
  const two = fatiha[0]!;
  const three = fatiha[1]!;
  const engine = new RecitationFollower(dbFrom(fatiha), script([
    spoken(two),
    { text: three.phonemes_joined, rawPhonemes: three.phonemes_joined },
    { text: three.phonemes_joined, rawPhonemes: three.phonemes_joined },
    { text: three.phonemes_joined, rawPhonemes: three.phonemes_joined },
    { text: three.phonemes_joined, rawPhonemes: three.phonemes_joined },
    { text: three.phonemes_joined, rawPhonemes: three.phonemes_joined },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:2']);
  assert.deepEqual(refs(await engine.feed(hop())), ['1:3']);
  for (let i = 0; i < 4; i += 1) {
    await engine.feed(hop());
    assert.equal(engine.phase, 'following', `hop ${i + 1} must not reacquire on usable next-ayah ASR`);
    assert.ok(latestDebugHud().misses < LOCK_GRACE_FAILS);
  }
});

test('same-surah reacquire scores a local ayah band then trims the follow buffer', async () => {
  resetDebugHud();
  resetRecognitionCycles();
  const rows = Array.from({ length: 15 }, (_, index) => {
    const ayah = index + 1;
    return verse(99, ayah, [`marker${ayah}`, 'kelime', 'dort', 'harf'], 'Long');
  });
  rows[7] = verse(99, 8, ['min', 'sharri', 'alwaswas', 'alkhannas'], 'Long');
  rows[8] = verse(99, 9, ['alladhi', 'yuwaswisu', 'fi', 'suduri', 'alnnas'], 'Long');
  const eight = rows[7]!;
  const nine = rows[8]!;
  const { db, lookups, clearLookups } = trackingDb(rows);
  const engine = new RecitationFollower(db, script([
    spoken(eight),
    spoken(nine),
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['99:8']);
  (engine as unknown as { startReacquire: (clear?: boolean) => void }).startReacquire(false);
  clearLookups();
  assert.deepEqual(refs(await engine.feed(audio(1))), ['99:9']);
  assert.equal(engine.phase, 'following');
  const scored = lookups().filter((ref) => ref.surah === 99);
  assert.ok(
    scored.length > 0 && scored.length <= 6,
    `expected a bounded same-surah scan, got ${scored.map((ref) => `${ref.surah}:${ref.ayah}`).join(',')}`,
  );
  assert.ok(
    scored.every((ref) => ref.ayah >= 7 && ref.ayah <= 12),
    `local reacquire band leaked outside 7–12: ${scored.map((ref) => ref.ayah).join(',')}`,
  );
  assert.ok(
    latestDebugHud().bufferMs <= Math.round((KEEP_AFTER_COMMIT_SEC + 0.05) * 1000),
    `buffer not trimmed after reacquire commit: ${latestDebugHud().bufferMs}ms`,
  );
});

test('Al-Fatihah 1:5→1:7 survives weak ASR without reacquire', async () => {
  resetDebugHud();
  resetRecognitionCycles();
  const rows = [
    verse(1, 5, ['اياك', 'نعبد', 'واياك', 'نستعين'], 'Al-Fatihah'),
    verse(1, 6, ['اهدنا', 'الصرط', 'المستقيم'], 'Al-Fatihah'),
    verse(1, 7, ['صرط', 'الذين', 'انعمت', 'عليهم', 'غير', 'المغضوب', 'عليهم', 'ولا', 'الضالين'], 'Al-Fatihah'),
    verse(2, 1, ['الم'], 'Al-Baqarah'),
  ];
  const five = rows[0]!;
  const six = rows[1]!;
  const seven = rows[2]!;
  const { db, searches } = trackingDb(rows);
  const engine = new RecitationFollower(db, script([
    spoken(five),
    { text: 'zzzz garbled', rawPhonemes: 'zzzz garbled' },
    spoken(six),
    { text: 'yyyy weak', rawPhonemes: 'yyyy weak' },
    spoken(seven),
  ]));

  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:5']);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.equal(engine.phase, 'following');
  assert.deepEqual(engine.lockedRef, { surah: 1, ayah: 5 });
  assert.deepEqual(refs(await engine.feed(hop())), ['1:6']);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.equal(engine.phase, 'following');
  assert.deepEqual(engine.lockedRef, { surah: 1, ayah: 6 });
  assert.deepEqual(refs(await engine.feed(hop())), ['1:7']);
  assert.equal(engine.phase, 'following');
  assert.notEqual(formatAyahRef(engine.lockedRef), '[2:1]');
  assert.equal(searches(), 0);
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

test('Surah handoff: Nas keyword beats a 107:1 champion and stays off Global Search', async () => {
  resetDebugHud();
  resetRecognitionCycles();
  const ikhlas4 = verse(112, 4, ['ولم', 'يكن', 'له', 'كفوا', 'احد'], 'Al-Ikhlas');
  const maun1 = verse(107, 1, ['ارايت', 'الذي', 'يكذب', 'بالدين'], 'Al-Maun');
  const falaq1 = verse(113, 1, ['قل', 'اعوذ', 'برب', 'الفلق'], 'Al-Falaq');
  const nas1 = verse(114, 1, ['قل', 'اعوذ', 'برب', 'الناس'], 'An-Nas');
  const quraysh1 = verse(106, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'لإيلاف', 'قريش'], 'Quraysh');
  const naba1 = verse(78, 1, ['عم'], 'An-Naba');
  const { db, searches } = trackingDb([ikhlas4, maun1, falaq1, nas1, quraysh1, naba1]);
  const engine = new RecitationFollower(db, script([
    spoken(ikhlas4),
    {
      text: 'قل اعوذ برب الناس',
      rawPhonemes: 'قل اعوذ برب الناس',
      championMatch: champion(maun1, 0.99),
    },
  ]));

  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:4']);
  const started = Date.now();
  const jumped = refs(await engine.feed(hop()));
  const hopMs = Date.now() - started;
  assert.deepEqual(jumped, ['114:1']);
  assert.equal(formatAyahRef(engine.lockedRef), '[114:1]');
  assert.equal(searches(), 0);
  assert.ok(hopMs < 20, `Nas keyword handoff exceeded 20ms: ${hopMs}ms`);
  assert.notEqual(latestDebugHud().searchSpace, 'Global Search');
  assert.notEqual(latestDebugHud().mode, 'GLOBAL');
});
