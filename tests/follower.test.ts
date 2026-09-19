import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QuranDB, type QuranVerse, type QuranChampionMatch, type TranscribeResult } from '@tilawa/core';
import {
  RecitationFollower,
  FOLLOW_TRIGGER_SEC,
  FOLLOW_WINDOW_SEC,
  FOLLOW_LAST_AYAH_ACCUMULATE_SEC,
  FOLLOW_SURAH_END_ACCUMULATE_SEC,
  ACQUIRE_MAX_SEC,
  ACQUIRE_AFTER_BASMALA_SEC,
  KEEP_AFTER_COMMIT_SEC,
  LOCK_GRACE_FAILS,
  LOCK_GRACE_MS,
  QURAN_SURAH_COUNT,
  stripProclitics,
  type TranscribeFn,
} from '../src/core/follower';
import type { RecognitionMessage } from '../src/core/types';
import { lastRecognitionCycle, resetRecognitionCycles } from '../src/core/recognition-clocks';
import { formatAyahRef, latestDebugHud, resetDebugHud } from '../src/core/debug-hud';

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
  verse(7, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'المص'], 'Al-Araf'),
  verse(14, 39, ['alhamdu', 'lillahi', 'alladhi', 'wahaba', 'li', 'ala', 'alkibar', 'ismail', 'waishaq'], 'Ibrahim'),
  verse(14, 40, ['rabbi', 'ijalni', 'muqima', 'alsalah', 'wamin', 'dhurriyyati', 'rabbana', 'wataqabbal', 'dua'], 'Ibrahim'),
  verse(14, 41, ['rabbana', 'ighfir', 'li', 'waliwalidayya'], 'Ibrahim'),
  verse(14, 42, ['wala', 'tahsabanna', 'allaha', 'ghafilan'], 'Ibrahim'),
  verse(27, 1, ['ta', 'seen'], 'An-Naml'),
  verse(27, 15, ['walaqad', 'atayna', 'dawuda', 'wasulaymana', 'ilman', 'waqala', 'alhamdu', 'lillahi', 'alladhi', 'faddalana'], 'An-Naml'),
  verse(36, 1, ['ya', 'seen'], 'Ya-Sin'),
  verse(105, 1, ['الم', 'تر', 'كيف', 'فعل', 'ربك', 'باصحب', 'الفيل'], 'Al-Fil'),
  verse(105, 5, ['فجعلهم', 'كعصف', 'ماكول'], 'Al-Fil'),
  verse(108, 1, ['inna', 'aatayna', 'kalkawthar'], 'Al-Kawthar'),
  verse(108, 2, ['fasalli', 'lirabbika', 'wanhar'], 'Al-Kawthar'),
  verse(108, 3, ['inna', 'shaniaka', 'huwa', 'alabtar'], 'Al-Kawthar'),
  verse(109, 1, ['qul', 'ya', 'ayyuha', 'alkafirun'], 'Al-Kafirun'),
  verse(109, 6, ['لكم', 'دينكم', 'ولي', 'دين'], 'Al-Kafirun'),
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

test('Nas opening tokens lock 114:1 without waiting for a tied mushaf champion', async () => {
  const { db, searches } = countingDb();
  const engine = new RecitationFollower(db, script([spoken(114, 1, 0.7, {
    runners_up: [{ surah: 113, ayah: 1, raw_score: 0.68, bonus: 0, score: 0.68, phonemes_joined: 'qul audhu birabbi alfalaq' }],
  })]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['114:1']);
  assert.equal(engine.phase, 'following');
  assert.equal(searches(), 0);
});

test('shared Qul-audhu-birabbi prefix does not cold-lock Falaq or Nas', async () => {
  const locateFlags: boolean[] = [];
  const transcribe: TranscribeFn = async (_audio, locate) => {
    locateFlags.push(locate);
    return { text: 'qul audhu birabbi', rawPhonemes: 'qul audhu birabbi' };
  };
  const engine = new RecitationFollower(dbFrom(), transcribe);
  assert.deepEqual(refs(await engine.feed(audio(1))), []);
  assert.equal(engine.phase, 'acquiring');
  assert.deepEqual(locateFlags, [true]);
});

test('the next ayah is committed from its own words, not from finishing the previous ayah', async () => {
  const engine = follower([spoken(112, 1), spoken(112, 1), spoken(112, 2)]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:1']);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), []);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), ['112:2']);
});

test('Ikhlas still advances when ayah-1 tail remains in the follow window', async () => {
  const mixed = [
    corpus.find((item) => item.surah === 112 && item.ayah === 1)!.phonemes_joined,
    corpus.find((item) => item.surah === 112 && item.ayah === 2)!.phonemes_joined,
  ].join(' ');
  const engine = follower([
    spoken(112, 1),
    { text: mixed, rawPhonemes: mixed, championMatch: champion(112, 1, 0.9) },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:1']);
  assert.deepEqual(refs(await engine.feed(hop())), ['112:2']);
});

test('Ikhlas 112:4 does not commit Asr 103:1 on isolated walasr while An-Nas follows', async () => {
  const asr1 = verse(103, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'والعصر'], 'Al-Asr');
  const nas1 = corpus.find((item) => item.surah === 114 && item.ayah === 1)!;
  const ikhlas4 = corpus.find((item) => item.surah === 112 && item.ayah === 4)!;
  const engine = new RecitationFollower(
    dbFrom([...corpus, asr1]),
    script([
      spoken(112, 4),
      {
        text: 'والعصر',
        rawPhonemes: 'والعصر',
        championMatch: {
          surah: 103, ayah: 1, text: asr1.phonemes_joined, phonemes_joined: asr1.phonemes_joined,
          score: 1, raw_score: 1, bonus: 0,
        },
      },
      spoken(114, 1, 0.9),
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:4']);
  const partial = refs(await engine.feed(hop()));
  assert.equal(partial.includes('103:1'), false);
  assert.equal(partial.includes('103:2'), false);
  assert.deepEqual(refs(await engine.feed(hop())), ['114:1']);
});

test('after Ikhlas 1, unique An-Nas words leave even if the engine still names 112:1', async () => {
  const nas = corpus.find((item) => item.surah === 114 && item.ayah === 1)!;
  const engine = follower([
    spoken(112, 1),
    {
      text: nas.phonemes_joined,
      rawPhonemes: nas.phonemes_joined,
      championMatch: champion(112, 1, 0.88, {
        runners_up: [{
          surah: 113, ayah: 1, raw_score: 0.8, bonus: 0, score: 0.8,
          phonemes_joined: corpus.find((item) => item.surah === 113 && item.ayah === 1)!.phonemes_joined,
        }],
      }),
    },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:1']);
  assert.deepEqual(refs(await engine.feed(hop())), ['114:1']);
});

test('after Ikhlas 1, unique Kafirun words leave even if the engine still names 112:1', async () => {
  const kafirun = corpus.find((item) => item.surah === 109 && item.ayah === 1)!;
  const engine = follower([
    spoken(112, 1),
    {
      text: kafirun.phonemes_joined,
      rawPhonemes: kafirun.phonemes_joined,
      championMatch: champion(112, 1, 0.88),
    },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:1']);
  assert.deepEqual(refs(await engine.feed(hop())), ['109:1']);
});

test('after Ikhlas 1, later Ikhlas ayahs still follow when 112:2 is missed', async () => {
  const three = corpus.find((item) => item.surah === 112 && item.ayah === 3)!;
  const engine = follower([
    spoken(112, 1),
    {
      text: three.phonemes_joined,
      rawPhonemes: three.phonemes_joined,
      championMatch: champion(112, 1, 0.84),
    },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:1']);
  assert.deepEqual(refs(await engine.feed(hop())), ['112:3']);
});

test('after 1:4, unique 1:5 words still advance when the engine names 2:1', async () => {
  const five = corpus.find((item) => item.surah === 1 && item.ayah === 5)!;
  const engine = follower([
    spoken(1, 4),
    {
      text: five.phonemes_joined,
      rawPhonemes: five.phonemes_joined,
      championMatch: champion(2, 1, 0.99),
    },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:4']);
  assert.deepEqual(refs(await engine.feed(hop())), ['1:5']);
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

test('the last ayah of a surah keeps an acquire-sized follow window so the next opening is heard whole', async () => {
  const falaq5 = verse(113, 5, ['ومن', 'شر', 'حاسد', 'اذا', 'حسد'], 'Al-Falaq');
  const local = [...corpus.filter((item) => item.surah !== 113), verse(113, 1, ['قل', 'اعوذ', 'برب', 'الفلق'], 'Al-Falaq'), falaq5];
  const windowsFor = async (first: QuranVerse) => {
    const windows: number[] = [];
    let hops = 0;
    const transcribe: TranscribeFn = async (samples) => {
      windows.push(Math.round((samples.length / 16000) * 100) / 100);
      hops += 1;
      if (hops === 1) {
        return {
          text: first.phonemes_joined,
          rawPhonemes: first.phonemes_joined,
          championMatch: {
            surah: first.surah, ayah: first.ayah, text: first.phonemes_joined, phonemes_joined: first.phonemes_joined,
            score: 0.9, raw_score: 0.9, bonus: 0,
          },
        };
      }
      return { text: '', rawPhonemes: '' };
    };
    const engine = new RecitationFollower(dbFrom(local), transcribe);
    assert.deepEqual(refs(await engine.feed(audio(1))), [`${first.surah}:${first.ayah}`]);
    for (let index = 0; index < 10; index += 1) await engine.feed(hop());
    assert.equal(engine.phase, 'following');
    return windows.slice(1);
  };
  // 113:5 is the last ayah of Al-Falaq: the window must grow to acquire size.
  const surahEnd = await windowsFor(falaq5);
  assert.ok(Math.max(...surahEnd) > FOLLOW_WINDOW_SEC + 0.05, `surah-end window stayed at ${Math.max(...surahEnd)}s`);
  assert.ok(Math.max(...surahEnd) <= FOLLOW_SURAH_END_ACCUMULATE_SEC + 0.05, `surah-end window ${Math.max(...surahEnd)}s`);
  // 114:1 is mid-surah: follow slices stay short.
  const midSurah = await windowsFor(local.find((item) => item.surah === 114 && item.ayah === 1)!);
  assert.ok(Math.max(...midSurah) <= FOLLOW_WINDOW_SEC + 0.05, `mid-surah window grew to ${Math.max(...midSurah)}s`);
});

test('Al-Falaq 113:5 hands off to An-Nas once قل اعوذ برب الناس is in one window, not on the shared prefix', async () => {
  const falaq5 = verse(113, 5, ['ومن', 'شر', 'حاسد', 'اذا', 'حسد'], 'Al-Falaq');
  const local = [...corpus.filter((item) => !(item.surah === 113 && item.ayah === 1)), verse(113, 1, ['قل', 'اعوذ', 'برب', 'الفلق'], 'Al-Falaq'), falaq5];
  const nas1 = verse(114, 1, ['قل', 'اعوذ', 'برب', 'الناس'], 'An-Nas');
  const arabic = local.filter((item) => item.surah !== 114).concat([nas1, verse(114, 2, ['ملك', 'الناس'], 'An-Nas')]);
  const engine = new RecitationFollower(dbFrom(arabic), script([
    {
      text: falaq5.phonemes_joined, rawPhonemes: falaq5.phonemes_joined, championMatch: {
        surah: 113, ayah: 5, text: falaq5.phonemes_joined, phonemes_joined: falaq5.phonemes_joined,
        score: 0.9, raw_score: 0.9, bonus: 0,
      },
    },
    { text: 'حسد قل اعوذ بربينا', rawPhonemes: 'حسد قل اعوذ بربينا' },
    { text: 'حسد قل اعوذ برب', rawPhonemes: 'حسد قل اعوذ برب' },
    { text: 'حسد قل اعوذ برب الناس', rawPhonemes: 'حسد قل اعوذ برب الناس' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['113:5']);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.equal(engine.phase, 'following');
  assert.deepEqual(refs(await engine.feed(hop())), ['114:1']);
  assert.deepEqual(engine.lockedRef, { surah: 114, ayah: 1 });
});

const falaqNasArabic = [
  verse(113, 1, ['قل', 'اعوذ', 'برب', 'الفلق'], 'Al-Falaq'),
  verse(113, 5, ['ومن', 'شر', 'حاسد', 'اذا', 'حسد'], 'Al-Falaq'),
  verse(114, 1, ['قل', 'اعوذ', 'برب', 'الناس'], 'An-Nas'),
  verse(114, 2, ['ملك', 'الناس'], 'An-Nas'),
  verse(114, 5, ['الذي', 'يوسوس', 'في', 'صدور', 'الناس'], 'An-Nas'),
  verse(114, 6, ['من', 'الجنه', 'والناس'], 'An-Nas'),
  verse(2, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'الم'], 'Al-Baqarah'),
  verse(2, 2, ['ذلك', 'الكتب', 'لا', 'ريب', 'فيه'], 'Al-Baqarah'),
  verse(10, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'الر', 'تلك', 'ءايت', 'الكتب', 'الحكيم'], 'Yunus'),
  verse(10, 2, ['اكان', 'للناس', 'عجبا', 'ان', 'اوحينا', 'الي', 'رجل', 'منهم', 'ان', 'انذر', 'الناس'], 'Yunus'),
];

function lockedOn(surah: number, ayah: number, rows = falaqNasArabic): TranscribeResult {
  const found = rows.find((item) => item.surah === surah && item.ayah === ayah)!;
  return {
    text: found.phonemes_joined,
    rawPhonemes: found.phonemes_joined,
    championMatch: {
      surah, ayah, text: found.phonemes_joined, phonemes_joined: found.phonemes_joined,
      score: 0.9, raw_score: 0.9, bonus: 0,
    },
  };
}

test('one CTC-crushed word (برب → ب) is stepped over when الناس confirms the next word', async () => {
  const engine = new RecitationFollower(dbFrom(falaqNasArabic), script([
    lockedOn(113, 5),
    { text: 'قل اعوذ ب الناس', rawPhonemes: 'قل اعوذ ب الناس' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['113:5']);
  assert.deepEqual(refs(await engine.feed(hop())), ['114:1']);
});

test('a crushed word is not stepped over when nothing confirms the following word', async () => {
  const engine = new RecitationFollower(dbFrom(falaqNasArabic), script([
    lockedOn(113, 5),
    { text: 'قل اعوذ ب', rawPhonemes: 'قل اعوذ ب' },
    { text: 'قل اعوذ ب الن', rawPhonemes: 'قل اعوذ ب الن' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['113:5']);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.deepEqual(engine.lockedRef, { surah: 113, ayah: 5 });
});

test('الم beside the mushaf-next opening word (الناس after 113:5) does not jump to Al-Baqarah', async () => {
  const engine = new RecitationFollower(dbFrom(falaqNasArabic), script([
    lockedOn(113, 5),
    { text: 'م الناس الم', rawPhonemes: 'م الناس الم' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['113:5']);
  const jumped = refs(await engine.feed(hop()));
  assert.ok(!jumped.includes('2:1'), `الناس + الم crumb must not lock 2:1, got ${jumped.join(',') || '(none)'}`);
});

test('madd garble of والناس inside 114:6 (المصدرص المه, الم من الجن) does not jump to Al-Baqarah', async () => {
  for (const text of ['المصدرص المه', 'الم من الجن', 'المي المصدر']) {
    const engine = new RecitationFollower(dbFrom(falaqNasArabic), script([
      lockedOn(114, 6),
      { text, rawPhonemes: text },
    ]));
    assert.deepEqual(refs(await engine.feed(audio(1))), ['114:6']);
    const jumped = refs(await engine.feed(hop()));
    assert.ok(!jumped.includes('2:1'), `${text} must not lock 2:1, got ${jumped.join(',') || '(none)'}`);
  }
});

test('الم crumb followed by the current ayah\'s own words (الم كتاب الله inside 4:131) stays in An-Nisa', async () => {
  const nisa131 = verse(4, 131, ['ولله', 'ما', 'في', 'السموت', 'وما', 'في', 'الارض', 'ولقد', 'وصينا', 'الذين', 'اوتوا', 'الكتب', 'من', 'قبلكم', 'واياكم', 'ان', 'اتقوا', 'الله'], 'An-Nisa');
  const nisa132 = verse(4, 132, ['ولله', 'ما', 'في', 'السموت', 'وما', 'في', 'الارض', 'وكفي', 'بالله', 'وكيلا'], 'An-Nisa');
  const rows = [...falaqNasArabic, nisa131, nisa132];
  const engine = new RecitationFollower(dbFrom(rows), script([
    lockedOn(4, 131, rows),
    { text: 'الم', rawPhonemes: 'الم' },
    { text: 'المين', rawPhonemes: 'المين' },
    { text: 'الم كتاب الله', rawPhonemes: 'الم كتاب الله' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['4:131']);
  const seen: string[] = [];
  for (let index = 0; index < 3; index += 1) seen.push(...refs(await engine.feed(hop())));
  assert.ok(!seen.some((ref) => ref.startsWith('2:') || ref.startsWith('3:')), `must stay in 4:131, got ${seen.join(',') || '(none)'}`);
  assert.deepEqual(engine.lockedRef, { surah: 4, ayah: 131 });
});

test('a single shared الناس cannot confirm Yunus 10:2 twice and lock 10:1 after 114:6', async () => {
  const engine = new RecitationFollower(dbFrom(falaqNasArabic), script([
    lockedOn(114, 6),
    { text: 'نهايهدرس', rawPhonemes: 'نهايهدرس' },
    { text: 'نهايهدرس', rawPhonemes: 'نهايهدرس' },
    { text: 'الناس', rawPhonemes: 'الناس' },
    { text: 'الناس', rawPhonemes: 'الناس' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['114:6']);
  const seen: string[] = [];
  for (let index = 0; index < 4; index += 1) seen.push(...refs(await engine.feed(audio(1))));
  assert.ok(!seen.includes('10:1'), `الناس alone must not lock 10:1, got ${seen.join(',') || '(none)'}`);
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
    spoken(112, 2),
    noise,
    noise,
    { text: fatiha.phonemes_joined, rawPhonemes: fatiha.phonemes_joined, championMatch: champion(1, 2, 0.86) },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:2']);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), []);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), []);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), ['1:2']);
  assert.equal(engine.phase, 'following');
});

test('live Arabic An-Nas still advances 114:2 to 114:3 when the follow window starts with الناس', async () => {
  const arabic = [
    verse(114, 2, ['ملك', 'الناس'], 'An-Nas'),
    verse(114, 3, ['اله', 'الناس'], 'An-Nas'),
    verse(114, 4, ['من', 'شر', 'الوسواس', 'الخناس'], 'An-Nas'),
  ];
  const two = arabic[0]!;
  const mixed = ['الناس', 'اله', 'الناس'].join(' ');
  const engine = new RecitationFollower(
    dbFrom(arabic),
    script([
      { text: two.phonemes_joined, rawPhonemes: two.phonemes_joined, championMatch: {
        surah: 114, ayah: 2, text: two.phonemes_joined, phonemes_joined: two.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      } },
      { text: mixed, rawPhonemes: mixed },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['114:2']);
  assert.deepEqual(refs(await engine.feed(hop())), ['114:3']);
});

test('live Arabic 1:6 still advances to 1:7 when the follow window starts with the shared صرط tail', async () => {
  const arabic = [
    verse(1, 6, ['اهدنا', 'الصرط', 'المستقيم'], 'Al-Fatihah'),
    verse(1, 7, ['صرط', 'الذين', 'انعمت', 'عليهم', 'غير', 'المغضوب', 'عليهم', 'ولا', 'الضالين'], 'Al-Fatihah'),
  ];
  const six = arabic[0]!;
  const mixed = ['المستقيم', 'صرط', 'الذين'].join(' ');
  const engine = new RecitationFollower(
    dbFrom(arabic),
    script([
      { text: six.phonemes_joined, rawPhonemes: six.phonemes_joined, championMatch: {
        surah: 1, ayah: 6, text: six.phonemes_joined, phonemes_joined: six.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      } },
      { text: mixed, rawPhonemes: mixed },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:6']);
  assert.deepEqual(refs(await engine.feed(hop())), ['1:7']);
});

test('live Arabic An-Nas still advances 114:2 to 114:3 when ASR hears الله الناس for إله الناس', async () => {
  const arabic = [
    verse(114, 2, ['ملك', 'الناس'], 'An-Nas'),
    verse(114, 3, ['اله', 'الناس'], 'An-Nas'),
    verse(114, 4, ['من', 'شر', 'الوسواس', 'الخناس'], 'An-Nas'),
  ];
  const two = arabic[0]!;
  const mixed = ['الناس', 'الله', 'الناس'].join(' ');
  const engine = new RecitationFollower(
    dbFrom(arabic),
    script([
      { text: two.phonemes_joined, rawPhonemes: two.phonemes_joined, championMatch: {
        surah: 114, ayah: 2, text: two.phonemes_joined, phonemes_joined: two.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      } },
      { text: mixed, rawPhonemes: mixed },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['114:2']);
  assert.deepEqual(refs(await engine.feed(hop())), ['114:3']);
});

test('live Arabic An-Nas does not advance 114:2 from the shared الناس word alone', async () => {
  const arabic = [
    verse(114, 2, ['ملك', 'الناس'], 'An-Nas'),
    verse(114, 3, ['اله', 'الناس'], 'An-Nas'),
    verse(114, 4, ['من', 'شر', 'الوسواس', 'الخناس'], 'An-Nas'),
  ];
  const two = arabic[0]!;
  const engine = new RecitationFollower(
    dbFrom(arabic),
    script([
      { text: two.phonemes_joined, rawPhonemes: two.phonemes_joined, championMatch: {
        surah: 114, ayah: 2, text: two.phonemes_joined, phonemes_joined: two.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      } },
      { text: 'الناس', rawPhonemes: 'الناس' },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['114:2']);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.equal(engine.lockedRef?.ayah, 2);
});

test('after a stuck 114:2, later An-Nas ayahs still follow instead of staying on الناس', async () => {
  const arabic = [
    verse(114, 2, ['ملك', 'الناس'], 'An-Nas'),
    verse(114, 3, ['اله', 'الناس'], 'An-Nas'),
    verse(114, 4, ['من', 'شر', 'الوسواس', 'الخناس'], 'An-Nas'),
    verse(114, 5, ['الذي', 'يوسوس', 'في', 'صدور', 'الناس'], 'An-Nas'),
  ];
  const two = arabic[0]!;
  const four = arabic[2]!;
  const five = arabic[3]!;
  const engine = new RecitationFollower(
    dbFrom(arabic),
    script([
      { text: two.phonemes_joined, rawPhonemes: two.phonemes_joined, championMatch: {
        surah: 114, ayah: 2, text: two.phonemes_joined, phonemes_joined: two.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      } },
      { text: four.phonemes_joined, rawPhonemes: four.phonemes_joined },
      { text: five.phonemes_joined, rawPhonemes: five.phonemes_joined },
      { text: five.phonemes_joined, rawPhonemes: five.phonemes_joined },
      { text: five.phonemes_joined, rawPhonemes: five.phonemes_joined },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['114:2']);
  const hops = [
    refs(await engine.feed(hop())),
    refs(await engine.feed(hop())),
    refs(await engine.feed(hop())),
    refs(await engine.feed(hop())),
  ];
  assert.ok(
    hops.some((item) => item.includes('114:4') || item.includes('114:5') || item.includes('114:3')),
    `stayed on 114:2 through later An-Nas audio: ${JSON.stringify(hops)}`,
  );
});

test('live Arabic Ikhlas still advances 112:1 to 112:2 when احد remains in the follow window', async () => {
  const arabic = [
    verse(112, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'قل', 'هو', 'الله', 'احد'], 'Al-Ikhlas'),
    verse(112, 2, ['الله', 'الصمد'], 'Al-Ikhlas'),
    verse(112, 3, ['لم', 'يلد', 'ولم', 'يولد'], 'Al-Ikhlas'),
  ];
  const one = arabic[0]!;
  const mixed = ['احد', 'الله', 'الصمد'].join(' ');
  const engine = new RecitationFollower(
    dbFrom(arabic),
    script([
      { text: one.phonemes_joined, rawPhonemes: one.phonemes_joined, championMatch: {
        surah: 112, ayah: 1, text: one.phonemes_joined, phonemes_joined: one.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      } },
      { text: mixed, rawPhonemes: mixed },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:1']);
  assert.deepEqual(refs(await engine.feed(hop())), ['112:2']);
});

test('after Ikhlas 2, distinctive 112:3 leftover then 112:4 leftover commit in order', async () => {
  const two = corpus.find((item) => item.surah === 112 && item.ayah === 2)!;
  const three = corpus.find((item) => item.surah === 112 && item.ayah === 3)!;
  const four = corpus.find((item) => item.surah === 112 && item.ayah === 4)!;
  const mixedThree = `${two.phonemes_joined} ${three.phonemes_joined}`;
  const mixedFour = `${three.phonemes_joined} ${four.phonemes_joined}`;
  const engine = follower([
    spoken(112, 2),
    { text: mixedThree, rawPhonemes: mixedThree },
    { text: mixedFour, rawPhonemes: mixedFour },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:2']);
  assert.deepEqual(refs(await engine.feed(hop())), ['112:3']);
  assert.deepEqual(refs(await engine.feed(hop())), ['112:4']);
});

test('after Ikhlas 2, unique 112:3 body يلد still advances without يولد', async () => {
  const arabic = [
    verse(112, 1, ['قل', 'هو', 'الله', 'احد'], 'Al-Ikhlas'),
    verse(112, 2, ['الله', 'الصمد'], 'Al-Ikhlas'),
    verse(112, 3, ['لم', 'يلد', 'ولم', 'يولد'], 'Al-Ikhlas'),
    verse(112, 4, ['ولم', 'يكن', 'له', 'كفوا', 'احد'], 'Al-Ikhlas'),
  ];
  const two = arabic[1]!;
  const leftover = ['الصمد', 'يلد'].join(' ');
  const engine = new RecitationFollower(
    dbFrom(arabic),
    script([
      { text: two.phonemes_joined, rawPhonemes: two.phonemes_joined, championMatch: {
        surah: 112, ayah: 2, text: two.phonemes_joined, phonemes_joined: two.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      } },
      { text: leftover, rawPhonemes: leftover },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:2']);
  assert.deepEqual(refs(await engine.feed(hop())), ['112:3']);
});

test('shared الله after Ikhlas 2 does not skip 112:3', async () => {
  const engine = follower([
    spoken(112, 2),
    { text: 'allahu', rawPhonemes: 'allahu' },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:2']);
  assert.deepEqual(refs(await engine.feed(hop())), []);
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
  const messages = await engine.feed(audio(1));
  assert.deepEqual(refs(messages), []);
  assert.deepEqual(heard(messages), ['alhamdu', 'lillahi']);
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

test('Alhamdulillah cold start does not lock Baqarah 2:1 when the engine names الم', async () => {
  const fatiha = corpus.find((item) => item.surah === 1 && item.ayah === 2)!;
  const engine = follower([{
    text: fatiha.phonemes_joined,
    rawPhonemes: fatiha.phonemes_joined,
    championMatch: champion(2, 1, 0.88),
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
  const next = refs(await engine.feed(hop()));
  assert.ok(!next.includes('14:40'), `must not skip to 14:40, got ${next.join(',')}`);
  assert.deepEqual(next, ['1:2']);
  assert.equal(engine.phase, 'following');
});

test('a wrong 14:40 lock then unique Al-Fatihah words leave Ibrahim', async () => {
  const engine = follower([spoken(14, 40), spoken(1, 2)]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['14:40']);
  assert.deepEqual(refs(await engine.feed(hop())), ['1:2']);
  assert.equal(engine.phase, 'following');
  assert.deepEqual(engine.lockedRef, { surah: 1, ayah: 2 });
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
  const prefixMessages = await prefix.feed(audio(1));
  assert.deepEqual(refs(prefixMessages), []);
  assert.deepEqual(heard(prefixMessages), ['الحمد', 'لله']);
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
  const switched = refs(await engine.feed(hop()));
  assert.ok(!switched.includes('14:40'), `must not skip to 14:40, got ${switched.join(',')}`);
  assert.deepEqual(switched, ['1:2']);
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

test('Fatiha 1:7 tail with weak 2:1 champion does not follow-commit Baqarah', async () => {
  const seven = corpus.find((item) => item.surah === 1 && item.ayah === 7)!;
  const engine = follower([
    spoken(1, 7),
    {
      text: seven.phonemes_joined,
      rawPhonemes: seven.phonemes_joined,
      championMatch: champion(2, 1, 0.4),
    },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:7']);
  const next = refs(await engine.feed(hop()));
  assert.ok(!next.includes('2:1'), `must not commit 2:1 on weak champion, got ${next.join(',')}`);
});

test('Fatiha leftover with Naml body tokens does not default to 2:1', async () => {
  const seven = corpus.find((item) => item.surah === 1 && item.ayah === 7)!;
  const naml = corpus.find((item) => item.surah === 27 && item.ayah === 15)!;
  const mixed = `${seven.phonemes_joined} ${naml.phonemes_joined}`;
  const engine = follower([
    spoken(1, 7),
    {
      text: mixed,
      rawPhonemes: mixed,
      championMatch: champion(2, 1, 0.9),
    },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:7']);
  const next = refs(await engine.feed(hop()));
  assert.ok(!next.includes('2:1'), `must not default to 2:1, got ${next.join(',')}`);
});

test('Yasin tokens at Fatiha 1:6 hand off to 36:1 without showing 2:1', async () => {
  const yasin = corpus.find((item) => item.surah === 36 && item.ayah === 1)!;
  const engine = follower([
    spoken(1, 6),
    {
      text: yasin.phonemes_joined,
      rawPhonemes: yasin.phonemes_joined,
      championMatch: champion(2, 1, 0.9),
    },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:6']);
  assert.deepEqual(refs(await engine.feed(hop())), ['36:1']);
});

test('Fatiha leftover الم الي does not default to 2:1', async () => {
  const engine = follower([
    spoken(1, 7),
    {
      text: 'الم الي',
      rawPhonemes: 'الم الي',
      championMatch: champion(2, 1, 0.99),
    },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:7']);
  const next = refs(await engine.feed(hop()));
  assert.ok(!next.includes('2:1') && !next.includes('7:1'), `must not default to 2:1/7:1, got ${next.join(',')}`);
});

test('Fatiha reacquire الل after الم الي does not lock 2:1 from remembered letters', async () => {
  const fatiha7 = verse(1, 7, ['sirata', 'alladhina', 'anamta', 'alayhim', 'ghayri', 'almaghdubi', 'alayhim', 'wala', 'alddallin'], 'Al-Fatihah');
  const baqarah1 = verse(2, 1, ['الم'], 'Al-Baqarah');
  const naml15 = verse(27, 15, ['walaqad', 'atayna', 'dawuda', 'wasulaymana', 'ilman'], 'An-Naml');
  const local = [fatiha7, baqarah1, naml15];
  const engine = new RecitationFollower(
    dbFrom(local),
    script([
      {
        text: fatiha7.phonemes_joined,
        rawPhonemes: fatiha7.phonemes_joined,
        championMatch: {
          surah: 1, ayah: 7, text: fatiha7.phonemes_joined, phonemes_joined: fatiha7.phonemes_joined,
          score: 0.86, raw_score: 0.86, bonus: 0,
        },
      },
      { text: 'نهايهدرس', rawPhonemes: 'نهايهدرس' },
      { text: 'نهايهدرس', rawPhonemes: 'نهايهدرس' },
      { text: 'نهايهدرس', rawPhonemes: 'نهايهدرس' },
      { text: 'الم الي', rawPhonemes: 'الم الي' },
      { text: 'الل', rawPhonemes: 'الل' },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:7']);
  for (let index = 0; index < 5; index++) {
    const got = refs(await engine.feed(hop()));
    assert.ok(!got.includes('2:1'), `hop ${index + 1} must not lock 2:1, got ${got.join(',')}`);
  }
});

test('Fatiha reacquire isolated الم does not lock 2:1', async () => {
  const fatiha7 = verse(1, 7, ['sirata', 'alladhina', 'anamta', 'alayhim', 'ghayri', 'almaghdubi', 'alayhim', 'wala', 'alddallin'], 'Al-Fatihah');
  const baqarah1 = verse(2, 1, ['الم'], 'Al-Baqarah');
  const naml15 = verse(27, 15, ['walaqad', 'atayna', 'dawuda', 'wasulaymana', 'ilman'], 'An-Naml');
  const local = [fatiha7, baqarah1, naml15];
  const engine = new RecitationFollower(
    dbFrom(local),
    script([
      {
        text: fatiha7.phonemes_joined,
        rawPhonemes: fatiha7.phonemes_joined,
        championMatch: {
          surah: 1, ayah: 7, text: fatiha7.phonemes_joined, phonemes_joined: fatiha7.phonemes_joined,
          score: 0.86, raw_score: 0.86, bonus: 0,
        },
      },
      { text: 'نهايهدرس', rawPhonemes: 'نهايهدرس' },
      { text: 'نهايهدرس', rawPhonemes: 'نهايهدرس' },
      { text: 'نهايهدرس', rawPhonemes: 'نهايهدرس' },
      { text: 'الم', rawPhonemes: 'الم' },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:7']);
  for (let index = 0; index < 4; index++) {
    const got = refs(await engine.feed(hop()));
    assert.ok(!got.includes('2:1'), `hop ${index + 1} must not lock 2:1, got ${got.join(',')}`);
  }
});

test('Fatiha leftover المستقيم does not default to 2:1', async () => {
  const engine = follower([
    spoken(1, 7),
    {
      text: 'sirata alladhina anamta alayhim ghayri almaghdubi alayhim wala alddallin almustaqeem',
      rawPhonemes: 'sirata alladhina anamta alayhim ghayri almaghdubi alayhim wala alddallin almustaqeem',
      championMatch: champion(2, 1, 0.99),
    },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:7']);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.equal(engine.phase, 'following');
});

test('Fatiha leftover الم still locks 2:1 when those letters are heard', async () => {
  const fatiha7 = verse(1, 7, ['sirata', 'alladhina', 'anamta', 'alayhim', 'ghayri', 'almaghdubi', 'alayhim', 'wala', 'alddallin'], 'Al-Fatihah');
  const baqarah1 = verse(2, 1, ['الم'], 'Al-Baqarah');
  const naml15 = verse(27, 15, ['walaqad', 'atayna', 'dawuda', 'wasulaymana', 'ilman'], 'An-Naml');
  const local = [fatiha7, baqarah1, naml15];
  const mixed = `${fatiha7.phonemes_joined} الم`;
  const engine = new RecitationFollower(
    dbFrom(local),
    script([
      {
        text: fatiha7.phonemes_joined,
        rawPhonemes: fatiha7.phonemes_joined,
        championMatch: {
          surah: 1, ayah: 7, text: fatiha7.phonemes_joined, phonemes_joined: fatiha7.phonemes_joined,
          score: 0.86, raw_score: 0.86, bonus: 0,
        },
      },
      {
        text: mixed,
        rawPhonemes: mixed,
        championMatch: {
          surah: 2, ayah: 1, text: baqarah1.phonemes_joined, phonemes_joined: baqarah1.phonemes_joined,
          score: 0.9, raw_score: 0.9, bonus: 0,
        },
      },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:7']);
  assert.deepEqual(refs(await engine.feed(hop())), ['2:1']);
});

test('Fatiha leftover Nas opening locks 114, not 2:1', async () => {
  const seven = corpus.find((item) => item.surah === 1 && item.ayah === 7)!;
  const nas = corpus.find((item) => item.surah === 114 && item.ayah === 1)!;
  const mixed = `${seven.phonemes_joined} ${nas.phonemes_joined}`;
  const engine = follower([
    spoken(1, 7),
    {
      text: mixed,
      rawPhonemes: mixed,
      championMatch: champion(2, 1, 0.9),
    },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:7']);
  assert.deepEqual(refs(await engine.feed(hop())), ['114:1']);
});

test('Al-Falaq ayah-1 can take over after Al-Fatihah even when An-Nas stays a close rival', async () => {
  const falaq1 = corpus.find((item) => item.surah === 113 && item.ayah === 1)!;
  const engine = follower([
    spoken(1, 7),
    {
      text: falaq1.phonemes_joined,
      rawPhonemes: falaq1.phonemes_joined,
      championMatch: champion(113, 1, 0.7, {
        runners_up: [{ surah: 114, ayah: 1, raw_score: 0.68, bonus: 0, score: 0.68, phonemes_joined: 'qul audhu birabbi alnnas' }],
      }),
    },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:7']);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), ['113:1']);
  assert.equal(engine.phase, 'following');
});

test('after the neighborhood fails, a new ayah can still take over from its opening', async () => {
  const fatiha = corpus.find((item) => item.surah === 1 && item.ayah === 2)!;
  const noise = { text: 'zzzz yyyy xxxx wwww', rawPhonemes: 'zzzz yyyy xxxx wwww' };
  const engine = follower([
    spoken(112, 1),
    noise,
    noise,
    {
      text: fatiha.phonemes_joined,
      rawPhonemes: fatiha.phonemes_joined,
      championMatch: champion(1, 2, 0.86),
    },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:1']);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), []);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), []);
  assert.deepEqual(refs(await engine.feed(audio(FOLLOW_TRIGGER_SEC))), ['1:2']);
});

test('follow overlap stays at most three windows of audio per second of recitation', () => {
  assert.ok(FOLLOW_WINDOW_SEC / FOLLOW_TRIGGER_SEC <= 3.01);
});

test('after advancing, follow infers on a short splice, not a full previous ayah', async () => {
  const engine = follower([spoken(112, 1), spoken(112, 2), spoken(112, 2)]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:1']);
  assert.deepEqual(refs(await engine.feed(hop())), ['112:2']);
  resetRecognitionCycles();
  await engine.feed(hop());
  const cycle = lastRecognitionCycle();
  assert.ok(cycle);
  assert.ok(
    cycle.windowSec <= KEEP_AFTER_COMMIT_SEC + FOLLOW_TRIGGER_SEC + 0.05,
    `follow window still carried previous-ayah audio: ${cycle.windowSec}`,
  );
  assert.ok(cycle.windowSec < 1, `expected splice under 1 s, got ${cycle.windowSec}`);
});

test('the first lock keeps a full second of the current ayah', async () => {
  const engine = follower([spoken(112, 1), spoken(112, 1)]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:1']);
  resetRecognitionCycles();
  await engine.feed(hop());
  const cycle = lastRecognitionCycle();
  assert.ok(cycle);
  assert.ok(cycle.windowSec > 1, `first-lock follow window too short: ${cycle.windowSec}`);
  assert.ok(cycle.windowSec <= FOLLOW_WINDOW_SEC + 0.05);
});

test('after the penultimate ayah is complete, follow accumulates a longer last-ayah window', async () => {
  const noise = { text: 'zzzz yyyy xxxx', rawPhonemes: 'zzzz yyyy xxxx' };
  const engine = follower([spoken(114, 5), noise, noise, noise, noise, noise]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['114:5']);
  resetRecognitionCycles();
  await engine.feed(hop());
  await engine.feed(hop());
  await engine.feed(audio(FOLLOW_LAST_AYAH_ACCUMULATE_SEC - FOLLOW_TRIGGER_SEC));
  const cycle = lastRecognitionCycle();
  assert.ok(cycle);
  assert.ok(
    cycle.windowSec > FOLLOW_WINDOW_SEC,
    `expected last-ayah window > ${FOLLOW_WINDOW_SEC}s, got ${cycle.windowSec}`,
  );
  assert.ok(cycle.windowSec <= FOLLOW_LAST_AYAH_ACCUMULATE_SEC + 0.05);
});

test('mid-surah follow keeps the default window even after extra audio', async () => {
  const noise = { text: 'zzzz yyyy xxxx', rawPhonemes: 'zzzz yyyy xxxx' };
  const engine = follower([spoken(112, 1), noise, noise, noise]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:1']);
  resetRecognitionCycles();
  await engine.feed(audio(2));
  const cycle = lastRecognitionCycle();
  assert.ok(cycle);
  assert.ok(cycle.windowSec <= FOLLOW_WINDOW_SEC + 0.05, `mid-surah window grew to ${cycle.windowSec}`);
});

test('a short last ayah still advances from a unique body token when the opening is missed', async () => {
  const engine = follower([
    spoken(114, 5),
    { text: 'aljinnati walnnas', rawPhonemes: 'aljinnati walnnas' },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['114:5']);
  assert.deepEqual(refs(await engine.feed(hop())), ['114:6']);
});

test('a garbage follow window cannot jump to a mysterious-letter ayah from a substring', async () => {
  const noise = {
    text: 'المصدر المدرس',
    rawPhonemes: 'المصدر المدرس',
    championMatch: champion(7, 1, 0.95),
  };
  const engine = follower([spoken(112, 1), noise, noise, noise, noise]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:1']);
  const jumped: string[] = [];
  for (let hopIndex = 0; hopIndex < 4; hopIndex++) {
    jumped.push(...refs(await engine.feed(hop())));
  }
  assert.deepEqual(jumped, []);
  assert.ok(engine.phase === 'following' || engine.phase === 'reacquiring');
});

test('after An-Nas ayah 5, a garbage window cannot jump to 7:1', async () => {
  const noise = {
    text: 'المصدر المدرس',
    rawPhonemes: 'المصدر المدرس',
    championMatch: champion(7, 1, 0.95),
  };
  const engine = follower([
    spoken(114, 5),
    noise, noise, noise, noise, noise, noise, noise, noise, noise, noise,
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['114:5']);
  resetRecognitionCycles();
  const jumped: string[] = [];
  jumped.push(...refs(await engine.feed(audio(FOLLOW_LAST_AYAH_ACCUMULATE_SEC))));
  const cycle = lastRecognitionCycle();
  assert.ok(cycle);
  assert.ok(
    cycle.windowSec >= FOLLOW_LAST_AYAH_ACCUMULATE_SEC - 0.05,
    `first last-ayah batch collapsed to ${cycle.windowSec}s`,
  );
  assert.ok(cycle.windowSec <= FOLLOW_LAST_AYAH_ACCUMULATE_SEC + 0.05);
  for (let hopIndex = 0; hopIndex < 8; hopIndex++) {
    jumped.push(...refs(await engine.feed(hop())));
  }
  assert.ok(!jumped.includes('7:1'), `false mysterious-letter lock: ${jumped.join(',')}`);
});

test('a locate window does not call bestJoint03Match again when a champion is already present', async () => {
  const { db, searches } = countingDb();
  const engine = new RecitationFollower(db, script([spoken(112, 1)]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:1']);
  assert.equal(searches(), 0);
});

test('after Kawthar, leftover قل هو الله locks 112:1 instead of a long ayah that repeats الله', async () => {
  const local = [
    verse(4, 113, ['ولولا', 'فضل', 'الله', 'عليك', 'ورحمته', 'وانزل', 'الله', 'عليك'], 'An-Nisa'),
    verse(4, 114, ['لا', 'خير', 'في', 'كثير', 'من', 'نجواهم', 'مرضات', 'الله'], 'An-Nisa'),
    verse(108, 3, ['ان', 'شانئك', 'هو', 'الابتر'], 'Al-Kawthar'),
    verse(112, 1, ['قل', 'هو', 'الله', 'احد'], 'Al-Ikhlas'),
    verse(112, 2, ['الله', 'الصمد'], 'Al-Ikhlas'),
  ];
  const three = local[2]!;
  const engine = new RecitationFollower(
    dbFrom(local),
    script([
      {
        text: three.phonemes_joined, rawPhonemes: three.phonemes_joined, championMatch: {
          surah: 108, ayah: 3, text: three.phonemes_joined, phonemes_joined: three.phonemes_joined,
          score: 0.86, raw_score: 0.86, bonus: 0,
        },
      },
      { text: 'قل هو الله', rawPhonemes: 'قل هو الله' },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['108:3']);
  assert.deepEqual(refs(await engine.feed(hop())), ['112:1']);
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

test('after Asr last ayah, leftover Quraysh ayah-1 tokens lock 106:1 while the 103:3 tail is still in the window', async () => {
  const local = [
    verse(103, 3, ['الا', 'الذين', 'امنوا', 'وعملوا', 'الصلحت', 'وتواصوا', 'بالحق', 'وتواصوا', 'بالصبر'], 'Al-Asr'),
    verse(104, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'ويل', 'لكل', 'همزة', 'لمزة'], 'Al-Humazah'),
    verse(106, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'لايلاف', 'قريش'], 'Quraysh'),
    verse(106, 2, ['الفهم', 'رحله', 'الشتاء', 'والصيف'], 'Quraysh'),
  ];
  const three = local[0]!;
  const mixed = ['بالصبر', 'لايلاف', 'قريش'].join(' ');
  const { db, searches } = countingDb(local);
  const engine = new RecitationFollower(db, script([
    {
      text: three.phonemes_joined, rawPhonemes: three.phonemes_joined, championMatch: {
        surah: 103, ayah: 3, text: three.phonemes_joined, phonemes_joined: three.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      },
    },
    { text: mixed, rawPhonemes: mixed },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['103:3']);
  assert.deepEqual(refs(await engine.feed(hop())), ['106:1']);
  assert.equal(engine.phase, 'following');
  assert.equal(searches(), 0);
});

test('after Asr last ayah, leftover Basmala does not lock mushaf-next Humazah', async () => {
  const local = [
    verse(103, 3, ['الا', 'الذين', 'امنوا', 'وعملوا', 'الصلحت', 'وتواصوا', 'بالحق', 'وتواصوا', 'بالصبر'], 'Al-Asr'),
    verse(104, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'ويل', 'لكل', 'همزة', 'لمزة'], 'Al-Humazah'),
    verse(106, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'لايلاف', 'قريش'], 'Quraysh'),
  ];
  const three = local[0]!;
  const engine = new RecitationFollower(
    dbFrom(local),
    script([
      {
        text: three.phonemes_joined, rawPhonemes: three.phonemes_joined, championMatch: {
          surah: 103, ayah: 3, text: three.phonemes_joined, phonemes_joined: three.phonemes_joined,
          score: 0.86, raw_score: 0.86, bonus: 0,
        },
      },
      { text: 'بسم الله الرحمن الرحيم', rawPhonemes: 'بسم الله الرحمن الرحيم' },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['103:3']);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.equal(engine.phase, 'following');
});

test('after Asr last ayah, garbled CTC قر قريش still locks 106:1', async () => {
  const local = [
    verse(103, 3, ['الا', 'الذين', 'امنوا', 'وعملوا', 'الصلحت', 'وتواصوا', 'بالحق', 'وتواصوا', 'بالصبر'], 'Al-Asr'),
    verse(104, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'ويل', 'لكل', 'همزة', 'لمزة'], 'Al-Humazah'),
    verse(106, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'لايلاف', 'قريش'], 'Quraysh'),
  ];
  const three = local[0]!;
  const engine = new RecitationFollower(
    dbFrom(local),
    script([
      {
        text: three.phonemes_joined, rawPhonemes: three.phonemes_joined, championMatch: {
          surah: 103, ayah: 3, text: three.phonemes_joined, phonemes_joined: three.phonemes_joined,
          score: 0.86, raw_score: 0.86, bonus: 0,
        },
      },
      { text: 'قر قريش', rawPhonemes: 'قر قريش' },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['103:3']);
  assert.deepEqual(refs(await engine.feed(hop())), ['106:1']);
});

test('after Asr last ayah, a lone قريش token does not lock 106:1', async () => {
  const local = [
    verse(103, 3, ['الا', 'الذين', 'امنوا', 'وعملوا', 'الصلحت', 'وتواصوا', 'بالحق', 'وتواصوا', 'بالصبر'], 'Al-Asr'),
    verse(106, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'لايلاف', 'قريش'], 'Quraysh'),
  ];
  const three = local[0]!;
  const engine = new RecitationFollower(
    dbFrom(local),
    script([
      {
        text: three.phonemes_joined, rawPhonemes: three.phonemes_joined, championMatch: {
          surah: 103, ayah: 3, text: three.phonemes_joined, phonemes_joined: three.phonemes_joined,
          score: 0.86, raw_score: 0.86, bonus: 0,
        },
      },
      { text: 'قريش', rawPhonemes: 'قريش' },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['103:3']);
  const jumped = refs(await engine.feed(hop()));
  assert.ok(!jumped.includes('106:1'), `lone قريش must not lock 106:1, got ${jumped.join(',') || '(none)'}`);
});

test('after Asr last ayah, leftover does not lock Layl 92:1', async () => {
  const local = [
    verse(103, 3, ['الا', 'الذين', 'امنوا', 'وعملوا', 'الصلحت', 'وتواصوا', 'بالحق', 'وتواصوا', 'بالصبر'], 'Al-Asr'),
    verse(92, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'والليل', 'اذا', 'يغشي'], 'Al-Layl'),
    verse(106, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'لايلاف', 'قريش'], 'Quraysh'),
  ];
  const three = local[0]!;
  const engine = new RecitationFollower(
    dbFrom(local),
    script([
      {
        text: three.phonemes_joined, rawPhonemes: three.phonemes_joined, championMatch: {
          surah: 103, ayah: 3, text: three.phonemes_joined, phonemes_joined: three.phonemes_joined,
          score: 0.86, raw_score: 0.86, bonus: 0,
        },
      },
      { text: 'الا الذين بالصبر', rawPhonemes: 'الا الذين بالصبر' },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['103:3']);
  const jumped = refs(await engine.feed(hop()));
  assert.ok(!jumped.includes('92:1'), `Asr leftover must not lock 92:1, got ${jumped.join(',') || '(none)'}`);
});

test('after Asr last ayah, leftover Quraysh tokens still lock 106:1 when the 103:3 opening has aged out', async () => {
  const local = [
    verse(103, 3, ['الا', 'الذين', 'امنوا', 'وعملوا', 'الصلحت', 'وتواصوا', 'بالحق', 'وتواصوا', 'بالصبر'], 'Al-Asr'),
    verse(104, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'ويل', 'لكل', 'همزة', 'لمزة'], 'Al-Humazah'),
    verse(106, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'لايلاف', 'قريش'], 'Quraysh'),
  ];
  const three = local[0]!;
  const mixed = ['وتواصوا', 'بالصبر', 'لايلاف', 'قريش'].join(' ');
  const engine = new RecitationFollower(
    dbFrom(local),
    script([
      {
        text: three.phonemes_joined, rawPhonemes: three.phonemes_joined, championMatch: {
          surah: 103, ayah: 3, text: three.phonemes_joined, phonemes_joined: three.phonemes_joined,
          score: 0.86, raw_score: 0.86, bonus: 0,
        },
      },
      { text: mixed, rawPhonemes: mixed },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['103:3']);
  assert.deepEqual(refs(await engine.feed(hop())), ['106:1']);
});

test('after Asr last ayah, a 103:3 interior token mixed with Quraysh still locks 106:1', async () => {
  const local = [
    verse(103, 3, ['الا', 'الذين', 'امنوا', 'وعملوا', 'الصلحت', 'وتواصوا', 'بالحق', 'وتواصوا', 'بالصبر'], 'Al-Asr'),
    verse(104, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'ويل', 'لكل', 'همزة', 'لمزة'], 'Al-Humazah'),
    verse(106, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'لايلاف', 'قريش'], 'Quraysh'),
  ];
  const three = local[0]!;
  const mixed = ['الذين', 'لايلاف', 'قريش'].join(' ');
  const engine = new RecitationFollower(
    dbFrom(local),
    script([
      {
        text: three.phonemes_joined, rawPhonemes: three.phonemes_joined, championMatch: {
          surah: 103, ayah: 3, text: three.phonemes_joined, phonemes_joined: three.phonemes_joined,
          score: 0.86, raw_score: 0.86, bonus: 0,
        },
      },
      { text: mixed, rawPhonemes: mixed },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['103:3']);
  assert.deepEqual(refs(await engine.feed(hop())), ['106:1']);
});

test('after Asr last ayah, Quraysh tokens before a 103:3 tail token still lock 106:1', async () => {
  const local = [
    verse(103, 3, ['الا', 'الذين', 'امنوا', 'وعملوا', 'الصلحت', 'وتواصوا', 'بالحق', 'وتواصوا', 'بالصبر'], 'Al-Asr'),
    verse(104, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'ويل', 'لكل', 'همزة', 'لمزة'], 'Al-Humazah'),
    verse(106, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'لايلاف', 'قريش'], 'Quraysh'),
  ];
  const three = local[0]!;
  const mixed = ['لايلاف', 'قريش', 'بالصبر'].join(' ');
  const engine = new RecitationFollower(
    dbFrom(local),
    script([
      {
        text: three.phonemes_joined, rawPhonemes: three.phonemes_joined, championMatch: {
          surah: 103, ayah: 3, text: three.phonemes_joined, phonemes_joined: three.phonemes_joined,
          score: 0.86, raw_score: 0.86, bonus: 0,
        },
      },
      { text: mixed, rawPhonemes: mixed },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['103:3']);
  assert.deepEqual(refs(await engine.feed(hop())), ['106:1']);
});

test('after Asr last ayah, a short وال leftover does not re-lock 103:1', async () => {
  const local = [
    verse(103, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'والعصر'], 'Al-Asr'),
    verse(103, 3, ['الا', 'الذين', 'امنوا', 'وعملوا', 'الصلحت', 'وتواصوا', 'بالحق', 'وتواصوا', 'بالصبر'], 'Al-Asr'),
    verse(104, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'ويل', 'لكل', 'همزة', 'لمزة'], 'Al-Humazah'),
    verse(106, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'لايلاف', 'قريش'], 'Quraysh'),
  ];
  const three = local[1]!;
  const engine = new RecitationFollower(
    dbFrom(local),
    script([
      {
        text: three.phonemes_joined, rawPhonemes: three.phonemes_joined, championMatch: {
          surah: 103, ayah: 3, text: three.phonemes_joined, phonemes_joined: three.phonemes_joined,
          score: 0.86, raw_score: 0.86, bonus: 0,
        },
      },
      { text: 'وال الذي الذين اوا', rawPhonemes: 'وال الذي الذين اوا' },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['103:3']);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.equal(engine.phase, 'following');
});

test('after Asr last ayah, leftover crumbs stay on the last ayah until Quraysh tokens can lock 106:1', async () => {
  const local = [
    verse(103, 3, ['الا', 'الذين', 'امنوا', 'وعملوا', 'الصلحت', 'وتواصوا', 'بالحق', 'وتواصوا', 'بالصبر'], 'Al-Asr'),
    verse(104, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'ويل', 'لكل', 'همزة', 'لمزة'], 'Al-Humazah'),
    verse(106, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'لايلف', 'قريش'], 'Quraysh'),
  ];
  const three = local[0]!;
  const next = local[2]!;
  const engine = new RecitationFollower(
    dbFrom(local),
    script([
      {
        text: three.phonemes_joined, rawPhonemes: three.phonemes_joined, championMatch: {
          surah: 103, ayah: 3, text: three.phonemes_joined, phonemes_joined: three.phonemes_joined,
          score: 0.86, raw_score: 0.86, bonus: 0,
        },
      },
      { text: 'ل ت', rawPhonemes: 'ل ت' },
      {
        text: next.phoneme_words.slice(4).join(' '), rawPhonemes: next.phoneme_words.slice(4).join(' '), championMatch: {
          surah: 106, ayah: 1, text: next.phonemes_joined, phonemes_joined: next.phonemes_joined,
          score: 0.9, raw_score: 0.9, bonus: 0,
        },
      },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['103:3']);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.equal(engine.phase, 'following');
  assert.deepEqual(refs(await engine.feed(audio(1))), ['106:1']);
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

test('local recognition clocks record an opening acquire with cold native locate', async () => {
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

test('cold-start outside the salah pool records native locate clocks', async () => {
  resetRecognitionCycles();
  const transcribe: TranscribeFn = async (_audio, locate) => {
    if (!locate) {
      return {
        text: 'wadda katheerun min ahli alkitabi',
        rawPhonemes: 'wadda katheerun min ahli alkitabi',
        timings: { onnxMs: 11, decodeMs: 3, locateMs: 0 },
      };
    }
    return { ...spoken(2, 109), timings: { onnxMs: 11, decodeMs: 3, locateMs: 5 } };
  };
  const engine = new RecitationFollower(dbFrom(), transcribe);
  await engine.feed(audio(1), { queueWaitMs: 8, stallMs: 1 });
  const cycle = lastRecognitionCycle();
  assert.ok(cycle);
  assert.equal(cycle!.onnxMs, 11);
  assert.equal(cycle!.decodeMs, 3);
  assert.equal(cycle!.locateMs, 5);
  assert.equal(cycle!.queueWaitMs, 8);
  assert.equal(cycle!.stallMs, 1);
  assert.equal(cycle!.phase, 'acquiring');
});

test('debug HUD records raw ASR, inference plus match latency, lock vs next candidate, and neighborhood search space', async () => {
  resetDebugHud();
  const engine = follower([
    {
      ...spoken(112, 1),
      timings: { onnxMs: 40, decodeMs: 8, locateMs: 12 },
    },
    {
      text: 'qul huwa allahu ahad',
      rawPhonemes: 'qul huwa allahu ahad',
      timings: { onnxMs: 33, decodeMs: 5, locateMs: 0 },
    },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:1']);
  let snap = latestDebugHud();
  assert.equal(formatAyahRef(snap.lock), '[112:1]');
  assert.match(snap.partialAsr, /qul/);
  assert.equal(snap.inferenceMs, 48);
  assert.ok(snap.matchMs >= 12);
  assert.ok(snap.bufferMs >= 900);
  assert.equal(snap.mode, 'TRACKING');
  assert.equal(snap.misses, 0);
  assert.equal(snap.missThreshold, LOCK_GRACE_FAILS);
  assert.equal(snap.searchSpace, 'Locked: Ayahs 1–3');
  assert.deepEqual(refs(await engine.feed(hop())), []);
  snap = latestDebugHud();
  assert.equal(formatAyahRef(snap.lock), '[112:1]');
  assert.equal(formatAyahRef(snap.candidate), '[112:2]');
  assert.match(snap.partialAsr, /qul/);
  assert.equal(snap.inferenceMs, 38);
  assert.ok(snap.bufferMs >= 400);
  assert.equal(snap.mode, 'TRACKING');
  assert.equal(snap.misses, 0);
  assert.equal(snap.searchSpace, 'Locked: Ayahs 1–3');
  resetDebugHud();
});

test('while locked mid-surah, weak hops do not call Global Search bestJoint03Match', async () => {
  const { db, searches } = countingDb();
  const noise = { text: 'zzzz yyyy xxxx wwww', rawPhonemes: 'zzzz yyyy xxxx wwww' };
  const engine = new RecitationFollower(db, script([
    spoken(112, 1),
    noise,
    noise,
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:1']);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.equal(searches(), 0);
  assert.equal(engine.phase, 'following');
  assert.equal(latestDebugHud().searchSpace, 'Locked: Ayahs 1–3');
  assert.equal(latestDebugHud().mode, 'TRACKING');
  assert.equal(latestDebugHud().misses, 2);
  assert.equal(latestDebugHud().missThreshold, LOCK_GRACE_FAILS);
});

test('short leftover الله while locked does not jump to an unrelated surah', async () => {
  const local = [
    ...corpus.filter((item) => item.surah === 112),
    verse(40, 20, ['والله', 'يقضي', 'بالحق'], 'Ghafir'),
    verse(74, 1, ['يا', 'ايها', 'المدثر'], 'Al-Muddaththir'),
  ];
  const ghafir = local.find((item) => item.surah === 40 && item.ayah === 20)!;
  const muddaththir = local.find((item) => item.surah === 74 && item.ayah === 1)!;
  const falseGhafir: QuranChampionMatch = {
    surah: 40, ayah: 20, text: ghafir.phonemes_joined, phonemes_joined: ghafir.phonemes_joined,
    score: 0.95, raw_score: 0.95, bonus: 0,
  };
  const falseMuddaththir: QuranChampionMatch = {
    surah: 74, ayah: 1, text: muddaththir.phonemes_joined, phonemes_joined: muddaththir.phonemes_joined,
    score: 0.95, raw_score: 0.95, bonus: 0,
  };
  const { db, searches } = countingDb(local);
  const engine = new RecitationFollower(db, script([
    spoken(112, 2),
    { text: 'الله', rawPhonemes: 'الله', championMatch: falseGhafir },
    { text: 'الله', rawPhonemes: 'الله', championMatch: falseMuddaththir },
    { text: 'الله', rawPhonemes: 'الله', championMatch: falseGhafir },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:2']);
  const jumped: string[] = [];
  for (let i = 0; i < 3; i++) jumped.push(...refs(await engine.feed(hop())));
  assert.deepEqual(jumped, []);
  assert.equal(searches(), 0);
  assert.ok(engine.phase === 'following' || engine.phase === 'reacquiring');
  assert.ok(engine.lockedRef == null || engine.lockedRef.surah === 112);
});

test('sequential next advances when its candidate score clears 0.65', async () => {
  const engine = follower([
    spoken(112, 1),
    {
      text: 'allahu alsamad',
      rawPhonemes: 'allahu alsamad',
    },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:1']);
  assert.deepEqual(refs(await engine.feed(hop())), ['112:2']);
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

test('Quraysh last ayah hands off to Kawthar after a breath pause', async () => {
  const local = [
    verse(106, 4, ['الذي', 'اطعمهم', 'من', 'جوع', 'وامنهم', 'من', 'خوف'], 'Quraysh'),
    verse(108, 1, ['inna', 'aataynaak', 'alkawthar'], 'Al-Kawthar'),
  ];
  const four = local[0]!;
  const engine = new RecitationFollower(dbFrom(local), script([
    { text: four.phonemes_joined, rawPhonemes: four.phonemes_joined },
    { text: '', rawPhonemes: '' },
    { text: 'inna aataynaak alkawthar', rawPhonemes: 'inna aataynaak alkawthar' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['106:4']);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.deepEqual(refs(await engine.feed(hop())), ['108:1']);
  assert.deepEqual(engine.lockedRef, { surah: 108, ayah: 1 });
});

test('Quraysh second-last leftover still advances to 106:4 instead of the handoff pool', async () => {
  const local = [
    verse(106, 3, ['فليعبدوا', 'رب', 'هذا', 'البيت'], 'Quraysh'),
    verse(106, 4, ['الذي', 'اطعمهم', 'من', 'جوع'], 'Quraysh'),
    verse(107, 1, ['ارايت', 'الذي', 'يكذب', 'بالدين'], 'Al-Maun'),
  ];
  const three = local[0]!;
  const four = local[1]!;
  const engine = new RecitationFollower(
    dbFrom(local),
    script([
      {
        text: three.phonemes_joined, rawPhonemes: three.phonemes_joined, championMatch: {
          surah: 106, ayah: 3, text: three.phonemes_joined, phonemes_joined: three.phonemes_joined,
          score: 0.86, raw_score: 0.86, bonus: 0,
        },
      },
      { text: `${three.phonemes_joined} ${four.phonemes_joined}`, rawPhonemes: `${three.phonemes_joined} ${four.phonemes_joined}` },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['106:3']);
  assert.deepEqual(refs(await engine.feed(hop())), ['106:4']);
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

const muqattaat = [
  verse(1, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم'], 'Al-Fatihah'),
  {
    ...verse(2, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'الم'], 'Al-Baqarah'),
    text_uthmani: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ الٓمٓ',
  },
  verse(2, 2, ['ذلك', 'الكتب', 'لا', 'ريب', 'فيه', 'هدي', 'للمتقين'], 'Al-Baqarah'),
  verse(3, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'الم'], 'Al-Imran'),
  verse(18, 46, ['المال', 'والبنون', 'زينه', 'الحيوه', 'الدنيا'], 'Al-Kahf'),
  verse(55, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'الرحمن'], 'Ar-Rahman'),
  verse(7, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'المص'], 'Al-Araf'),
];

function muqattaatChampion(surah: number, ayah: number, score: number, extra: Partial<QuranChampionMatch> = {}): QuranChampionMatch {
  const found = muqattaat.find((item) => item.surah === surah && item.ayah === ayah)!;
  return {
    surah, ayah, text: found.phonemes_joined, phonemes_joined: found.phonemes_joined,
    score, raw_score: score, bonus: 0, ...extra,
  };
}

test('Asr 103:2 still advances when ASR prefixes الانسن as الا', async () => {
  const local = [
    verse(103, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'والعصر'], 'Al-Asr'),
    verse(103, 2, ['ان', 'الانسن', 'لفي', 'خسر'], 'Al-Asr'),
    verse(103, 3, ['الا', 'الذين', 'امنوا'], 'Al-Asr'),
  ];
  const one = local[0]!;
  const engine = new RecitationFollower(
    dbFrom(local),
    script([
      {
        text: one.phonemes_joined, rawPhonemes: one.phonemes_joined, championMatch: {
          surah: 103, ayah: 1, text: one.phonemes_joined, phonemes_joined: one.phonemes_joined,
          score: 0.92, raw_score: 0.92, bonus: 0,
        },
      },
      { text: 'والعصر الا الانسن لفي خسر', rawPhonemes: 'والعصر الا الانسن لفي خسر' },
    ]),
  );
  assert.deepEqual(refs(await engine.feed(audio(1))), ['103:1']);
  assert.deepEqual(refs(await engine.feed(hop())), ['103:2']);
});

test('ayah-1 body الم locks 2:1, not a longer lookalike such as 18:46 المال', async () => {
  const spoken = 'بسم الله الرحمن الرحيم الم';
  const engine = new RecitationFollower(dbFrom(muqattaat), script([{
    text: spoken,
    rawPhonemes: spoken,
    championMatch: muqattaatChampion(18, 46, 0.83),
  }]));
  const messages = await engine.feed(audio(1));
  assert.deepEqual(refs(messages), ['2:1']);
  assert.equal(engine.phase, 'following');
});

test('ASR الم followed by running speech does not cold-lock muqattaʿāt 2:1 (Al-Fil homophone)', async () => {
  const local = [
    verse(105, 1, ['ألم', 'تر', 'كيف', 'فعل', 'ربك', 'باصحب', 'الفيل'], 'Al-Fil'),
    verse(105, 2, ['ألم', 'يجعل', 'كيدهم', 'في', 'تضليل'], 'Al-Fil'),
    verse(2, 1, ['الم'], 'Al-Baqarah'),
    verse(3, 1, ['الم'], 'Al-Imran'),
  ];
  const engine = new RecitationFollower(dbFrom(local), script([{
    text: 'الم تر كيف فعل',
    rawPhonemes: 'الم تر كيف فعل',
    championMatch: {
      surah: 2, ayah: 1, text: 'الم', phonemes_joined: 'الم',
      score: 0.95, raw_score: 0.95, bonus: 0,
      runners_up: [{
        surah: 3, ayah: 1, score: 0.94, raw_score: 0.94, bonus: 0, phonemes_joined: 'الم',
      }],
    },
  }]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['105:1']);
  assert.equal(engine.phase, 'following');
  const engine2 = new RecitationFollower(dbFrom(local), script([
    {
      text: local[0]!.phonemes_joined, rawPhonemes: local[0]!.phonemes_joined, championMatch: {
        surah: 105, ayah: 1, text: local[0]!.phonemes_joined, phonemes_joined: local[0]!.phonemes_joined,
        score: 0.9, raw_score: 0.9, bonus: 0,
      },
    },
    {
      text: 'ألم يجعل كيدهم',
      rawPhonemes: 'ألم يجعل كيدهم',
      championMatch: {
        surah: 3, ayah: 1, text: 'الم', phonemes_joined: 'الم',
        score: 0.95, raw_score: 0.95, bonus: 0,
      },
    },
  ]));
  assert.deepEqual(refs(await engine2.feed(audio(1))), ['105:1']);
  assert.deepEqual(refs(await engine2.feed(hop())), ['105:2']);
});

/** Real mushaf: ألم تر كيف also opens 89:6 and 14:24, and ألم تر كيف فعل ربك opens 89:6. */
const filWithTwins = [
  verse(105, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'الم', 'تر', 'كيف', 'فعل', 'ربك', 'باصحب', 'الفيل'], 'Al-Fil'),
  verse(105, 2, ['الم', 'يجعل', 'كيدهم', 'في', 'تضليل'], 'Al-Fil'),
  verse(89, 6, ['الم', 'تر', 'كيف', 'فعل', 'ربك', 'بعاد'], 'Al-Fajr'),
  verse(14, 24, ['الم', 'تر', 'كيف', 'ضرب', 'الله', 'مثلا'], 'Ibrahim'),
  verse(2, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'الم'], 'Al-Baqarah'),
  verse(2, 2, ['ذلك', 'الكتب', 'لا', 'ريب', 'فيه'], 'Al-Baqarah'),
  verse(3, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'الم'], 'Al-Imran'),
];

test('ASR ترى / merged تركيف after الم still refuse 2:1 and lock Al-Fil past the 89:6 twin', async () => {
  for (const text of ['الم ترى كيف فعل', 'الم تركيف فعل ربك', 'الم ترا كيف فعل ربك']) {
    const engine = new RecitationFollower(dbFrom(filWithTwins), script([
      { text, rawPhonemes: text, championMatch: muqattaatChampion(2, 1, 0.95) },
    ]));
    assert.deepEqual(refs(await engine.feed(audio(1))), ['105:1'], text);
    assert.equal(engine.phase, 'following', text);
  }
});

test('الم تر كيف alone (opens 105:1, 89:6 and 14:24) neither locks 2:1 nor guesses Al-Fil', async () => {
  for (const text of ['الم تر', 'الم ترى كيف', 'الم تركيف']) {
    const engine = new RecitationFollower(dbFrom(filWithTwins), script([
      { text, rawPhonemes: text, championMatch: muqattaatChampion(2, 1, 0.95) },
    ]));
    assert.deepEqual(refs(await engine.feed(audio(1))), [], text);
    assert.equal(engine.phase, 'acquiring', text);
  }
});

test('a premature 2:1 lock is corrected to Al-Fil once the running opening is heard', async () => {
  const engine = new RecitationFollower(dbFrom(filWithTwins), script([
    { text: 'الم', rawPhonemes: 'الم', championMatch: muqattaatChampion(2, 1, 0.95) },
    { text: 'الم تر كيف فعل ربك', rawPhonemes: 'الم تر كيف فعل ربك' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['2:1']);
  assert.deepEqual(refs(await engine.feed(hop())), ['105:1']);
  assert.deepEqual(engine.lockedRef, { surah: 105, ayah: 1 });
});

test('isolated الم and الم ذلك الكتاب still lock Al-Baqarah 2:1 beside the Al-Fil twin', async () => {
  for (const text of ['الم', 'بسم الله الرحمن الرحيم الم', 'الم ذلك الكتب']) {
    const engine = new RecitationFollower(dbFrom(filWithTwins), script([
      { text, rawPhonemes: text, championMatch: muqattaatChampion(2, 1, 0.95) },
    ]));
    assert.deepEqual(refs(await engine.feed(audio(1))), ['2:1'], text);
  }
});

test('a mid-surah Al-Fajr 89:6 champion is not stolen by the Al-Fil opening', async () => {
  const fajr = filWithTwins.find((item) => item.surah === 89)!;
  const engine = new RecitationFollower(dbFrom(filWithTwins), script([{
    text: fajr.phonemes_joined,
    rawPhonemes: fajr.phonemes_joined,
    championMatch: {
      surah: 89, ayah: 6, text: fajr.phonemes_joined, phonemes_joined: fajr.phonemes_joined,
      score: 0.9, raw_score: 0.9, bonus: 0,
    },
  }]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['89:6']);
});

test('isolated الم without Basmala still locks 2:1', async () => {
  const three = muqattaat.find((item) => item.surah === 3 && item.ayah === 1)!;
  const engine = new RecitationFollower(dbFrom(muqattaat), script([{
    text: 'الم',
    rawPhonemes: 'الم',
    championMatch: muqattaatChampion(18, 46, 0.83, {
      runners_up: [{
        surah: 3, ayah: 1, score: 0.8, raw_score: 0.8, bonus: 0, phonemes_joined: three.phonemes_joined,
      }],
    }),
  }]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['2:1']);
  assert.equal(engine.phase, 'following');
});

test('ASR المي still locks 2:1 as ayah-1 body', async () => {
  const engine = new RecitationFollower(dbFrom(muqattaat), script([{
    text: 'المي',
    rawPhonemes: 'المي',
    championMatch: muqattaatChampion(3, 1, 0.7, {
      runners_up: [{
        surah: 2, ayah: 1, score: 0.69, raw_score: 0.69, bonus: 0, phonemes_joined: 'الم',
      }],
    }),
  }]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['2:1']);
  assert.equal(engine.phase, 'following');
});

test('ayah-1 الم still locks 2:1 when 3:1 is a close rival', async () => {
  const two = muqattaat.find((item) => item.surah === 2 && item.ayah === 1)!;
  const engine = new RecitationFollower(dbFrom(muqattaat), script([{
    text: 'الم المي',
    rawPhonemes: 'الم المي',
    championMatch: muqattaatChampion(3, 1, 0.7, {
      runners_up: [{
        surah: 2, ayah: 1, score: 0.69, raw_score: 0.69, bonus: 0, phonemes_joined: two.phonemes_joined,
      }],
    }),
  }]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['2:1']);
  assert.equal(engine.phase, 'following');
});

test('a window that still contains ayah-1 body prefers 2:1 over 2:2 already in the span', async () => {
  const spoken = 'الم ذلك الكتب لا ريب فيه';
  const engine = new RecitationFollower(dbFrom(muqattaat), script([{
    text: spoken,
    rawPhonemes: spoken,
    championMatch: muqattaatChampion(2, 2, 0.88),
  }]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['2:1']);
  assert.equal(engine.phase, 'following');
});

test('2:2-only audio still first-locks 2:2 when ayah-1 body is absent', async () => {
  const two = muqattaat.find((item) => item.surah === 2 && item.ayah === 2)!;
  const engine = new RecitationFollower(dbFrom(muqattaat), script([{
    text: two.phonemes_joined,
    rawPhonemes: two.phonemes_joined,
    championMatch: muqattaatChampion(2, 2, 0.88),
  }]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['2:2']);
  assert.equal(engine.phase, 'following');
});

test('Basmala alone does not lock 2:1', async () => {
  const engine = new RecitationFollower(dbFrom(muqattaat), script([{
    text: 'بسم الله الرحمن الرحيم',
    rawPhonemes: 'بسم الله الرحمن الرحيم',
    championMatch: muqattaatChampion(2, 1, 0.9),
  }]));
  assert.deepEqual(refs(await engine.feed(audio(1))), []);
  assert.equal(engine.phase, 'acquiring');
});

test('Basmala alone does not lock 55:1 from the shared الرحمن word', async () => {
  const engine = new RecitationFollower(dbFrom(muqattaat), script([{
    text: 'بسم الله الرحمن الرحيم',
    rawPhonemes: 'بسم الله الرحمن الرحيم',
    championMatch: muqattaatChampion(55, 1, 0.9),
  }]));
  assert.deepEqual(refs(await engine.feed(audio(1))), []);
  assert.equal(engine.phase, 'acquiring');
});

test('a slid Basmala tail plus الم still locks 2:1 (Mac 4s window)', async () => {
  const engine = new RecitationFollower(dbFrom(muqattaat), script([{
    text: 'الرحمن الرحيم الم',
    rawPhonemes: 'الرحمن الرحيم الم',
    championMatch: muqattaatChampion(2, 2, 0.88, {
      runners_up: [{
        surah: 3, ayah: 1, score: 0.8, raw_score: 0.8, bonus: 0, phonemes_joined: 'الم',
      }],
    }),
  }]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['2:1']);
  assert.equal(engine.phase, 'following');
});

test('الرحيم الم after a dropped بسم still locks 2:1', async () => {
  const engine = new RecitationFollower(dbFrom(muqattaat), script([{
    text: 'الرحيم الم',
    rawPhonemes: 'الرحيم الم',
    championMatch: muqattaatChampion(18, 46, 0.83),
  }]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['2:1']);
});

test('ASR الميم still locks 2:1, not المال', async () => {
  const engine = new RecitationFollower(dbFrom(muqattaat), script([{
    text: 'الميم',
    rawPhonemes: 'الميم',
    championMatch: muqattaatChampion(18, 46, 0.83),
  }]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['2:1']);
});

test('recited letter names الف لام ميم lock 2:1, not 7:1', async () => {
  const engine = new RecitationFollower(dbFrom(muqattaat), script([{
    text: 'الف لام ميم',
    rawPhonemes: 'الف لام ميم',
    championMatch: muqattaatChampion(7, 1, 0.7, {
      runners_up: [{
        surah: 2, ayah: 1, score: 0.69, raw_score: 0.69, bonus: 0, phonemes_joined: 'الم',
      }],
    }),
  }]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['2:1']);
});

test('Basmala tail plus letter names still locks 2:1', async () => {
  const engine = new RecitationFollower(dbFrom(muqattaat), script([{
    text: 'الرحمن الرحيم الف لام ميم',
    rawPhonemes: 'الرحمن الرحيم الف لام ميم',
    championMatch: muqattaatChampion(2, 2, 0.85),
  }]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['2:1']);
});

test('المصدر still does not lock 7:1 from a substring', async () => {
  const engine = new RecitationFollower(dbFrom(muqattaat), script([{
    text: 'المصدر المدرس',
    rawPhonemes: 'المصدر المدرس',
    championMatch: muqattaatChampion(7, 1, 0.95),
  }]));
  assert.deepEqual(refs(await engine.feed(audio(1))), []);
  assert.equal(engine.phase, 'acquiring');
});

test('first-lock acquire keeps 8s so a trailing ayah-1 body is not slid off', async () => {
  const noise = { text: 'zzzz yyyy xxxx', rawPhonemes: 'zzzz yyyy xxxx' };
  const engine = new RecitationFollower(dbFrom(muqattaat), script([noise, noise]));
  await engine.feed(audio(1));
  resetRecognitionCycles();
  await engine.feed(audio(5));
  const cycle = lastRecognitionCycle();
  assert.ok(cycle);
  assert.ok(
    cycle.windowSec > ACQUIRE_MAX_SEC,
    `expected first-lock window > ${ACQUIRE_MAX_SEC}s, got ${cycle.windowSec}`,
  );
  assert.ok(cycle.windowSec <= ACQUIRE_AFTER_BASMALA_SEC + 0.05);
  assert.equal(engine.phase, 'acquiring');
});

test('reacquire stays at the 4s cap', async () => {
  const noise = { text: 'zzzz yyyy xxxx', rawPhonemes: 'zzzz yyyy xxxx' };
  const engine = follower([
    spoken(114, 4),
    spoken(114, 5),
    spoken(114, 6),
    spoken(114, 6),
    noise,
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['114:4']);
  assert.deepEqual(refs(await engine.feed(hop())), ['114:5']);
  assert.deepEqual(refs(await engine.feed(hop())), ['114:6']);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.equal(engine.phase, 'reacquiring');
  resetRecognitionCycles();
  await engine.feed(audio(5));
  const cycle = lastRecognitionCycle();
  assert.ok(cycle);
  assert.ok(
    cycle.windowSec <= ACQUIRE_MAX_SEC + 0.05,
    `reacquire window grew to ${cycle.windowSec}`,
  );
});

test('a Mac-length mixed window with 2:2 champion still first-locks 2:1', async () => {
  const spoken = 'الرحمن الرحيم الم ذلك الكتب لا ريب فيه';
  const engine = new RecitationFollower(dbFrom(muqattaat), script([{
    text: spoken,
    rawPhonemes: spoken,
    championMatch: muqattaatChampion(2, 2, 0.88),
  }]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['2:1']);
  assert.equal(engine.phase, 'following');
});

test('exact الم still first-locks 2:1 when locate returns no champion', async () => {
  const engine = new RecitationFollower(dbFrom(muqattaat), script([{
    text: 'الم',
    rawPhonemes: 'الم',
    locateAttempted: true,
  }]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['2:1']);
  assert.equal(engine.phase, 'following');
});

test('a low-score champion still first-locks exact الم as 2:1', async () => {
  const engine = new RecitationFollower(dbFrom(muqattaat), script([{
    text: 'الم',
    rawPhonemes: 'الم',
    championMatch: muqattaatChampion(18, 46, 0.5),
  }]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['2:1']);
  assert.equal(engine.phase, 'following');
});

test('older-slice lookback recovers الم when a long window champions 2:2', async () => {
  const two = muqattaat.find((item) => item.surah === 2 && item.ayah === 2)!;
  const engine = new RecitationFollower(dbFrom(muqattaat), script([
    {
      text: two.phonemes_joined,
      rawPhonemes: two.phonemes_joined,
      championMatch: muqattaatChampion(2, 2, 0.91),
    },
    {
      text: 'الرحمن الرحيم الم',
      rawPhonemes: 'الرحمن الرحيم الم',
      championMatch: muqattaatChampion(2, 2, 0.8),
    },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(6))), ['2:1']);
  assert.equal(engine.phase, 'following');
});

const midSurahCold = [
  verse(1, 2, ['الحمد', 'لله', 'رب', 'العلمين'], 'Al-Fatihah'),
  verse(2, 120, ['ولن', 'ترضي', 'عنك', 'اليهود'], 'Al-Baqarah'),
  verse(2, 188, ['ولا', 'تاكلوا', 'امولكم', 'بينكم'], 'Al-Baqarah'),
  verse(4, 129, ['ولن', 'تستطيعوا', 'ان', 'تعدلوا', 'بين', 'النساء', 'ولو', 'حرصتم', 'فلا', 'تميلوا'], 'An-Nisa'),
  verse(4, 130, ['وان', 'يتفرقا', 'يغن', 'الله', 'كلا', 'من', 'سعته'], 'An-Nisa'),
  verse(35, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'الحمد', 'لله', 'فاطر', 'السموت', 'والارض'], 'Fatir'),
  verse(35, 2, ['ما', 'يفتح', 'الله', 'للناس', 'من', 'رحمه'], 'Fatir'),
  verse(36, 16, ['قالوا', 'ربنا', 'يعلم', 'انا', 'اليكم', 'لمرسلون'], 'Ya-Sin'),
  verse(36, 17, ['وما', 'علينا', 'الا', 'البلغ', 'المبين'], 'Ya-Sin'),
  verse(36, 18, ['قالوا', 'انا', 'تطيرنا', 'بكم'], 'Ya-Sin'),
  verse(41, 34, ['ولا', 'تستوي', 'الحسنه', 'ولا', 'السيئه', 'ادفع', 'بالتي', 'هي', 'احسن'], 'Fussilat'),
  verse(41, 35, ['وما', 'يلقاها', 'الا', 'الذين', 'صبروا'], 'Fussilat'),
  verse(78, 4, ['كلا', 'سيعلمون'], 'An-Naba'),
  verse(78, 5, ['ثم', 'كلا', 'سيعلمون'], 'An-Naba'),
];

function midChampion(surah: number, ayah: number, score: number, extra: Partial<QuranChampionMatch> = {}): QuranChampionMatch {
  const found = midSurahCold.find((item) => item.surah === surah && item.ayah === ayah)!;
  return {
    surah, ayah, text: found.phonemes_joined, phonemes_joined: found.phonemes_joined,
    score, raw_score: score, bonus: 0, ...extra,
  };
}

test('An-Nisa 4:129 body does not first-lock Fussilat 41:34 from a shared ول-/تست- prefix', async () => {
  const spoken = 'ولن تستطيعوا ان تعدلوا بين النساء';
  const four = midSurahCold.find((item) => item.surah === 4 && item.ayah === 129)!;
  const engine = new RecitationFollower(dbFrom(midSurahCold), script([{
    text: spoken,
    rawPhonemes: spoken,
    championMatch: midChampion(41, 34, 0.63, {
      runners_up: [{
        surah: 4, ayah: 129, score: 0.55, raw_score: 0.55, bonus: 0, phonemes_joined: four.phonemes_joined,
      }],
    }),
  }]));
  const messages = await engine.feed(audio(1));
  assert.equal(refs(messages).includes('41:34'), false);
  assert.deepEqual(refs(messages), ['4:129']);
  assert.equal(engine.phase, 'following');
});

test('a thin ول-/تست- window holds instead of crowning 41:34', async () => {
  const spoken = 'ولن تستطيعوا';
  const engine = new RecitationFollower(dbFrom(midSurahCold), script([{
    text: spoken,
    rawPhonemes: spoken,
    championMatch: midChampion(41, 34, 0.63),
  }]));
  assert.deepEqual(refs(await engine.feed(audio(1))), []);
  assert.equal(engine.phase, 'acquiring');
});

test('Fussilat 41:34 still locks from its own الحسنه continuation', async () => {
  const spoken = 'ولا تستوي الحسنه ولا السيئه';
  const engine = new RecitationFollower(dbFrom(midSurahCold), script([{
    text: spoken,
    rawPhonemes: spoken,
    championMatch: midChampion(41, 34, 0.86),
  }]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['41:34']);
  assert.equal(engine.phase, 'following');
});

test('after 4:129, 4:130 still advances from its own words', async () => {
  const nisa129 = midSurahCold.find((item) => item.surah === 4 && item.ayah === 129)!;
  const nisa130 = midSurahCold.find((item) => item.surah === 4 && item.ayah === 130)!;
  const engine = new RecitationFollower(dbFrom(midSurahCold), script([
    {
      text: nisa129.phonemes_joined, rawPhonemes: nisa129.phonemes_joined,
      championMatch: midChampion(4, 129, 0.86),
    },
    { text: nisa130.phonemes_joined, rawPhonemes: nisa130.phonemes_joined },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['4:129']);
  assert.deepEqual(refs(await engine.feed(hop())), ['4:130']);
});

test('Ya-Sin 36:16 body does not first-lock short An-Naba 78:4 from a shared علم root', async () => {
  const spoken = 'قالوا ربنا يعلم انا اليكم';
  const yasin = midSurahCold.find((item) => item.surah === 36 && item.ayah === 16)!;
  const engine = new RecitationFollower(dbFrom(midSurahCold), script([{
    text: spoken,
    rawPhonemes: spoken,
    championMatch: midChampion(78, 4, 0.85, {
      runners_up: [{
        surah: 36, ayah: 16, score: 0.7, raw_score: 0.7, bonus: 0, phonemes_joined: yasin.phonemes_joined,
      }],
    }),
  }]));
  const messages = await engine.feed(audio(1));
  assert.equal(refs(messages).includes('78:4'), false);
  assert.deepEqual(refs(messages), ['36:16']);
  assert.equal(engine.phase, 'following');
});

test('ربنا يعلم without قالوا still locates 36:16 instead of 78:4', async () => {
  const spoken = 'ربنا يعلم انا اليكم';
  const engine = new RecitationFollower(dbFrom(midSurahCold), script([{
    text: spoken,
    rawPhonemes: spoken,
    championMatch: midChampion(78, 4, 0.85),
  }]));
  const messages = await engine.feed(audio(1));
  assert.equal(refs(messages).includes('78:4'), false);
  assert.deepEqual(refs(messages), ['36:16']);
});

test('An-Naba 78:4 still locks from its own كلا opening', async () => {
  const spoken = 'كلا سيعلمون';
  const engine = new RecitationFollower(dbFrom(midSurahCold), script([{
    text: spoken,
    rawPhonemes: spoken,
    championMatch: midChampion(78, 4, 0.86),
  }]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['78:4']);
  assert.equal(engine.phase, 'following');
});

test('after 36:16, 36:17 then 36:18 still advance in order', async () => {
  const yasin16 = midSurahCold.find((item) => item.surah === 36 && item.ayah === 16)!;
  const yasin17 = midSurahCold.find((item) => item.surah === 36 && item.ayah === 17)!;
  const yasin18 = midSurahCold.find((item) => item.surah === 36 && item.ayah === 18)!;
  const engine = new RecitationFollower(dbFrom(midSurahCold), script([
    {
      text: yasin16.phonemes_joined, rawPhonemes: yasin16.phonemes_joined,
      championMatch: midChampion(36, 16, 0.86),
    },
    { text: yasin17.phonemes_joined, rawPhonemes: yasin17.phonemes_joined },
    { text: yasin18.phonemes_joined, rawPhonemes: yasin18.phonemes_joined },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['36:16']);
  assert.deepEqual(refs(await engine.feed(hop())), ['36:17']);
  assert.deepEqual(refs(await engine.feed(hop())), ['36:18']);
});

test('Fatir 35:1 still first-locks from فاطر after shared الحمد لله', async () => {
  const spoken = 'الحمد لله فاطر السموت والارض';
  const fatir = midSurahCold.find((item) => item.surah === 35 && item.ayah === 1)!;
  const engine = new RecitationFollower(dbFrom(midSurahCold), script([{
    text: spoken,
    rawPhonemes: spoken,
    championMatch: {
      surah: 35, ayah: 1, text: fatir.phonemes_joined, phonemes_joined: fatir.phonemes_joined,
      score: 0.88, raw_score: 0.88, bonus: 0,
    },
  }]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['35:1']);
  assert.equal(engine.phase, 'following');
});

test('follow hops transcribe without locating the mushaf', async () => {
  const locateFlags: boolean[] = [];
  const queue: TranscribeResult[] = [
    spoken(112, 1),
    { text: 'allahu', rawPhonemes: 'allahu' },
    { text: 'allahu alsamad', rawPhonemes: 'allahu alsamad' },
  ];
  const transcribe: TranscribeFn = async (_audio, locate) => {
    locateFlags.push(locate);
    return queue.shift() ?? { text: '', rawPhonemes: '' };
  };
  const { db, searches } = countingDb();
  const engine = new RecitationFollower(db, transcribe);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:1']);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.deepEqual(refs(await engine.feed(hop())), ['112:2']);
  assert.equal(locateFlags[0], true, 'cold first-lock uses native locate');
  assert.deepEqual(locateFlags.slice(1), [false, false]);
  assert.equal(searches(), 0);
});

test('cold-start Falaq opening locks 113:1 with native locate', async () => {
  const locateFlags: boolean[] = [];
  const { db, searches } = countingDb();
  const transcribe: TranscribeFn = async (_audio, locate) => {
    locateFlags.push(locate);
    return { text: 'qul audhu birabbi alfalaq', rawPhonemes: 'qul audhu birabbi alfalaq' };
  };
  const engine = new RecitationFollower(db, transcribe);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['113:1']);
  assert.deepEqual(locateFlags, [true]);
  assert.equal(searches(), 0);
  assert.equal(engine.phase, 'following');
});

test('shared Alhamdulillah does not cold-lock Fatiha 1:2 from the salah pool', async () => {
  const locateFlags: boolean[] = [];
  const transcribe: TranscribeFn = async (_audio, locate) => {
    locateFlags.push(locate);
    return { text: 'alhamdu lillahi', rawPhonemes: 'alhamdu lillahi' };
  };
  const engine = new RecitationFollower(dbFrom(), transcribe);
  assert.deepEqual(refs(await engine.feed(audio(1))), []);
  assert.equal(engine.phase, 'acquiring');
  assert.deepEqual(locateFlags, [true]);
});

test('cold-start outside the salah pool uses native locate', async () => {
  const locateFlags: boolean[] = [];
  const transcribe: TranscribeFn = async (_audio, locate) => {
    locateFlags.push(locate);
    return { text: 'wadda katheerun min ahli alkitabi', rawPhonemes: 'wadda katheerun min ahli alkitabi' };
  };
  const { db, searches } = countingDb();
  const engine = new RecitationFollower(db, transcribe);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['2:109']);
  assert.deepEqual(locateFlags, [true]);
  assert.ok(searches() >= 1);
});

test('joined remainder plus next commits the sequential ayah without a champion hop', async () => {
  const engine = follower([
    spoken(1, 6),
    { text: 'almustaqeem sirata alladhina', rawPhonemes: 'almustaqeem sirata alladhina' },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:6']);
  assert.deepEqual(refs(await engine.feed(hop())), ['1:7']);
});

test('last-ayah leftover does not call Global Search bestJoint03Match', async () => {
  const { db, searches } = countingDb();
  const engine = new RecitationFollower(db, script([
    spoken(1, 7),
    { text: 'zzzz yyyy xxxx wwww', rawPhonemes: 'zzzz yyyy xxxx wwww' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:7']);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.equal(searches(), 0);
  assert.equal(engine.phase, 'following');
  assert.equal(engine.lockedRef?.surah, 1);
  assert.equal(engine.lockedRef?.ayah, 7);
});

test('Fatiha leftover قل هو الله احد locks 112:1 without a mushaf locate', async () => {
  const local = [
    verse(1, 7, ['صرط', 'الذين', 'انعمت', 'عليهم', 'غير', 'المغضوب', 'عليهم', 'ولا', 'الضالين'], 'Al-Fatihah'),
    verse(112, 1, ['قل', 'هو', 'الله', 'احد'], 'Al-Ikhlas'),
    verse(2, 1, ['الم'], 'Al-Baqarah'),
  ];
  const seven = local[0]!;
  const { db, searches } = countingDb(local);
  const engine = new RecitationFollower(db, script([
    {
      text: seven.phonemes_joined, rawPhonemes: seven.phonemes_joined, championMatch: {
        surah: 1, ayah: 7, text: seven.phonemes_joined, phonemes_joined: seven.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      },
    },
    { text: 'قل هو الله احد', rawPhonemes: 'قل هو الله احد' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:7']);
  assert.deepEqual(refs(await engine.feed(hop())), ['112:1']);
  assert.equal(searches(), 0);
  assert.equal(engine.phase, 'following');
  assert.equal(engine.lockedRef?.surah, 112);
});

test('madd elongation on the locked ayah does not drop to Global Search', async () => {
  const local = [
    verse(112, 2, ['الله', 'الصمد'], 'Al-Ikhlas'),
    verse(112, 3, ['لم', 'يلد', 'ولم', 'يولد'], 'Al-Ikhlas'),
  ];
  const two = local[0]!;
  const { db, searches } = countingDb(local);
  const engine = new RecitationFollower(db, script([
    {
      text: two.phonemes_joined, rawPhonemes: two.phonemes_joined, championMatch: {
        surah: 112, ayah: 2, text: two.phonemes_joined, phonemes_joined: two.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      },
    },
    { text: 'الله الصماااد', rawPhonemes: 'الله الصماااد' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:2']);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.equal(searches(), 0);
  assert.equal(engine.phase, 'following');
  assert.deepEqual(engine.lockedRef, { surah: 112, ayah: 2 });
  assert.equal(latestDebugHud().misses, 0);
});

test('a single garbled hop keeps the locked ayah without reacquire', async () => {
  const engine = follower([
    spoken(112, 2),
    { text: 'zzzz garbled chunk', rawPhonemes: 'zzzz garbled chunk' },
  ]);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:2']);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.equal(engine.phase, 'following');
  assert.deepEqual(engine.lockedRef, { surah: 112, ayah: 2 });
  assert.equal(latestDebugHud().searchSpace, 'Locked: Ayahs 1–4');
});

test('three weak hops under 1.5s keep the lock; 3 hops and 1.5s then reacquire', async () => {
  const realNow = Date.now.bind(Date);
  let now = 1_000_000;
  Date.now = () => now;
  try {
    const noise = { text: 'zzzz yyyy xxxx wwww', rawPhonemes: 'zzzz yyyy xxxx wwww' };
    const { db, searches } = countingDb();
    const engine = new RecitationFollower(db, script([spoken(112, 2), noise, noise, noise, noise]));
    assert.deepEqual(refs(await engine.feed(audio(1))), ['112:2']);
    assert.deepEqual(refs(await engine.feed(hop())), []);
    assert.equal(engine.phase, 'following');
    assert.deepEqual(refs(await engine.feed(hop())), []);
    assert.equal(engine.phase, 'following');
    now += 400;
    assert.deepEqual(refs(await engine.feed(hop())), []);
    assert.equal(engine.phase, 'following');
    assert.deepEqual(engine.lockedRef, { surah: 112, ayah: 2 });
    now += LOCK_GRACE_MS;
    assert.deepEqual(refs(await engine.feed(hop())), []);
    assert.equal(engine.phase, 'reacquiring');
    assert.equal(searches(), 0);
  } finally {
    Date.now = realNow;
  }
});

test('Kafirun last-ayah leftover locks Fil 105:1 not 105:5 without a mushaf locate', async () => {
  const local = [
    verse(109, 6, ['لكم', 'دينكم', 'ولي', 'دين'], 'Al-Kafirun'),
    verse(105, 1, ['الم', 'تر', 'كيف', 'فعل', 'ربك', 'باصحب', 'الفيل'], 'Al-Fil'),
    verse(105, 5, ['فجعلهم', 'كعصف', 'ماكول'], 'Al-Fil'),
    verse(108, 1, ['انا', 'اعطيناك', 'الكوثر'], 'Al-Kawthar'),
    verse(108, 3, ['ان', 'شانئك', 'هو', 'الابتر'], 'Al-Kawthar'),
  ];
  const six = local[0]!;
  const { db, searches } = countingDb(local);
  const engine = new RecitationFollower(db, script([
    {
      text: six.phonemes_joined, rawPhonemes: six.phonemes_joined, championMatch: {
        surah: 109, ayah: 6, text: six.phonemes_joined, phonemes_joined: six.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      },
    },
    { text: 'الم تر كيف', rawPhonemes: 'الم تر كيف' },
    { text: 'انا اعطيناك', rawPhonemes: 'انا اعطيناك' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['109:6']);
  assert.deepEqual(refs(await engine.feed(hop())), ['105:1']);
  assert.equal(searches(), 0);
  assert.equal(engine.phase, 'following');
  assert.deepEqual(engine.lockedRef, { surah: 105, ayah: 1 });
  assert.deepEqual(refs(await engine.feed(hop())), ['108:1']);
  assert.equal(searches(), 0);
  assert.deepEqual(engine.lockedRef, { surah: 108, ayah: 1 });
});

test('Nas leftover الناس does not hand off into An-Nisa 4:1', async () => {
  const local = [
    verse(114, 3, ['ilah', 'alnnas'], 'An-Nas'),
    verse(4, 1, ['يايها', 'الناس', 'اتقوا', 'ربكم'], 'An-Nisa'),
    verse(112, 1, ['qul', 'huwa', 'allahu', 'ahad'], 'Al-Ikhlas'),
  ];
  const three = local[0]!;
  const engine = new RecitationFollower(dbFrom(local), script([
    {
      text: three.phonemes_joined, rawPhonemes: three.phonemes_joined, championMatch: {
        surah: 114, ayah: 3, text: three.phonemes_joined, phonemes_joined: three.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      },
    },
    { text: 'الناس اتقوا', rawPhonemes: 'الناس اتقوا' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['114:3']);
  const jumped = refs(await engine.feed(hop()));
  assert.ok(!jumped.includes('4:1'), `الناس leftover must not lock 4:1, got ${jumped.join(',') || '(none)'}`);
});

test('Nas last-ayah leftover does not hand off into An-Nisa 4:142', async () => {
  const local = [
    verse(114, 6, ['mina', 'aljinnati', 'walnnas'], 'An-Nas'),
    verse(4, 1, ['ya', 'ayyuha', 'alnnas', 'ittaqu', 'rabbakum'], 'An-Nisa'),
    verse(4, 142, ['inna', 'almunafiqina', 'yukhadiuna', 'allaha', 'wahuwa', 'khadiuhum', 'waidha', 'qamu', 'ila', 'alsalah'], 'An-Nisa'),
    verse(112, 1, ['qul', 'huwa', 'allahu', 'ahad'], 'Al-Ikhlas'),
  ];
  const six = local[0]!;
  const nisa = local[2]!;
  const engine = new RecitationFollower(dbFrom(local), script([
    {
      text: six.phonemes_joined, rawPhonemes: six.phonemes_joined, championMatch: {
        surah: 114, ayah: 6, text: six.phonemes_joined, phonemes_joined: six.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      },
    },
    { text: nisa.phonemes_joined, rawPhonemes: nisa.phonemes_joined },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['114:6']);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.ok(engine.lockedRef == null || engine.lockedRef.surah === 114);
  assert.ok(engine.lockedRef == null || engine.lockedRef.ayah === 6);
});

test('surah switch does not snap to 112:4 or 113:5', async () => {
  const local = [
    verse(114, 6, ['mina', 'aljinnati', 'walnnas'], 'An-Nas'),
    verse(112, 1, ['qul', 'huwa', 'allahu', 'ahad'], 'Al-Ikhlas'),
    verse(112, 4, ['walam', 'yakun', 'lahu', 'kufuwan', 'ahad'], 'Al-Ikhlas'),
    verse(113, 1, ['qul', 'audhu', 'birabbi', 'alfalaq'], 'Al-Falaq'),
    verse(113, 5, ['wamin', 'sharri', 'hasidin', 'idha', 'hasad'], 'Al-Falaq'),
  ];
  const six = local[0]!;
  const ikhlas4 = local[2]!;
  const falaq5 = local[4]!;
  const engine = new RecitationFollower(dbFrom(local), script([
    {
      text: six.phonemes_joined, rawPhonemes: six.phonemes_joined, championMatch: {
        surah: 114, ayah: 6, text: six.phonemes_joined, phonemes_joined: six.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      },
    },
    { text: ikhlas4.phonemes_joined, rawPhonemes: ikhlas4.phonemes_joined },
    { text: falaq5.phonemes_joined, rawPhonemes: falaq5.phonemes_joined },
    { text: 'qul huwa allahu ahad', rawPhonemes: 'qul huwa allahu ahad' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['114:6']);
  assert.deepEqual(refs(await engine.feed(audio(1))), []);
  assert.ok(!refs(await engine.feed(audio(1))).includes('113:5'));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:1']);
});

test('a one-word hallucination does not lock an unrelated surah', async () => {
  const local = [
    verse(1, 7, ['sirata', 'alladhina', 'anamta', 'alayhim', 'ghayri', 'almaghdubi', 'alayhim', 'wala', 'alddallin'], 'Al-Fatihah'),
    verse(2, 1, ['alif', 'lam', 'meem'], 'Al-Baqarah'),
    verse(36, 1, ['ya', 'seen'], 'Ya-Sin'),
    verse(112, 1, ['qul', 'huwa', 'allahu', 'ahad'], 'Al-Ikhlas'),
  ];
  const seven = local[0]!;
  const engine = new RecitationFollower(dbFrom(local), script([
    {
      text: seven.phonemes_joined, rawPhonemes: seven.phonemes_joined, championMatch: {
        surah: 1, ayah: 7, text: seven.phonemes_joined, phonemes_joined: seven.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      },
    },
    { text: 'نيم', rawPhonemes: 'نيم' },
    { text: 'وان المهتدين', rawPhonemes: 'وان المهتدين' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:7']);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.deepEqual(refs(await engine.feed(hop())), []);
  assert.ok(engine.lockedRef == null || engine.lockedRef.surah === 1);
});

test('three misses of a salah-prior ayah-1 opening leave a wrong lock without waiting 1.5s', async () => {
  const realNow = Date.now.bind(Date);
  let now = 1_000_000;
  Date.now = () => now;
  try {
    const fil = { text: 'الم تر كيف', rawPhonemes: 'الم تر كيف' };
    const engine = follower([spoken(112, 2), fil, fil, fil]);
    assert.deepEqual(refs(await engine.feed(audio(1))), ['112:2']);
    const jumped: string[] = [];
    jumped.push(...refs(await engine.feed(hop())));
    jumped.push(...refs(await engine.feed(hop())));
    jumped.push(...refs(await engine.feed(hop())));
    assert.ok(jumped.includes('105:1'), `expected 105:1 breakout, got ${jumped.join(',') || '(none)'}`);
    assert.deepEqual(engine.lockedRef, { surah: 105, ayah: 1 });
    assert.equal(engine.phase, 'following');
  } finally {
    Date.now = realNow;
  }
});

test('cold 112:2 locks with native locate', async () => {
  const locateFlags: boolean[] = [];
  const { db, searches } = countingDb();
  const transcribe: TranscribeFn = async (_audio, locate) => {
    locateFlags.push(locate);
    return { text: 'allahu alsamad', rawPhonemes: 'allahu alsamad' };
  };
  const engine = new RecitationFollower(db, transcribe);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:2']);
  assert.deepEqual(locateFlags, [true]);
  assert.ok(searches() >= 1, 'expected JS mushaf search when the mock omits a champion');
});

test('An-Nas قل اعوذ برب الناس after Ikhlas locks 114:1 not Al-Maun 107:1', async () => {
  const local = [
    verse(112, 4, ['ولم', 'يكن', 'له', 'كفوا', 'احد'], 'Al-Ikhlas'),
    verse(107, 1, ['ارايت', 'الذي', 'يكذب', 'بالدين'], 'Al-Maun'),
    verse(113, 1, ['قل', 'اعوذ', 'برب', 'الفلق'], 'Al-Falaq'),
    verse(114, 1, ['قل', 'اعوذ', 'برب', 'الناس'], 'An-Nas'),
    verse(114, 2, ['ملك', 'الناس'], 'An-Nas'),
  ];
  const four = local[0]!;
  const { db, searches } = countingDb(local);
  const engine = new RecitationFollower(db, script([
    {
      text: four.phonemes_joined, rawPhonemes: four.phonemes_joined, championMatch: {
        surah: 112, ayah: 4, text: four.phonemes_joined, phonemes_joined: four.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      },
    },
    {
      text: 'قل اعوذ برب الناس',
      rawPhonemes: 'قل اعوذ برب الناس',
      championMatch: {
        surah: 107, ayah: 1, text: 'ارايت الذي يكذب بالدين', phonemes_joined: 'ارايت الذي يكذب بالدين',
        score: 0.9, raw_score: 0.9, bonus: 0,
      },
    },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:4']);
  const jumped = refs(await engine.feed(hop()));
  assert.deepEqual(jumped, ['114:1']);
  assert.ok(!jumped.includes('107:1'), `Nas opening must not lock 107:1, got ${jumped.join(',') || '(none)'}`);
  assert.equal(searches(), 0);
  assert.notEqual(latestDebugHud().searchSpace, 'Global Search');
});

test('shared قل اعوذ برب after Ikhlas waits instead of locking Al-Maun 107:1', async () => {
  const local = [
    verse(112, 4, ['ولم', 'يكن', 'له', 'كفوا', 'احد'], 'Al-Ikhlas'),
    verse(107, 1, ['ارايت', 'الذي', 'يكذب', 'بالدين'], 'Al-Maun'),
    verse(113, 1, ['قل', 'اعوذ', 'برب', 'الفلق'], 'Al-Falaq'),
    verse(114, 1, ['قل', 'اعوذ', 'برب', 'الناس'], 'An-Nas'),
  ];
  const four = local[0]!;
  const { db, searches } = countingDb(local);
  const engine = new RecitationFollower(db, script([
    {
      text: four.phonemes_joined, rawPhonemes: four.phonemes_joined, championMatch: {
        surah: 112, ayah: 4, text: four.phonemes_joined, phonemes_joined: four.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      },
    },
    { text: 'قل اعوذ برب', rawPhonemes: 'قل اعوذ برب' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:4']);
  const jumped = refs(await engine.feed(hop()));
  assert.ok(!jumped.includes('107:1'), `shared audhu prefix must not lock 107:1, got ${jumped.join(',') || '(none)'}`);
  assert.ok(!jumped.includes('113:1'));
  assert.ok(!jumped.includes('114:1'));
  assert.equal(searches(), 0);
  assert.notEqual(latestDebugHud().searchSpace, 'Global Search');
});

test('Al-Falaq 113:5 hands off to An-Nas 114:1 when the next surah opening is heard', async () => {
  const local = [
    verse(113, 4, ['min', 'sharri', 'alghasiq', 'idha', 'waqab'], 'Al-Falaq'),
    verse(113, 5, ['wamin', 'sharri', 'hasidin', 'idha', 'hasad'], 'Al-Falaq'),
    verse(114, 1, ['qul', 'audhu', 'birabbi', 'alnnas'], 'An-Nas'),
    verse(114, 2, ['maliki', 'alnnas'], 'An-Nas'),
  ];
  const five = local[1]!;
  const { db, searches } = countingDb(local);
  const engine = new RecitationFollower(db, script([
    {
      text: five.phonemes_joined,
      rawPhonemes: five.phonemes_joined,
      championMatch: {
        surah: 113, ayah: 5, text: five.phonemes_joined, phonemes_joined: five.phonemes_joined,
        score: 0.88, raw_score: 0.88, bonus: 0,
      },
    },
    {
      text: 'qul audhu birabbi alnnas',
      rawPhonemes: 'qul audhu birabbi alnnas',
      championMatch: {
        surah: 113, ayah: 5, text: five.phonemes_joined, phonemes_joined: five.phonemes_joined,
        score: 0.55, raw_score: 0.55, bonus: 0,
      },
    },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['113:5']);
  const jumped = refs(await engine.feed(hop()));
  assert.deepEqual(jumped, ['114:1']);
  assert.equal(searches(), 0);
  assert.equal(engine.phase, 'following');
});

test('cross-surah switch from Maun does not enter Baqarah at 2:2 without ayah 1', async () => {
  const local = [
    verse(107, 7, ['fawail', 'lil', 'musallin', 'alladhina', 'hum', 'an', 'salatihim', 'sahun'], 'Al-Maun'),
    verse(1, 1, ['bismi', 'allahi', 'alrahman', 'alrahim'], 'Al-Fatihah'),
    verse(1, 2, ['alhamdu', 'lillahi', 'rabbi', 'alalamin'], 'Al-Fatihah'),
    verse(2, 1, ['الم'], 'Al-Baqarah'),
    verse(2, 2, ['dhalika', 'alkitabu', 'la', 'rayba', 'feehi'], 'Al-Baqarah'),
  ];
  const lastMaun = local[0]!;
  const fatiha2 = local[2]!;
  const baqarah2 = local[4]!;
  const engine = new RecitationFollower(dbFrom(local), script([
    {
      text: lastMaun.phonemes_joined,
      rawPhonemes: lastMaun.phonemes_joined,
      championMatch: {
        surah: 107, ayah: 7, text: lastMaun.phonemes_joined, phonemes_joined: lastMaun.phonemes_joined,
        score: 0.88, raw_score: 0.88, bonus: 0,
      },
    },
    {
      text: fatiha2.phonemes_joined,
      rawPhonemes: fatiha2.phonemes_joined,
      championMatch: {
        surah: 2, ayah: 2, text: baqarah2.phonemes_joined, phonemes_joined: baqarah2.phonemes_joined,
        score: 0.92, raw_score: 0.92, bonus: 0,
      },
    },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['107:7']);
  const jumped = refs(await engine.feed(hop()));
  assert.ok(jumped.includes('1:2'), `expected Al-Fatihah 1:2, got ${jumped.join(',') || '(none)'}`);
  assert.ok(!jumped.includes('2:2'), `must not cross into Baqarah 2:2 without 2:1, got ${jumped.join(',')}`);
});

test('قل اعوذ برب الفلق after Ikhlas locks 113:1 not 114:1', async () => {
  const local = [
    verse(112, 4, ['ولم', 'يكن', 'له', 'كفوا', 'احد'], 'Al-Ikhlas'),
    verse(113, 1, ['قل', 'اعوذ', 'برب', 'الفلق'], 'Al-Falaq'),
    verse(114, 1, ['قل', 'اعوذ', 'برب', 'الناس'], 'An-Nas'),
  ];
  const four = local[0]!;
  const engine = new RecitationFollower(dbFrom(local), script([
    {
      text: four.phonemes_joined, rawPhonemes: four.phonemes_joined, championMatch: {
        surah: 112, ayah: 4, text: four.phonemes_joined, phonemes_joined: four.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      },
    },
    { text: 'قل اعوذ برب الفلق', rawPhonemes: 'قل اعوذ برب الفلق' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:4']);
  assert.deepEqual(refs(await engine.feed(hop())), ['113:1']);
});

test('after Ikhlas 112:4, CTC ايلاف قريش locks 106:1 without Global Search', async () => {
  const local = [
    verse(112, 4, ['ولم', 'يكن', 'له', 'كفوا', 'احد'], 'Al-Ikhlas'),
    verse(106, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'لإيلاف', 'قريش'], 'Quraysh'),
    verse(106, 2, ['ايلافهم', 'رحله', 'الشتاء', 'والصيف'], 'Quraysh'),
  ];
  const four = local[0]!;
  const { db, searches } = countingDb(local);
  const engine = new RecitationFollower(db, script([
    {
      text: four.phonemes_joined, rawPhonemes: four.phonemes_joined, championMatch: {
        surah: 112, ayah: 4, text: four.phonemes_joined, phonemes_joined: four.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      },
    },
    { text: 'ايلاف قريش', rawPhonemes: 'ايلاف قريش' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:4']);
  const started = Date.now();
  const jumped = refs(await engine.feed(hop()));
  const hopMs = Date.now() - started;
  assert.deepEqual(jumped, ['106:1']);
  assert.equal(searches(), 0);
  assert.ok(hopMs < 20, `Quraysh handoff Match exceeded 20ms: ${hopMs}ms`);
  assert.notEqual(latestDebugHud().searchSpace, 'Global Search');
});

test('after Ikhlas 112:4, CTC الاف قريش still locks 106:1', async () => {
  const local = [
    verse(112, 4, ['ولم', 'يكن', 'له', 'كفوا', 'احد'], 'Al-Ikhlas'),
    verse(106, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'لإيلاف', 'قريش'], 'Quraysh'),
  ];
  const four = local[0]!;
  const engine = new RecitationFollower(dbFrom(local), script([
    {
      text: four.phonemes_joined, rawPhonemes: four.phonemes_joined, championMatch: {
        surah: 112, ayah: 4, text: four.phonemes_joined, phonemes_joined: four.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      },
    },
    { text: 'الاف قريش', rawPhonemes: 'الاف قريش' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:4']);
  assert.deepEqual(refs(await engine.feed(hop())), ['106:1']);
});

test('a one-word عم hallucination after a lock does not become An-Naba 78:1', async () => {
  const local = [
    verse(112, 4, ['ولم', 'يكن', 'له', 'كفوا', 'احد'], 'Al-Ikhlas'),
    verse(78, 1, ['عم'], 'An-Naba'),
    verse(78, 2, ['عن', 'النبإ', 'العظيم'], 'An-Naba'),
    verse(114, 1, ['قل', 'اعوذ', 'برب', 'الناس'], 'An-Nas'),
  ];
  const four = local[0]!;
  const { db, searches } = countingDb(local);
  const engine = new RecitationFollower(db, script([
    {
      text: four.phonemes_joined, rawPhonemes: four.phonemes_joined, championMatch: {
        surah: 112, ayah: 4, text: four.phonemes_joined, phonemes_joined: four.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      },
    },
    {
      text: 'عم',
      rawPhonemes: 'عم',
      championMatch: {
        surah: 78, ayah: 1, text: 'عم', phonemes_joined: 'عم',
        score: 0.95, raw_score: 0.95, bonus: 0,
      },
    },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:4']);
  const jumped = refs(await engine.feed(hop()));
  assert.ok(!jumped.includes('78:1'), `lone عم must not lock 78:1, got ${jumped.join(',') || '(none)'}`);
  assert.equal(searches(), 0);
});

test('An-Naba ayah-2 عن النبإ العظيم after a lock may open 78:1', async () => {
  const local = [
    verse(112, 4, ['ولم', 'يكن', 'له', 'كفوا', 'احد'], 'Al-Ikhlas'),
    verse(78, 1, ['عم'], 'An-Naba'),
    verse(78, 2, ['عن', 'النبإ', 'العظيم'], 'An-Naba'),
  ];
  const four = local[0]!;
  const engine = new RecitationFollower(dbFrom(local), script([
    {
      text: four.phonemes_joined, rawPhonemes: four.phonemes_joined, championMatch: {
        surah: 112, ayah: 4, text: four.phonemes_joined, phonemes_joined: four.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      },
    },
    { text: 'عن النبإ العظيم', rawPhonemes: 'عن النبإ العظيم' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:4']);
  assert.deepEqual(refs(await engine.feed(hop())), ['78:1']);
});

test('mid-Fatiha 1:5 CTC must not hand off into Yusuf 12:1', async () => {
  const local = [
    verse(1, 5, ['اياك', 'نعبد', 'واياك', 'نستعين'], 'Al-Fatihah'),
    verse(1, 6, ['اهدنا', 'الصراط', 'المستقيم'], 'Al-Fatihah'),
    verse(12, 1, ['الر'], 'Yusuf'),
    verse(12, 2, ['تلك', 'ايات', 'الكتاب', 'المبين'], 'Yusuf'),
    verse(107, 1, ['ارايت', 'الذي', 'يكذب', 'بالدين'], 'Al-Maun'),
  ];
  const five = local[0]!;
  const engine = new RecitationFollower(dbFrom(local), script([
    {
      text: five.phonemes_joined, rawPhonemes: five.phonemes_joined, championMatch: {
        surah: 1, ayah: 5, text: five.phonemes_joined, phonemes_joined: five.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      },
    },
    { text: 'ان لك نستعيدين', rawPhonemes: 'ان لك نستعيدين' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:5']);
  const jumped = refs(await engine.feed(hop()));
  assert.ok(!jumped.includes('12:1'), `1:5 CTC must not lock 12:1, got ${jumped.join(',') || '(none)'}`);
  assert.equal(engine.lockedRef?.surah, 1);
  assert.equal(engine.lockedRef?.ayah, 5);
});

test('mid-Fatiha 1:6 leftover must not hand off into An-Nasr 110:1', async () => {
  const local = [
    verse(1, 6, ['اهدنا', 'الصراط', 'المستقيم'], 'Al-Fatihah'),
    verse(1, 7, ['صرط', 'الذين', 'انعمت', 'عليهم'], 'Al-Fatihah'),
    verse(110, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'اذا', 'جاء', 'نصر', 'الله', 'والفتح'], 'An-Nasr'),
  ];
  const six = local[0]!;
  const engine = new RecitationFollower(dbFrom(local), script([
    {
      text: six.phonemes_joined, rawPhonemes: six.phonemes_joined, championMatch: {
        surah: 1, ayah: 6, text: six.phonemes_joined, phonemes_joined: six.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      },
    },
    { text: 'صرط الذين انعمت عليهم', rawPhonemes: 'صرط الذين انعمت عليهم' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:6']);
  const jumped = refs(await engine.feed(hop()));
  assert.ok(!jumped.includes('110:1'), `1:6 leftover must not lock 110:1, got ${jumped.join(',') || '(none)'}`);
});

test('Ikhlas 112:3 leftover كفوا must not hand off into Muhammad 47:1', async () => {
  const local = [
    verse(112, 3, ['لم', 'يلد', 'ولم', 'يولد'], 'Al-Ikhlas'),
    verse(112, 4, ['ولم', 'يكن', 'له', 'كفوا', 'احد'], 'Al-Ikhlas'),
    verse(47, 1, ['الذين', 'كفروا', 'وصدوا', 'عن', 'سبيل', 'الله'], 'Muhammad'),
  ];
  const three = local[0]!;
  const engine = new RecitationFollower(dbFrom(local), script([
    {
      text: three.phonemes_joined, rawPhonemes: three.phonemes_joined, championMatch: {
        surah: 112, ayah: 3, text: three.phonemes_joined, phonemes_joined: three.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      },
    },
    { text: 'ولم يكن له كفوا احد', rawPhonemes: 'ولم يكن له كفوا احد' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:3']);
  const jumped = refs(await engine.feed(hop()));
  assert.ok(!jumped.includes('47:1'), `112:3 leftover must not lock 47:1, got ${jumped.join(',') || '(none)'}`);
});

test('cold والعصر locks 103:1 from the openings index', async () => {
  const local = [
    verse(103, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'والعصر'], 'Al-Asr'),
    verse(103, 2, ['ان', 'الانسن', 'لفي', 'خسر'], 'Al-Asr'),
  ];
  const engine = new RecitationFollower(dbFrom(local), script([
    { text: 'والعصر', rawPhonemes: 'والعصر' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['103:1']);
});

test('cold 103:1 champion holds ayah 1 when the window already contains 103:2', async () => {
  const local = [
    verse(103, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'والعصر'], 'Al-Asr'),
    verse(103, 2, ['ان', 'الانسن', 'لفي', 'خسر'], 'Al-Asr'),
  ];
  const engine = new RecitationFollower(dbFrom(local), script([{
    text: 'والعفر ان الانسان لفي خسر',
    rawPhonemes: 'والعفر ان الانسان لفي خسر',
    championMatch: {
      surah: 103, ayah: 1, text: 'والعصر', phonemes_joined: 'والعصر',
      score: 0.94, raw_score: 0.94, bonus: 0,
    },
  }]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['103:1']);
});

test('cold English noise does not lock Ta-Ha 20:1 without isolated muqattaat', async () => {
  const local = [
    verse(20, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'طه'], 'Ta-Ha'),
    verse(7, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'المص'], 'Al-Araf'),
  ];
  const engine = new RecitationFollower(dbFrom(local), script([{
    text: 'hello there how are you today',
    rawPhonemes: 'hello there how are you today',
    championMatch: {
      surah: 20, ayah: 1, text: 'طه', phonemes_joined: 'طه',
      score: 0.99, raw_score: 0.99, bonus: 0,
    },
  }]));
  assert.deepEqual(refs(await engine.feed(audio(1))), []);
  assert.equal(engine.phase, 'acquiring');
});

test('cold CTC طها in English noise does not lock 20:1', async () => {
  const local = [
    verse(20, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'طه'], 'Ta-Ha'),
  ];
  const engine = new RecitationFollower(dbFrom(local), script([{
    text: 'شكرا طها س هونج',
    rawPhonemes: 'شكرا طها س هونج',
    championMatch: {
      surah: 20, ayah: 1, text: 'طه', phonemes_joined: 'طه',
      score: 0.99, raw_score: 0.99, bonus: 0,
    },
  }]));
  assert.deepEqual(refs(await engine.feed(audio(1))), []);
  assert.equal(engine.phase, 'acquiring');
});

test('cold الحمد does not lock Al-Haqqah 69:1', async () => {
  const local = [
    verse(1, 2, ['الحمد', 'لله', 'رب', 'العالمين'], 'Al-Fatihah'),
    verse(69, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'الحاقة'], 'Al-Haqqah'),
  ];
  const engine = new RecitationFollower(dbFrom(local), script([{
    text: 'بسم الله الرحمن الرحيم الحمد للهه',
    rawPhonemes: 'بسم الله الرحمن الرحيم الحمد للهه',
    championMatch: {
      surah: 69, ayah: 1, text: 'الحاقة', phonemes_joined: 'الحاقة',
      score: 0.9, raw_score: 0.9, bonus: 0,
    },
  }]));
  const locked = refs(await engine.feed(audio(1)));
  assert.ok(!locked.includes('69:1'), `الحمد must not lock 69:1, got ${locked.join(',') || '(none)'}`);
});

test('cold isolated طه still locks 20:1', async () => {
  const local = [
    verse(20, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'طه'], 'Ta-Ha'),
  ];
  const engine = new RecitationFollower(dbFrom(local), script([{
    text: 'طه',
    rawPhonemes: 'طه',
    championMatch: {
      surah: 20, ayah: 1, text: 'طه', phonemes_joined: 'طه',
      score: 0.95, raw_score: 0.95, bonus: 0,
    },
  }]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['20:1']);
});

test('stripProclitics folds لإيلاف onto ايلاف without a surah map', () => {
  assert.equal(stripProclitics('لإيلاف'), stripProclitics('ايلاف'));
  assert.equal(stripProclitics('بايلاف'), stripProclitics('ايلاف'));
  assert.equal(stripProclitics('لايلاف'), stripProclitics('ايلاف'));
});

test('shared الحمد لله openings stay co-candidates until رب vs الذي', async () => {
  const local = [
    verse(112, 4, ['ولم', 'يكن', 'له', 'كفوا', 'احد'], 'Al-Ikhlas'),
    verse(1, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم'], 'Al-Fatihah'),
    verse(1, 2, ['الحمد', 'لله', 'رب', 'العالمين'], 'Al-Fatihah'),
    verse(6, 1, ['الحمد', 'لله', 'الذي', 'خلق', 'السموات', 'والارض'], 'Al-Anam'),
  ];
  const four = local[0]!;
  const { db, searches } = countingDb(local);
  const engine = new RecitationFollower(db, script([
    {
      text: four.phonemes_joined, rawPhonemes: four.phonemes_joined, championMatch: {
        surah: 112, ayah: 4, text: four.phonemes_joined, phonemes_joined: four.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      },
    },
    { text: 'الحمد لله', rawPhonemes: 'الحمد لله' },
    { text: 'الحمد لله رب العالمين', rawPhonemes: 'الحمد لله رب العالمين' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:4']);
  const waiting = refs(await engine.feed(hop()));
  assert.ok(!waiting.includes('1:2') && !waiting.includes('6:1'), `shared الحمد لله must wait, got ${waiting.join(',') || '(none)'}`);
  assert.equal(searches(), 0);
  assert.deepEqual(refs(await engine.feed(hop())), ['1:2']);
});

test('a 7-character one-word opening may lock on the first switch hop', async () => {
  const local = [
    verse(112, 4, ['ولم', 'يكن', 'له', 'كفوا', 'احد'], 'Al-Ikhlas'),
    verse(100, 1, ['والعاديات'], 'Al-Adiyat'),
  ];
  const four = local[0]!;
  const engine = new RecitationFollower(dbFrom(local), script([
    {
      text: four.phonemes_joined, rawPhonemes: four.phonemes_joined, championMatch: {
        surah: 112, ayah: 4, text: four.phonemes_joined, phonemes_joined: four.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      },
    },
    { text: 'والعاديات', rawPhonemes: 'والعاديات' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:4']);
  assert.deepEqual(refs(await engine.feed(hop())), ['100:1']);
});

test('two consecutive عم frames after a lock may confirm 78:1', async () => {
  const local = [
    verse(112, 4, ['ولم', 'يكن', 'له', 'كفوا', 'احد'], 'Al-Ikhlas'),
    verse(78, 1, ['عم'], 'An-Naba'),
    verse(78, 2, ['عن', 'النبإ', 'العظيم'], 'An-Naba'),
  ];
  const four = local[0]!;
  const engine = new RecitationFollower(dbFrom(local), script([
    {
      text: four.phonemes_joined, rawPhonemes: four.phonemes_joined, championMatch: {
        surah: 112, ayah: 4, text: four.phonemes_joined, phonemes_joined: four.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      },
    },
    { text: 'عم', rawPhonemes: 'عم' },
    { text: 'عم', rawPhonemes: 'عم' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:4']);
  const first = refs(await engine.feed(hop()));
  assert.ok(!first.includes('78:1'), `first عم frame must wait, got ${first.join(',') || '(none)'}`);
  assert.deepEqual(refs(await engine.feed(hop())), ['78:1']);
});

test('114-openings handoff scores without a full-mushaf search and stays under 2ms', async () => {
  const rows: QuranVerse[] = [
    verse(112, 4, ['ولم', 'يكن', 'له', 'كفوا', 'احد'], 'Al-Ikhlas'),
  ];
  for (let surah = 1; surah <= QURAN_SURAH_COUNT; surah++) {
    if (surah === 112 || surah === 106) continue;
    rows.push(verse(surah, 1, ['فتح', `س${surah}`], `S${surah}`));
  }
  rows.push(verse(106, 1, ['بسم', 'الله', 'الرحمن', 'الرحيم', 'لإيلاف', 'قريش'], 'Quraysh'));
  const four = rows[0]!;
  const { db, searches } = countingDb(rows);
  const engine = new RecitationFollower(db, script([
    {
      text: four.phonemes_joined, rawPhonemes: four.phonemes_joined, championMatch: {
        surah: 112, ayah: 4, text: four.phonemes_joined, phonemes_joined: four.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      },
    },
    { text: 'ايلاف قريش', rawPhonemes: 'ايلاف قريش' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:4']);
  const started = performance.now();
  const jumped = refs(await engine.feed(hop()));
  const hopMs = performance.now() - started;
  assert.deepEqual(jumped, ['106:1']);
  assert.equal(searches(), 0);
  // Hop wall includes scripted transcribe; the 114-openings score itself is not
  // a 6,236-ayah `bestJoint03Match` (searches stay 0).
  assert.ok(hopMs < 20, `114-openings hop exceeded 20ms: ${hopMs.toFixed(2)}ms`);
});

test('Ya-Sin 36:16 lookback does not steal An-Baqarah 2:1', async () => {
  const yasin = verse(36, 16, ['قالوا', 'ربنا', 'يعلم', 'انا', 'اليكم', 'لمرسلون'], 'Ya-Sin');
  const rows = [
    ...muqattaat,
    yasin,
  ];
  const engine = new RecitationFollower(dbFrom(rows), script([
    {
      text: yasin.phonemes_joined,
      rawPhonemes: yasin.phonemes_joined,
      championMatch: {
        surah: 36, ayah: 16, text: yasin.phonemes_joined, phonemes_joined: yasin.phonemes_joined,
        score: 0.86, raw_score: 0.86, bonus: 0,
      },
    },
    {
      text: 'الرحمن الرحيم الم',
      rawPhonemes: 'الرحمن الرحيم الم',
      championMatch: muqattaatChampion(2, 1, 0.9),
    },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(6))), ['36:16']);
  assert.equal(engine.phase, 'following');
});

test('Ikhlas هو الله after Kawthar does not snap to Imran 3:1', async () => {
  const local = [
    verse(108, 3, ['inna', 'shaniaka', 'huwa', 'alabtar'], 'Al-Kawthar'),
    verse(3, 1, ['الم'], 'Al-Imran'),
    verse(3, 2, ['الله', 'لا', 'اله', 'الا', 'هو', 'الحي', 'القيوم'], 'Al-Imran'),
    verse(14, 1, ['الر'], 'Ibrahim'),
    verse(14, 2, ['الله', 'الذي', 'له', 'ما', 'في', 'السموات'], 'Ibrahim'),
    verse(112, 1, ['قل', 'هو', 'الله', 'احد'], 'Al-Ikhlas'),
  ];
  const three = local[0]!;
  const { db, searches } = countingDb(local);
  const engine = new RecitationFollower(db, script([
    {
      text: three.phonemes_joined, rawPhonemes: three.phonemes_joined, championMatch: {
        surah: 108, ayah: 3, text: three.phonemes_joined, phonemes_joined: three.phonemes_joined,
        score: 0.9, raw_score: 0.9, bonus: 0,
      },
    },
    { text: 'هو الله', rawPhonemes: 'هو الله' },
    { text: 'قل هو الله احد', rawPhonemes: 'قل هو الله احد' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['108:3']);
  const falseSnap = refs(await engine.feed(hop()));
  assert.ok(!falseSnap.includes('3:1'), `هو الله must not lock 3:1, got ${falseSnap.join(',') || '(none)'}`);
  assert.ok(!falseSnap.includes('14:1'), `هو الله must not lock 14:1, got ${falseSnap.join(',') || '(none)'}`);
  assert.equal(searches(), 0);
  // Reacquire after a weak last-ayah hop needs an acquire-sized window.
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:1']);
  assert.equal(searches(), 0);
  assert.notEqual(latestDebugHud().searchSpace, 'Global Search');
});

test('post-lock short leftover never runs bestJoint03Match (Match stay openings-only)', async () => {
  const local = [
    verse(1, 7, ['صرط', 'الذين', 'انعمت', 'عليهم', 'غير', 'المغضوب', 'عليهم', 'ولا', 'الضالين'], 'Al-Fatihah'),
    verse(3, 1, ['الم'], 'Al-Imran'),
    verse(3, 2, ['الله', 'لا', 'اله', 'الا', 'هو', 'الحي', 'القيوم'], 'Al-Imran'),
    verse(112, 1, ['قل', 'هو', 'الله', 'احد'], 'Al-Ikhlas'),
  ];
  const seven = local[0]!;
  const { db, searches } = countingDb(local);
  const engine = new RecitationFollower(db, script([
    {
      text: seven.phonemes_joined, rawPhonemes: seven.phonemes_joined, championMatch: {
        surah: 1, ayah: 7, text: seven.phonemes_joined, phonemes_joined: seven.phonemes_joined,
        score: 0.9, raw_score: 0.9, bonus: 0,
      },
    },
    { text: 'غير المغضوب عليهم ولا الضالين هو الله', rawPhonemes: 'غير المغضوب عليهم ولا الضالين هو الله' },
    { text: 'هو الله', rawPhonemes: 'هو الله' },
    { text: 'قل هو الله احد', rawPhonemes: 'قل هو الله احد' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:7']);
  const started = performance.now();
  const mid = refs(await engine.feed(audio(ACQUIRE_MAX_SEC)));
  const hopMs = performance.now() - started;
  assert.ok(!mid.includes('3:1'), `Fatiha leftover must not lock 3:1, got ${mid.join(',') || '(none)'}`);
  assert.equal(searches(), 0);
  assert.ok(hopMs < 30, `post-lock openings hop exceeded 30ms: ${hopMs.toFixed(2)}ms`);
  assert.notEqual(latestDebugHud().searchSpace, 'Global Search');
  // Intermediate weak hop may reacquire; Ikhlas needs an acquire-sized window.
  assert.deepEqual(refs(await engine.feed(audio(1))), []);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:1']);
  assert.equal(searches(), 0);
});

test('letter-name الف لام ميم after Fatiha may lock 2:1', async () => {
  const local = [
    verse(1, 7, ['صرط', 'الذين', 'انعمت', 'عليهم', 'غير', 'المغضوب', 'عليهم', 'ولا', 'الضالين'], 'Al-Fatihah'),
    verse(2, 1, ['الم'], 'Al-Baqarah'),
    verse(2, 2, ['ذلك', 'الكتب', 'لا', 'ريب', 'فيه'], 'Al-Baqarah'),
    verse(3, 1, ['الم'], 'Al-Imran'),
    verse(112, 1, ['قل', 'هو', 'الله', 'احد'], 'Al-Ikhlas'),
  ];
  const seven = local[0]!;
  const engine = new RecitationFollower(dbFrom(local), script([
    {
      text: seven.phonemes_joined, rawPhonemes: seven.phonemes_joined, championMatch: {
        surah: 1, ayah: 7, text: seven.phonemes_joined, phonemes_joined: seven.phonemes_joined,
        score: 0.9, raw_score: 0.9, bonus: 0,
      },
    },
    { text: 'الف لام ميم', rawPhonemes: 'الف لام ميم' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['1:7']);
  assert.deepEqual(refs(await engine.feed(hop())), ['2:1']);
});

test('Ikhlas CTC الم لم ي after Kawthar does not lock Baqarah 2:1', async () => {
  const local = [
    verse(108, 3, ['ان', 'شانيك', 'هو', 'الابتر'], 'Al-Kawthar'),
    verse(2, 1, ['الم'], 'Al-Baqarah'),
    verse(2, 2, ['ذلك', 'الكتب', 'لا', 'ريب', 'فيه'], 'Al-Baqarah'),
    verse(3, 1, ['الم'], 'Al-Imran'),
    verse(112, 1, ['قل', 'هو', 'الله', 'احد'], 'Al-Ikhlas'),
  ];
  const three = local[0]!;
  const { db, searches } = countingDb(local);
  const engine = new RecitationFollower(db, script([
    {
      text: three.phonemes_joined, rawPhonemes: three.phonemes_joined, championMatch: {
        surah: 108, ayah: 3, text: three.phonemes_joined, phonemes_joined: three.phonemes_joined,
        score: 0.99, raw_score: 0.99, bonus: 0,
      },
    },
    { text: 'قل هو الله', rawPhonemes: 'قل هو الله' },
    { text: 'الم لم ي', rawPhonemes: 'الم لم ي' },
    { text: 'قل هو الله احد', rawPhonemes: 'قل هو الله احد' },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['108:3']);
  const partial = refs(await engine.feed(hop()));
  assert.ok(!partial.includes('2:1') && !partial.includes('3:1'), `قل هو الله must not lock muqattaat, got ${partial.join(',') || '(none)'}`);
  if (partial.includes('112:1')) {
    assert.equal(searches(), 0);
    return;
  }
  const garbled = refs(await engine.feed(hop()));
  assert.ok(!garbled.includes('2:1') && !garbled.includes('3:1'), `الم لم ي must not lock 2:1, got ${garbled.join(',') || '(none)'}`);
  assert.equal(searches(), 0);
  assert.deepEqual(refs(await engine.feed(audio(1))), ['112:1']);
});

test('reacquire does not lock Al-Qariah on weak Kafirun champion overlap', async () => {
  const qariah = verse(101, 1, ['alqariah'], 'Al-Qariah');
  const kafirun = corpus.find((item) => item.surah === 109 && item.ayah === 1)!;
  const engine = new RecitationFollower(dbFrom([...corpus, qariah]), script([
    spoken(109, 1, 0.88),
    {
      text: kafirun.phonemes_joined,
      rawPhonemes: kafirun.phonemes_joined,
      championMatch: {
        surah: 101,
        ayah: 1,
        text: qariah.phonemes_joined,
        phonemes_joined: qariah.phonemes_joined,
        score: 0.5,
        raw_score: 0.5,
        bonus: 0,
        runners_up: [{
          surah: 109, ayah: 1, score: 0.48, raw_score: 0.48, bonus: 0,
          phonemes_joined: kafirun.phonemes_joined,
        }],
      },
    },
  ]));
  assert.deepEqual(refs(await engine.feed(audio(1))), ['109:1']);
  const partial = refs(await engine.feed(hop()));
  assert.ok(!partial.includes('101:1'), `phantom 101:1: ${partial.join(',')}`);
});


