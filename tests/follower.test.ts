import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QuranDB, type QuranVerse, type QuranChampionMatch, type TranscribeResult } from '@tilawa/core';
import { RecitationFollower, FOLLOW_TRIGGER_SEC, FOLLOW_WINDOW_SEC, type TranscribeFn } from '../src/core/follower';
import type { RecognitionMessage } from '../src/core/types';
import { lastRecognitionCycle, resetRecognitionCycles } from '../src/core/recognition-clocks';

function verse(surah: number, ayah: number, words: string[], name = 'Test'): QuranVerse {
  const phonemes_joined = words.join(' ');
  return {
    surah, ayah, text_uthmani: phonemes_joined, surah_name: name, surah_name_en: name,
    phonemes: phonemes_joined, phonemes_joined, phoneme_words: words,
  };
}

const corpus = [
  verse(1, 1, ['bismi', 'allahi', 'alrahman', 'alrahim'], 'Al-Fatihah'),
  verse(1, 2, ['alhamdu', 'lillahi', 'rabbi', 'alalamin'], 'Al-Fatihah'),
  verse(1, 3, ['alrahman', 'alrahim'], 'Al-Fatihah'),
  verse(1, 4, ['maliki', 'yawmi', 'aldin'], 'Al-Fatihah'),
  verse(1, 5, ['iyyaka', 'nabudu', 'wa', 'iyyaka', 'nastain'], 'Al-Fatihah'),
  verse(1, 6, ['ihdina', 'alsirata', 'almustaqeem'], 'Al-Fatihah'),
  verse(1, 7, ['sirata', 'alladhina', 'anamta', 'alayhim', 'ghayri', 'almaghdubi', 'alayhim', 'wala', 'alddallin'], 'Al-Fatihah'),
  verse(2, 1, ['bismi', 'allahi', 'alrahman', 'alrahim', 'alif', 'lam', 'meem'], 'Al-Baqarah'),
  verse(2, 126, ['rabbi', 'ijal', 'hadha', 'baladan'], 'Al-Baqarah'),
  verse(14, 39, ['alhamdu', 'lillahi', 'alladhi', 'wahaba', 'li', 'ala', 'alkibar', 'ismail', 'waishaq'], 'Ibrahim'),
  verse(14, 40, ['rabbi', 'ijalni', 'muqima', 'alsalah', 'wamin', 'dhurriyyati', 'rabbana', 'wataqabbal', 'dua'], 'Ibrahim'),
  verse(14, 41, ['rabbana', 'ighfir', 'li', 'waliwalidayya'], 'Ibrahim'),
  verse(36, 1, ['ya', 'seen'], 'Ya-Sin'),
  verse(108, 1, ['inna', 'aatayna', 'kalkawthar'], 'Al-Kawthar'),
  verse(108, 2, ['fasalli', 'lirabbika', 'wanhar'], 'Al-Kawthar'),
  verse(108, 3, ['inna', 'shaniaka', 'huwa', 'alabtar'], 'Al-Kawthar'),
  verse(109, 1, ['qul', 'ya', 'ayyuha', 'alkafirun'], 'Al-Kafirun'),
  verse(112, 1, ['qul', 'huwa', 'allahu', 'ahad'], 'Al-Ikhlas'),
  verse(112, 2, ['allahu', 'alsamad'], 'Al-Ikhlas'),
  verse(112, 3, ['lam', 'yalid', 'walam', 'yulad'], 'Al-Ikhlas'),
  verse(112, 4, ['walam', 'yakun', 'lahu', 'kufuwan', 'ahad'], 'Al-Ikhlas'),
  verse(113, 1, ['qul', 'audhu', 'birabbi', 'alfalaq'], 'Al-Falaq'),
  verse(113, 2, ['min', 'sharri', 'ma', 'khalaq'], 'Al-Falaq'),
  verse(114, 1, ['qul', 'audhu', 'birabbi', 'alnnas'], 'An-Nas'),
  verse(114, 2, ['maliki', 'alnnas'], 'An-Nas'),
  verse(114, 3, ['ilahi', 'alnnas'], 'An-Nas'),
  verse(114, 4, ['min', 'sharri', 'alwaswas', 'alkhannas'], 'An-Nas'),
  verse(114, 5, ['alladhi', 'yuwaswisu', 'fi', 'suduri', 'alnnas'], 'An-Nas'),
  verse(114, 6, ['mina', 'aljinnati', 'walnnas'], 'An-Nas'),
  verse(2, 109, [
    'wadda', 'katheerun', 'min', 'ahli', 'alkitabi', 'law', 'yaruddunakum',
    'min', 'badi', 'imanikum', 'kuffaran', 'hasadan', 'min', 'indi',
    'anfusihim', 'min', 'badi', 'ma', 'tabayyana', 'lahumu', 'alhaqqu',
    'faifu', 'waisfahu', 'hatta', 'yatiya', 'allahu', 'biamrihi',
    'inna', 'allaha', 'ala', 'kulli', 'shayin', 'qadeer',
  ], 'Al-Baqarah'),
];

function champion(surah: number, ayah: number, score: number, extra: Partial<QuranChampionMatch> = {}): QuranChampionMatch {
  const found = corpus.find((item) => item.surah === surah && item.ayah === ayah)!;
  return {
    surah, ayah, text: found.phonemes_joined, phonemes_joined: found.phonemes_joined,
    score, raw_score: score, bonus: 0, ...extra,
  };
}

function spoken(surah: number, ayah: number, score = 0.86, extra: Partial<QuranChampionMatch> = {}): TranscribeResult {
  const found = corpus.find((item) => item.surah === surah && item.ayah === ayah)!;
  return { text: found.phonemes_joined, rawPhonemes: found.phonemes_joined, championMatch: champion(surah, ayah, score, extra) };
}

function script(results: TranscribeResult[]): TranscribeFn {
  const queue = [...results];
  return async () => queue.shift() ?? { text: '', rawPhonemes: '' };
}

function audio(seconds: number): Float32Array {
  return new Float32Array(Math.round(16000 * seconds)).fill(0.2);
}

function hop(): Float32Array {
  return audio(FOLLOW_TRIGGER_SEC);
}

function dbFrom(rows = corpus): QuranDB {
  return new QuranDB(rows.map((item) => ({ ...item, phoneme_words: [...item.phoneme_words] })));
}

function countingDb(rows = corpus) {
  const db = dbFrom(rows);
  let searches = 0;
  const original = db.bestJoint03Match.bind(db);
  db.bestJoint03Match = (text: string) => {
    searches += 1;
    return original(text);
  };
  return { db, searches: () => searches };
}

function refs(messages: RecognitionMessage[]): string[] {
  return messages.filter((message) => message.type === 'verse_match').map((message) => `${message.surah}:${message.ayah}`);
}

function heard(messages: RecognitionMessage[]): string[] {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message?.type === 'heard_words') return message.words;
  }
  return [];
}

function follower(results: TranscribeResult[], db = dbFrom()): RecitationFollower {
  return new RecitationFollower(db, script(results));
}

test('Al-Fatihah locates from Alhamdulillah, not from a later ayah already in the window', async () => {
  const spoken = ['alhamdu', 'lillahi', 'rabbi', 'alalamin', 'alrahman', 'alrahim', 'maliki', 'yawmi', 'aldin'].join(' ');
  const engine = follower([{
    text: spoken,
    rawPhonemes: spoken,
    championMatch: champion(1, 1, 0.84, { ayah_end: 4 }),
  }]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:2']);
  assert.equal(engine.phase, 'following');
});

test('a unique stretch locks the ayah being recited, including a later ayah in a span', async () => {
  const nas4 = corpus.find((item) => item.surah === 114 && item.ayah === 4)!;
  const engine = follower([{
    text: nas4.phonemes_joined,
    rawPhonemes: nas4.phonemes_joined,
    championMatch: champion(114, 1, 0.84, { ayah_end: 4 }),
  }]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['114:4']);
  assert.equal(engine.phase, 'following');
});

test('Falaq and An-Nas staying tied does not lock a surah', async () => {
  const engine = follower([spoken(114, 1, 0.7, {
    runners_up: [{ surah: 113, ayah: 1, raw_score: 0.68, bonus: 0, score: 0.68, phonemes_joined: 'qul audhu birabbi alfalaq' }],
  })]);
  assert.deepEqual(refs(await engine.feed(audio(1))), []);
  assert.equal(engine.phase, 'acquiring');
});

test('the next ayah is committed from its own words, not from finishing the previous ayah', async () => {
  const engine = follower([spoken(112, 1), spoken(112, 1), spoken(112, 2)]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:1']);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), []);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), ['112:2']);
});

test('An-Nas can finish and Al-Fatihah can take over instead of freezing at the last surah', async () => {
  const engine = follower([
    spoken(114, 4),
    spoken(114, 5),
    spoken(114, 6),
    spoken(114, 6),
    spoken(1, 2),
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['114:4']);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), ['114:5']);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), ['114:6']);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), []);
  assert.equal(engine.phase, 'reacquiring');
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:2']);
  assert.equal(engine.phase, 'following');
});

test('Basmala after An-Nas does not lock Al-Fatihah; unique Ikhlas words do', async () => {
  const engine = follower([
    spoken(114, 4),
    spoken(114, 5),
    spoken(114, 6),
    spoken(114, 6),
    spoken(1, 1),
    spoken(112, 1),
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['114:4']);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), ['114:5']);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), ['114:6']);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), []);
  assert.equal(engine.phase, 'reacquiring');
  assert.deepEqual(refs(await engine.feed(audio(1))), []);
  assert.equal(engine.phase, 'reacquiring');
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:1']);
  assert.equal(engine.phase, 'following');
});

test('An-Nas ayah 3 can lock while Falaq stays a close rival', async () => {
  const nas3 = corpus.find((item) => item.surah === 114 && item.ayah === 3)!;
  const engine = follower([{
    text: nas3.phonemes_joined,
    rawPhonemes: nas3.phonemes_joined,
    championMatch: champion(114, 1, 0.7, {
      ayah_end: 3,
      runners_up: [{ surah: 113, ayah: 1, raw_score: 0.68, bonus: 0, score: 0.68, phonemes_joined: 'qul audhu birabbi alfalaq' }],
    }),
  }]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['114:3']);
  assert.equal(engine.phase, 'following');
});

test('finishing Ikhlas does not advance into Falaq from Basmala alone', async () => {
  const local = [
    verse(112, 4, ['walam', 'yakun', 'lahu', 'kufuwan', 'ahad'], 'Al-Ikhlas'),
    verse(113, 1, ['bismi', 'allahi', 'alrahman', 'alrahim', 'qul', 'audhu', 'birabbi', 'alfalaq'], 'Al-Falaq'),
  ];
  const engine = new RecitationFollower(
    new QuranDB(local.map((item) => ({ ...item, phoneme_words: [...item.phoneme_words] }))),
    script([
      spoken(112, 4),
      { text: 'bismi allahi alrahman alrahim', rawPhonemes: 'bismi allahi alrahman alrahim' },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:4']);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), []);
  assert.equal(engine.phase, 'following');
});

test('a kept window can still locate Al-Fatihah after the neighborhood fails', async () => {
  const fatiha = corpus.find((item) => item.surah === 1 && item.ayah === 2)!;
  const noise = { text: 'zzzz yyyy xxxx wwww', rawPhonemes: 'zzzz yyyy xxxx wwww' };
  const engine = follower([
    spoken(112, 4),
    noise,
    noise,
    { text: fatiha.phonemes_joined, rawPhonemes: fatiha.phonemes_joined, championMatch: champion(1, 2, 0.86) },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:4']);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), []);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), []);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), ['1:2']);
  assert.equal(engine.phase, 'following');
});

test('An-Nas ayah 3 is not replaced by a long unrelated ayah', async () => {
  const nas2 = corpus.find((item) => item.surah === 114 && item.ayah === 2)!;
  const nas3 = corpus.find((item) => item.surah === 114 && item.ayah === 3)!;
  const mixed = `${nas2.phonemes_joined} ${nas3.phonemes_joined}`;
  const engine = follower([
    spoken(114, 2),
    { text: mixed, rawPhonemes: mixed, championMatch: champion(2, 109, 0.88) },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['114:2']);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), ['114:3']);
});

test('a high-scoring long ayah does not first-lock from An-Nas ayah 3 audio', async () => {
  const nas3 = corpus.find((item) => item.surah === 114 && item.ayah === 3)!;
  const engine = follower([{
    text: nas3.phonemes_joined,
    rawPhonemes: nas3.phonemes_joined,
    championMatch: champion(2, 109, 0.88),
  }]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['114:3']);
  assert.equal(engine.phase, 'following');
});

test('shared Alhamdulillah does not lock Ibrahim 14:39', async () => {
  const engine = follower([{
    text: 'alhamdu lillahi',
    rawPhonemes: 'alhamdu lillahi',
    championMatch: champion(14, 39, 0.9),
  }]);
  assert.deepEqual(refs(await engine.feed(audio(1))), []);
  assert.equal(engine.phase, 'acquiring');
});

test('Al-Fatihah 1:2 still locks when the engine names Ibrahim 14:39', async () => {
  const fatiha = corpus.find((item) => item.surah === 1 && item.ayah === 2)!;
  const engine = follower([{
    text: fatiha.phonemes_joined,
    rawPhonemes: fatiha.phonemes_joined,
    championMatch: champion(14, 39, 0.9),
  }]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:2']);
  assert.equal(engine.phase, 'following');
});

test('Al-Fatihah leftover after a 14:39 lock does not advance to 14:40', async () => {
  const fatiha = corpus.find((item) => item.surah === 1 && item.ayah === 2)!;
  const engine = follower([
    spoken(14, 39),
    { text: fatiha.phonemes_joined, rawPhonemes: fatiha.phonemes_joined },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['14:39']);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.equal(engine.phase, 'following');
});

test('a wrong 14:40 lock then unique Al-Fatihah words leave Ibrahim', async () => {
  const engine = follower([spoken(14, 40), spoken(1, 5), spoken(1, 5)]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['14:40']);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.deepEqual(refs(await engine.feed(hop())), ['1:5']);
  assert.equal(engine.phase, 'following');
});

test('Ibrahim 14:40 still locks from its own unique words', async () => {
  const engine = follower([spoken(14, 40)]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['14:40']);
  assert.equal(engine.phase, 'following');
});

test('live Arabic الحمد لله does not lock 14:39, and رب العلمين does not become 14:40', async () => {
  const fatiha2 = verse(1, 2, ['الحمد', 'لله', 'رب', 'العلمين'], 'Al-Fatihah');
  const fatiha5 = verse(1, 5, ['اياك', 'نعبد', 'واياك', 'نستعين'], 'Al-Fatihah');
  const ibrahim39 = verse(14, 39, ['الحمد', 'لله', 'الذي', 'وهب', 'لي', 'علي', 'الكبر', 'اسمعيل', 'واسحق'], 'Ibrahim');
  const ibrahim40 = verse(14, 40, ['رب', 'اجعلني', 'مقيم', 'الصلوه', 'ومن', 'ذريتي', 'ربنا', 'وتقبل', 'دعاء'], 'Ibrahim');
  const ibrahim41 = verse(14, 41, ['ربنا', 'اغفر', 'لي'], 'Ibrahim');
  const baqarah126 = verse(2, 126, ['رب', 'اجعل', 'هذا', 'بلدا'], 'Al-Baqarah');
  const arabic = [fatiha2, fatiha5, baqarah126, ibrahim39, ibrahim40, ibrahim41];
  const prefix = new RecitationFollower(
    dbFrom(arabic),
    script([{
      text: 'الحمد لله',
      rawPhonemes: 'الحمد لله',
      championMatch: {
        surah: 14, ayah: 39, text: ibrahim39.phonemes_joined, phonemes_joined: ibrahim39.phonemes_joined,
        score: 0.9, raw_score: 0.9, bonus: 0,
      },
    }]),
  );
  assert.deepEqual(refs(await prefix.feed(audio(1))), []);
  assert.equal(prefix.phase, 'acquiring');

  const engine = new RecitationFollower(
    dbFrom(arabic),
    script([
      {
        text: ibrahim39.phonemes_joined, rawPhonemes: ibrahim39.phonemes_joined, championMatch: {
          surah: 14, ayah: 39, text: ibrahim39.phonemes_joined, phonemes_joined: ibrahim39.phonemes_joined,
          score: 0.9, raw_score: 0.9, bonus: 0,
        },
      },
      { text: fatiha2.phonemes_joined, rawPhonemes: fatiha2.phonemes_joined },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['14:39']);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.equal(engine.phase, 'following');
});

test('finishing 1:6 does not commit 1:7 from the shared sirat word', async () => {
  const engine = follower([spoken(1, 6), spoken(1, 6), spoken(1, 7)]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:6']);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), []);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), ['1:7']);
});

test('Al-Fatihah advances from Alhamdulillah to 1:3 from 1:3 words alone', async () => {
  const engine = follower([spoken(1, 2), spoken(1, 3)]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:2']);
  assert.deepEqual(refs(await engine.feed(hop())), ['1:3']);
});

test('live Arabic 1:3 still advances after a 1:2 lock', async () => {
  const arabic = [
    verse(1, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم'], 'Al-Fatihah'),
    verse(1, 2, ['الحمد', 'لله', 'رب', 'العلمين'], 'Al-Fatihah'),
    verse(1, 3, ['الرحمن', 'الرحيم'], 'Al-Fatihah'),
    verse(1, 4, ['ملك', 'يوم', 'الدين'], 'Al-Fatihah'),
  ];
  const two = arabic[1]!;
  const three = arabic[2]!;
  const engine = new RecitationFollower(
    dbFrom(arabic),
    script([
      { text: two.phonemes_joined, rawPhonemes: two.phonemes_joined, championMatch: {
        surah: 1, ayah: 2, text: two.phonemes_joined, phonemes_joined: two.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      } },
      { text: three.phonemes_joined, rawPhonemes: three.phonemes_joined },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:2']);
  assert.deepEqual(refs(await engine.feed(hop())), ['1:3']);
});

test('a follow window that still contains 1:2 can commit 1:3 from its own words', async () => {
  const mixed = ['alhamdu', 'lillahi', 'rabbi', 'alalamin', 'alrahman', 'alrahim'].join(' ');
  const engine = follower([
    spoken(1, 2),
    { text: mixed, rawPhonemes: mixed },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:2']);
  assert.deepEqual(refs(await engine.feed(hop())), ['1:3']);
});

test('Al-Fatihah advances from 1:5 to 1:6 from 1:6 words alone', async () => {
  const engine = follower([spoken(1, 5), spoken(1, 6)]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:5']);
  assert.deepEqual(refs(await engine.feed(hop())), ['1:6']);
});

test('a follow window that still contains the 1:5 tail commits 1:6 from its opening', async () => {
  const mixed = ['iyyaka', 'nastain', 'ihdina'].join(' ');
  const engine = follower([
    spoken(1, 5),
    { text: mixed, rawPhonemes: mixed },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:5']);
  assert.deepEqual(refs(await engine.feed(hop())), ['1:6']);
});

test('live Arabic 1:6 still advances after a 1:5 lock even with a 1:5 tail in the window', async () => {
  const arabic = [
    verse(1, 5, ['اياك', 'نعبد', 'واياك', 'نستعين'], 'Al-Fatihah'),
    verse(1, 6, ['اهدنا', 'الصرط', 'المستقيم'], 'Al-Fatihah'),
    verse(1, 7, ['صرط', 'الذين', 'انعمت', 'عليهم', 'غير', 'المغضوب', 'عليهم', 'ولا', 'الضالين'], 'Al-Fatihah'),
  ];
  const five = arabic[0]!;
  const mixed = ['واياك', 'نستعين', 'اهدنا'].join(' ');
  const engine = new RecitationFollower(
    dbFrom(arabic),
    script([
      { text: five.phonemes_joined, rawPhonemes: five.phonemes_joined, championMatch: {
        surah: 1, ayah: 5, text: five.phonemes_joined, phonemes_joined: five.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      } },
      { text: mixed, rawPhonemes: mixed },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:5']);
  assert.deepEqual(refs(await engine.feed(hop())), ['1:6']);
});

test('live Arabic 1:6 still needs unique 1:7 words after the shared sirat stem', async () => {
  const arabic = [
    verse(1, 6, ['اهدنا', 'الصرط', 'المستقيم'], 'Al-Fatihah'),
    verse(1, 7, ['صرط', 'الذين', 'انعمت', 'عليهم', 'غير', 'المغضوب', 'عليهم', 'ولا', 'الضالين'], 'Al-Fatihah'),
  ];
  const six = arabic[0]!;
  const seven = arabic[1]!;
  const engine = new RecitationFollower(
    dbFrom(arabic),
    script([
      { text: six.phonemes_joined, rawPhonemes: six.phonemes_joined, championMatch: {
        surah: 1, ayah: 6, text: six.phonemes_joined, phonemes_joined: six.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      } },
      { text: six.phonemes_joined, rawPhonemes: six.phonemes_joined },
      { text: seven.phonemes_joined, rawPhonemes: seven.phonemes_joined },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:6']);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.deepEqual(refs(await engine.feed(hop())), ['1:7']);
});

test('Basmala after Al-Fatihah does not continue into Al-Baqarah', async () => {
  const engine = follower([
    spoken(1, 7),
    { text: 'bismi allahi alrahman alrahim', rawPhonemes: 'bismi allahi alrahman alrahim' },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:7']);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), []);
  assert.equal(engine.phase, 'following');
});

test('Al-Falaq can take over after Al-Fatihah even when An-Nas stays a close rival', async () => {
  const falaq2 = corpus.find((item) => item.surah === 113 && item.ayah === 2)!;
  const engine = follower([
    spoken(1, 7),
    {
      text: falaq2.phonemes_joined,
      rawPhonemes: falaq2.phonemes_joined,
      championMatch: champion(113, 1, 0.7, {
        runners_up: [{ surah: 114, ayah: 1, raw_score: 0.68, bonus: 0, score: 0.68, phonemes_joined: 'qul audhu birabbi alnnas' }],
      }),
    },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:7']);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), ['113:2']);
  assert.equal(engine.phase, 'following');
});

test('after the neighborhood fails, a new ayah can still take over from its opening', async () => {
  const fatiha = corpus.find((item) => item.surah === 1 && item.ayah === 2)!;
  const engine = follower([
    spoken(112, 1),
    { text: 'zzzz yyyy xxxx wwww', rawPhonemes: 'zzzz yyyy xxxx wwww' },
    {
      text: fatiha.phonemes_joined,
      rawPhonemes: fatiha.phonemes_joined,
      championMatch: champion(1, 2, 0.86),
    },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:1']);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), []);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), ['1:2']);
});

test('follow overlap stays at most three windows of audio per second of recitation', () => {
  assert.ok(FOLLOW_WINDOW_SEC / FOLLOW_TRIGGER_SEC <= 3.01);
});

test('a locate window does not call bestJoint03Match again when a champion is already present', async () => {
  const { db, searches } = countingDb();
  const engine = new RecitationFollower(db, script([spoken(112, 1)]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:1']);
  assert.equal(searches(), 0);
});

test('after Kawthar, a later short surah is taken from the next-surah pool without a global search', async () => {
  const { db, searches } = countingDb();
  const engine = new RecitationFollower(db, script([
    spoken(108, 3),
    {
      text: corpus.find((item) => item.surah === 112 && item.ayah === 1)!.phonemes_joined,
      rawPhonemes: corpus.find((item) => item.surah === 112 && item.ayah === 1)!.phonemes_joined,
      championMatch: champion(2, 1, 0.7),
    },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['108:3']);
  assert.deepEqual(refs(await engine.feed(hop())), ['112:1']);
  assert.equal(searches(), 0);
});

test('after Kawthar, repeating Kawthar still locks from its opening', async () => {
  const engine = follower([
    spoken(108, 3),
    spoken(108, 1),
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['108:3']);
  assert.deepEqual(refs(await engine.feed(hop())), ['108:1']);
});

test('after Kawthar, Yasin can still lock from its opening', async () => {
  const engine = follower([
    spoken(108, 3),
    spoken(36, 1, 0.86),
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['108:3']);
  assert.deepEqual(refs(await engine.feed(hop())), ['36:1']);
});

test('after Kawthar, Basmala alone does not lock Al-Baqarah', async () => {
  const engine = follower([
    spoken(108, 3),
    { text: 'bismi allahi alrahman alrahim', rawPhonemes: 'bismi allahi alrahman alrahim' },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['108:3']);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.equal(engine.phase, 'following');
});

test('a last-10 prior cannot commit when a clearly better acoustic match exists', async () => {
  const baqarah = corpus.find((item) => item.surah === 2 && item.ayah === 109)!;
  const engine = follower([{
    text: baqarah.phonemes_joined,
    rawPhonemes: baqarah.phonemes_joined,
    championMatch: champion(114, 4, 0.7, {
      runners_up: [{
        surah: 2, ayah: 109, raw_score: 0.72, bonus: 0, score: 0.72, phonemes_joined: baqarah.phonemes_joined,
      }],
    }),
  }]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['2:109']);
});

test('local recognition clocks record a locate cycle without verse identifiers', async () => {
  resetRecognitionCycles();
  const engine = follower([{
    ...spoken(112, 1),
    timings: { onnxMs: 11, decodeMs: 3, locateMs: 5 },
  }]);
  await engine.feed(audio(1), { queueWaitMs: 8, stallMs: 1 });
  const cycle = lastRecognitionCycle();
  assert.ok(cycle);
  assert.equal(cycle!.onnxMs, 11);
  assert.equal(cycle!.decodeMs, 3);
  assert.equal(cycle!.locateMs, 5);
  assert.equal(cycle!.queueWaitMs, 8);
  assert.equal(cycle!.stallMs, 1);
  assert.equal(cycle!.phase, 'acquiring');
  assert.ok(cycle!.windowSec >= 0.9);
  assert.equal('text' in cycle!, false);
});

const qulLookalikes = [
  verse(10, 16, ['qul', 'law', 'shaa', 'allahu', 'ma', 'talawtuhu', 'alaykum', 'wala', 'adrakum', 'bihi'], 'Yunus'),
  verse(17, 110, ['qul', 'idau', 'allaha', 'awi', 'idau', 'alrahman'], 'Al-Isra'),
  verse(109, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'qul', 'ya', 'ayyuha', 'alkafirun'], 'Al-Kafirun'),
  verse(112, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'qul', 'huwa', 'allahu', 'ahad'], 'Al-Ikhlas'),
  verse(112, 2, ['allahu', 'alsamad'], 'Al-Ikhlas'),
  verse(113, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'qul', 'audhu', 'birabbi', 'alfalaq'], 'Al-Falaq'),
];

function qulChampion(surah: number, ayah: number, score: number): QuranChampionMatch {
  const found = qulLookalikes.find((item) => item.surah === surah && item.ayah === ayah)!;
  return {
    surah, ayah, text: found.phonemes_joined, phonemes_joined: found.phonemes_joined,
    score, raw_score: score, bonus: 0,
  };
}

test('a shared Qul opening pairs the heard word without naming an ayah', async () => {
  const engine = new RecitationFollower(dbFrom(qulLookalikes), script([{
    text: 'qul',
    rawPhonemes: 'qul',
    championMatch: qulChampion(10, 16, 0.9),
  }]));
  const messages = await engine.feed(audio(1));
  assert.deepEqual(refs(messages), []);
  assert.deepEqual(heard(messages), ['qul']);
  assert.equal(engine.phase, 'acquiring');
});

test('Qul then Allah does not first-lock a long lookalike such as Yunus 10:16', async () => {
  const engine = new RecitationFollower(dbFrom(qulLookalikes), script([{
    text: 'qul allahu ahad',
    rawPhonemes: 'qul allahu ahad',
    championMatch: qulChampion(10, 16, 0.92),
  }]));
  const messages = await engine.feed(audio(1));
  assert.deepEqual(refs(messages), []);
  assert.deepEqual(heard(messages), ['qul']);
  assert.equal(engine.phase, 'acquiring');
});

test('a short final ayah advances from a unique tail token when the opening is missing', async () => {
  const local = [
    verse(108, 2, ['فصل', 'لربك', 'وانحر'], 'Al-Kawthar'),
    verse(108, 3, ['ان', 'شانئك', 'هو', 'الابتر'], 'Al-Kawthar'),
  ];
  const two = local[0]!;
  const engine = new RecitationFollower(
    dbFrom(local),
    script([
      {
        text: two.phonemes_joined, rawPhonemes: two.phonemes_joined, championMatch: {
          surah: 108, ayah: 2, text: two.phonemes_joined, phonemes_joined: two.phonemes_joined,
          score: 0.86, raw_score: 0.86, bonus: 0,
        },
      },
      { text: 'الاب', rawPhonemes: 'الاب' },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['108:2']);
  assert.deepEqual(refs(await engine.feed(hop())), ['108:3']);
});

test('a short next ayah advances from unique later words when the opening was garbled', async () => {
  const local = [
    verse(106, 2, ['الفهم', 'رحله', 'الشتاء', 'والصيف'], 'Quraysh'),
    verse(106, 3, ['فليعبدوا', 'رب', 'هذا', 'البيت'], 'Quraysh'),
    verse(106, 4, ['الذي', 'اطعمهم', 'من', 'جوع'], 'Quraysh'),
  ];
  const two = local[0]!;
  const engine = new RecitationFollower(
    dbFrom(local),
    script([
      {
        text: two.phonemes_joined, rawPhonemes: two.phonemes_joined, championMatch: {
          surah: 106, ayah: 2, text: two.phonemes_joined, phonemes_joined: two.phonemes_joined,
          score: 0.86, raw_score: 0.86, bonus: 0,
        },
      },
      { text: 'هذا البيت', rawPhonemes: 'هذا البيت' },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['106:2']);
  assert.deepEqual(refs(await engine.feed(hop())), ['106:3']);
});

test('a garbled unique opening of the next short ayah still advances', async () => {
  const local = [
    verse(106, 2, ['الفهم', 'رحله', 'الشتاء', 'والصيف'], 'Quraysh'),
    verse(106, 3, ['فليعبدوا', 'رب', 'هذا', 'البيت'], 'Quraysh'),
  ];
  const two = local[0]!;
  const engine = new RecitationFollower(
    dbFrom(local),
    script([
      {
        text: two.phonemes_joined, rawPhonemes: two.phonemes_joined, championMatch: {
          surah: 106, ayah: 2, text: two.phonemes_joined, phonemes_joined: two.phonemes_joined,
          score: 0.86, raw_score: 0.86, bonus: 0,
        },
      },
      { text: 'بل يعبد', rawPhonemes: 'بل يعبد' },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['106:2']);
  assert.deepEqual(refs(await engine.feed(hop())), ['106:3']);
});

test('shared Basmala الرحمن does not first-lock a one-word ayah-1 echo such as 55:1', async () => {
  const local = [
    verse(1, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم'], 'Al-Fatihah'),
    verse(1, 2, ['الحمد', 'لله', 'رب', 'العلمين'], 'Al-Fatihah'),
    verse(55, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'الرحمن'], 'Ar-Rahman'),
    verse(55, 2, ['علم', 'القرءان'], 'Ar-Rahman'),
    verse(103, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'والعصر'], 'Al-Asr'),
  ];
  const rahman = local[2]!;
  const engine = new RecitationFollower(
    dbFrom(local),
    script([{
      text: 'بسم الله الرحمن الرحيم',
      rawPhonemes: 'بسم الله الرحمن الرحيم',
      championMatch: {
        surah: 55, ayah: 1, text: rahman.phonemes_joined, phonemes_joined: rahman.phonemes_joined,
        score: 0.92, raw_score: 0.92, bonus: 0,
      },
    }]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), []);
  assert.equal(engine.phase, 'acquiring');
});

test('a short Asr-like opening does not first-lock a distant lookalike', async () => {
  const local = [
    verse(103, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'والعصر'], 'Al-Asr'),
    verse(103, 2, ['ان', 'الانسن', 'لفي', 'خسر'], 'Al-Asr'),
    verse(51, 53, ['اتواصوا', 'به', 'بل', 'هم', 'قوم', 'طاغون'], 'Adh-Dhariyat'),
  ];
  const asr = local[0]!;
  const lookalike = local[2]!;
  const engine = new RecitationFollower(
    dbFrom(local),
    script([{
      text: asr.phoneme_words.at(-1)!,
      rawPhonemes: asr.phoneme_words.at(-1)!,
      championMatch: {
        surah: 51, ayah: 53, text: lookalike.phonemes_joined, phonemes_joined: lookalike.phonemes_joined,
        score: 0.88, raw_score: 0.88, bonus: 0,
      },
    }]),
  );
  const messages = await engine.feed(audio(1));
  assert.equal(refs(messages).includes('51:53'), false);
  assert.deepEqual(refs(messages), ['103:1']);
  assert.deepEqual(heard(messages), ['والعصر']);
});

test('Ikhlas audio locks 112:1 even when the engine names Yunus 10:16', async () => {
  const engine = new RecitationFollower(dbFrom(qulLookalikes), script([{
    text: 'qul huwa allahu ahad',
    rawPhonemes: 'qul huwa allahu ahad',
    championMatch: qulChampion(10, 16, 0.92),
  }]));
  const messages = await engine.feed(audio(1));
  assert.deepEqual(refs(messages), ['112:1']);
  assert.deepEqual(heard(messages), ['qul', 'huwa', 'allahu', 'ahad']);
  assert.equal(engine.phase, 'following');
});

