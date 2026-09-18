import type { QuranChampionMatch, QuranDB, QuranVerse, TilawaSession, TranscribeResult, VerseMatchMessage } from '@tilawa/core';
import { fragmentScore, ratio as levRatio } from '../../node_modules/@tilawa/core/dist/levenshtein.js';
import { isFatihaBasmala, isFatihaBasmalaTail, OPENING_BASMALA_WORDS, openingBasmalaWordCount, splitOpeningBasmala } from './basmala';
import { recordRecognitionCycle } from './recognition-clocks';
import { handoffCandidateSurahs, isFamousHandoffSurah, rerankChampion, surahBonus, acousticChampion, TIE_BREAK_MARGIN } from './salah-prior';
import { currentRemainder, openingCousin, scoreExpectedTape } from './expected-tape';
import { TRACKING_COMPLETION_COVERAGE } from './sequential';
import type { FollowerPhase, RecognitionMessage, VerseRef } from './types';

export type { FollowerPhase };
export type TranscribeFn = (audio: Float32Array, locate: boolean) => Promise<TranscribeResult>;
export type FeedTimings = { queueWaitMs?: number; stallMs?: number };

const SAMPLE_RATE = 16000;
const ACQUIRE_MIN_SEC = 0.9;
export const ACQUIRE_MAX_SEC = 4;
/** First-lock acquire window. 002001 is ~7.6 s Basmala+الم; a 4 s cap slides
 * الم off before the observed Mac 2:2@11s lock. Reacquire stays at
 * ACQUIRE_MAX_SEC so jump / back-to-back keepLast(4 s) is unchanged. */
export const ACQUIRE_AFTER_BASMALA_SEC = 8;
/** Drop this much newest audio when recovering muqattaʿāt from a mixed window. */
const LOOKBACK_DROP_SEC = 3;
export const FOLLOW_WINDOW_SEC = 1.2;
export const FOLLOW_TRIGGER_SEC = 0.4;
/** Grow the follow window only for a short last ayah of the current surah. */
export const FOLLOW_LAST_AYAH_ACCUMULATE_SEC = 5;
export const SHORT_LAST_AYAH_WORDS = 4;
const LAST_AYAH_SEED_SEC = 0.3;
/** After the first lock of a session, keep enough of the current ayah to keep following it. */
export const KEEP_AFTER_LOCK_SEC = 1.0;
/** After advancing to the next ayah, keep a short splice so the previous tail does not dominate. */
export const KEEP_AFTER_COMMIT_SEC = 0.25;
const LOCK_SCORE = 0.62;
const LOCK_CLEAR_SCORE = 0.72;
const SURAH_MARGIN = TIE_BREAK_MARGIN;
const NEIGHBORHOOD_KEEP = 0.5;
const MISMATCH_LIMIT = 3;
const LOOKAHEAD = 5;
const RIVAL_SCAN = 6;
const SHARED_PREFIX_MAX = 6;

function samplesFor(seconds: number): number {
  return Math.max(1, Math.round(SAMPLE_RATE * seconds));
}

function concatAudio(left: Float32Array, right: Float32Array): Float32Array {
  const audio = new Float32Array(left.length + right.length);
  audio.set(left);
  audio.set(right, left.length);
  return audio;
}

function keepLast(audio: Float32Array, seconds: number): Float32Array {
  const keep = samplesFor(seconds);
  if (audio.length <= keep) return audio;
  const trimmed = new Float32Array(keep);
  trimmed.set(audio.subarray(audio.length - keep));
  return trimmed;
}

function keepFirst(audio: Float32Array, seconds: number): Float32Array {
  const keep = samplesFor(seconds);
  if (audio.length <= keep) return audio;
  return audio.subarray(0, keep);
}

function compact(text: string): string {
  return text.replace(/\s+/g, '');
}

function verseText(verse: QuranVerse): string {
  return verse.phonemes_joined_ns ?? compact(verse.phonemes_joined);
}

/** How well this ayah explains the current window. Short ayahs must appear
 * inside the transcript; a partial recitation of a long ayah must appear
 * inside that ayah. Do not score a long ayah as a host for a short query. */
function explainScore(query: string, verse: QuranVerse | undefined): number {
  if (!verse) return 0;
  const text = compact(query);
  const ref = verseText(verse);
  if (!text || !ref) return 0;
  return ref.length <= text.length ? fragmentScore(ref, text) : fragmentScore(text, ref);
}

/** Alignment against the opening of the ayah, not a fuzzy hit in the middle. */
function openingScore(query: string, verse: QuranVerse | undefined): number {
  if (!verse) return 0;
  const text = compact(query);
  const ref = verseText(verse);
  if (!text || !ref) return 0;
  const opening = ref.slice(0, Math.min(ref.length, text.length + 6));
  return Math.max(fragmentScore(text, opening), levRatio(text, opening));
}

function wordsMatch(left: string, right: string, minRatio = 0.8): boolean {
  if (left === right) return true;
  if (left.length <= 2 || right.length <= 2) return false;
  return levRatio(left, right) >= minRatio;
}

/** Shared stem such as الصرط / صرط, or ASR الا hitting الانسن. Not a 0.7
 * fuzzy hit like الرحمن / الحمد. Opening align uses openingStem instead so
 * الم cannot stand in for المال. */
function relatedStem(left: string, right: string): boolean {
  if (left === right) return true;
  if (left.length <= 2 || right.length <= 2) return false;
  const longer = left.length >= right.length ? left : right;
  const shorter = left.length >= right.length ? right : left;
  return longer.endsWith(shorter) || longer.startsWith(shorter);
}

function openingStem(left: string, right: string): boolean {
  if (left === right) return true;
  if (left.length <= 2 || right.length <= 2) return false;
  const longer = left.length >= right.length ? left : right;
  const shorter = left.length >= right.length ? right : left;
  if (longer.endsWith(shorter)) return true;
  return longer.startsWith(shorter) && longer.length - shorter.length <= 1;
}

/** Advance/follow soft match: نفاث ≈ النفثت, الجنة ≈ الجنه. */
function softTokenMatch(left: string, right: string): boolean {
  if (wordsMatch(left, right) || relatedStem(left, right)) return true;
  const strip = (word: string) => compact(word).replace(/^ال/, '').replace(/^[وف]/, '');
  const a = strip(left);
  const b = strip(right);
  if (a.length >= 2 && a === b) return true;
  if (a.length < 3 || b.length < 3) return false;
  if (a.includes(b) || b.includes(a)) return true;
  return levRatio(a, b) >= 0.72;
}

function openingWordMatch(left: string, right: string): boolean {
  return left === right || openingStem(left, right);
}

const OPENING_BASMALA_TOKENS = new Set([
  'بسم', 'الله', 'الرحمن', 'الرحيم', 'bismi', 'allahi', 'alrahman', 'alrahim',
]);

function isSharedBasmalaToken(word: string): boolean {
  const token = compact(word);
  if (OPENING_BASMALA_TOKENS.has(token)) return true;
  return [...OPENING_BASMALA_TOKENS].some((item) => relatedStem(item, token));
}

/** Tight Basmala-tail tokens. relatedStem would swallow الرحيمالم as الرحيم. */
function isBasmalaTailToken(word: string): boolean {
  const token = compact(word);
  if (OPENING_BASMALA_TOKENS.has(token)) return true;
  return [...OPENING_BASMALA_TOKENS].some((item) => openingStem(token, item));
}

function countLeadingBasmalaTail(recognized: string[]): number {
  let count = 0;
  for (const word of recognized) {
    if (!isBasmalaTailToken(word)) break;
    count += 1;
    if (count >= OPENING_BASMALA_WORDS) break;
  }
  return count;
}

function shortAyah1Body(token: string): boolean {
  const body = compact(token);
  return body.length >= 2 && body.length <= 5;
}

/** Recited muqattaʿāt are often letter names (الف لام ميم), not the compact الم. */
const MUQATTAAT_LETTER_NAMES: Record<string, readonly string[]> = {
  ا: ['ا', 'الف', 'الالف'],
  ح: ['ح', 'حا', 'حاء', 'الحا'],
  ر: ['ر', 'را', 'راء', 'الرا'],
  س: ['س', 'سين', 'السين'],
  ص: ['ص', 'صاد', 'الصاد'],
  ط: ['ط', 'طا', 'طاء', 'الطا'],
  ع: ['ع', 'عين', 'العين'],
  ق: ['ق', 'قاف', 'القاف'],
  ك: ['ك', 'كاف', 'الكاف'],
  ل: ['ل', 'لام', 'اللام'],
  م: ['م', 'ميم', 'الميم'],
  ن: ['ن', 'نون', 'النون'],
  ه: ['ه', 'ها', 'هاء', 'الها'],
  ي: ['ي', 'يا', 'ياء', 'اليا'],
};

function muqattaatLetter(char: string): string {
  if (char === 'أ' || char === 'إ' || char === 'آ' || char === 'ٱ') return 'ا';
  return char;
}

function namedMuqattaatLetter(word: string): string | undefined {
  const token = compact(word);
  if (!token) return undefined;
  for (const [letter, names] of Object.entries(MUQATTAAT_LETTER_NAMES)) {
    if (names.includes(token)) return letter;
  }
  return undefined;
}

function heardAttachedLetterName(heard: string, body: string): boolean {
  const last = muqattaatLetter(body.at(-1) ?? '');
  const names = MUQATTAAT_LETTER_NAMES[last];
  if (!names) return false;
  for (const name of names) {
    if (name.length < 2) continue;
    if (heard === body + name) return true;
    if (name.startsWith(last) && heard === body + name.slice(1)) return true;
  }
  return false;
}

function heardMuqattaatSpelling(recognized: string[], body: string): boolean {
  const needed = [...body].map(muqattaatLetter);
  if (!needed.length || needed.some((letter) => !MUQATTAAT_LETTER_NAMES[letter])) return false;
  const letters: string[] = [];
  for (const word of recognized) {
    if (isBasmalaTailToken(word)) continue;
    const letter = namedMuqattaatLetter(word);
    if (!letter) {
      if (letters.length) break;
      continue;
    }
    letters.push(letter);
  }
  return letters.length === needed.length && needed.every((letter, index) => letters[index] === letter);
}

/** Exact الم, one-letter elongation المي, attached meem-name الميم, or
 * recited letter names الف لام ميم. Not المال / المصدر. */
function heardIsolatedBodyToken(recognized: string[], token: string): boolean {
  const body = compact(token);
  if (!body) return false;
  if (recognized.some((word) => {
    const heard = compact(word);
    return heard === body || openingStem(heard, body) || heardAttachedLetterName(heard, body);
  })) return true;
  return heardMuqattaatSpelling(recognized, body);
}

/** One-word ayah-1 muqattaʿāt (الم, المص). Not Basmala-echo الرحمن. */
function isExactMuqattaatAyah1(verse: QuranVerse): boolean {
  if (verse.ayah !== 1 || skipUnusableLock(verse)) return false;
  const { words } = verseAlignWords(verse);
  if (words.length !== 1) return false;
  const token = compact(words[0]!);
  return shortAyah1Body(token) && !isSharedBasmalaToken(token);
}

/** Opening words in order. Extra spoken words may be skipped; a distinctive
 * verse word may not, so قُلْ … ٱللَّهُ cannot stand in for قُل لَّوْ شَاءَ. */
function contiguousAlignFromOpening(recognized: string[], verseWords: string[]): number[] {
  if (!verseWords.length) return [];
  // Shared opening Basmala is not ayah-1 body evidence (الرحمن in 55:1 vs 001001).
  const from = leadingBasmalaWords(recognized);
  let start = -1;
  for (let index = from; index < recognized.length; index++) {
    if (openingWordMatch(recognized[index]!, verseWords[0]!)) {
      start = index;
      break;
    }
  }
  if (start < 0) return [];
  const matched = [0];
  let expected = 1;
  for (let spoken = start + 1; spoken < recognized.length && expected < verseWords.length; spoken++) {
    if (wordsMatch(recognized[spoken]!, verseWords[expected]!)) {
      matched.push(expected);
      expected += 1;
    }
  }
  return matched;
}

function leadingBasmalaWords(recognized: string[]): number {
  const first = recognized[0];
  if (first !== 'بسم' && first !== 'bismi') return 0;
  return Math.min(OPENING_BASMALA_WORDS, recognized.length);
}

/** True when this ayah's opening is the start of the window, not a later
 * shared word such as الله inside قُلْ … أَحَدٌ. */
function openingIsAtStart(recognized: string[], verseWords: string[]): boolean {
  if (!recognized.length || !verseWords.length) return false;
  if (openingWordMatch(recognized[0]!, verseWords[0]!)) return true;
  const skip = leadingBasmalaWords(recognized);
  if (skip > 0 && skip < recognized.length && openingWordMatch(recognized[skip]!, verseWords[0]!)) return true;
  // Mac 4 s windows often keep الرحمن الرحيم after بسم has slid off, or spell
  // الم as letter names. A one-word ayah-1 body after that tail is not the
  // 55:1-inside-Basmala false lock.
  if (verseWords.length !== 1 || !shortAyah1Body(verseWords[0]!)) return false;
  const tail = countLeadingBasmalaTail(recognized);
  if (tail >= recognized.length) return false;
  return heardIsolatedBodyToken(recognized.slice(tail), verseWords[0]!);
}

function alignWordPositions(recognized: string[], verseWords: string[]): { verse: number; spoken: number }[] {
  const matched: { verse: number; spoken: number }[] = [];
  let cursor = 0;
  for (let spoken = 0; spoken < recognized.length; spoken++) {
    if (cursor >= verseWords.length) break;
    const limit = Math.min(cursor + LOOKAHEAD, verseWords.length);
    for (let index = cursor; index < limit; index++) {
      if (wordsMatch(recognized[spoken]!, verseWords[index]!)) {
        matched.push({ verse: index, spoken });
        cursor = index + 1;
        break;
      }
    }
  }
  return matched;
}

function alignWords(recognized: string[], verseWords: string[]): number[] {
  return alignWordPositions(recognized, verseWords).map((item) => item.verse);
}


function isAmbiguousAdvanceOpening(word: string): boolean {
  const arabic = new Set(['رب', 'الله', 'الحمد', 'قل', 'بسم']);
  if (arabic.has(word)) return true;
  const w = word.toLowerCase();
  return /^rabb/.test(w) || w === 'allah' || w === 'allahu' || /^alhamd/.test(w) || w === 'qul' || w === 'bismi';
}

/** High-frequency openings that must not count as distinctive mid-ayah evidence. */
const FORMULA_BODY_TOKENS = new Set([
  'قالوا', 'ولا', 'وما', 'كلا', 'الذي', 'الذين', 'التي', 'هذا', 'هذه', 'اولئك',
  'qalu', 'wala', 'wama', 'kalla',
]);

function isFormulaBodyToken(word: string): boolean {
  const token = compact(word);
  if (isAmbiguousAdvanceOpening(token) || isSharedBasmalaToken(token)) return true;
  return FORMULA_BODY_TOKENS.has(token);
}

function stemKey(word: string): string {
  return compact(word).replace(/^[وف]/, '').replace(/^ال/, '');
}

/** تستطيعوا vs تستوي: shared تست- prefix, not a lockable unique token. */
function confusableBodyToken(left: string, right: string): boolean {
  const a = stemKey(left);
  const b = stemKey(right);
  if (a.length < 4 || b.length < 4 || a === b) return false;
  if (a.slice(0, 3) === b.slice(0, 3)) return true;
  return levRatio(a, b) >= 0.72;
}

function tokenExplainedBy(token: string, verseWords: string[]): boolean {
  return verseWords.some((word) => wordsMatch(token, word) || relatedStem(token, word));
}

/** Length-4+ tokens this ayah actually contains. Formula openings do not count. */
function distinctiveTokens(recognized: string[], verseWords: string[]): string[] {
  return recognized.filter((token) => {
    const text = compact(token);
    if (text.length < 4 || isFormulaBodyToken(text)) return false;
    return tokenExplainedBy(text, verseWords);
  });
}

/** Distinctive tokens the ayah does not explain. يعلم is not explained by سيعلمون. */
function unexplainedDistinctive(recognized: string[], verseWords: string[]): string[] {
  return recognized.filter((token) => {
    const text = compact(token);
    if (text.length < 4 || isFormulaBodyToken(text)) return false;
    return !tokenExplainedBy(text, verseWords);
  });
}

function uniqueWordSkip(verse: QuranVerse, current?: QuranVerse): number {
  const basmala = openingBasmalaWordCount(verse);
  if (!current?.phoneme_words.length || !verse.phoneme_words.length) return basmala;
  let overlap = 0;
  const max = Math.min(3, current.phoneme_words.length, verse.phoneme_words.length);
  for (let count = max; count >= 1; count--) {
    const tail = current.phoneme_words.slice(-count);
    const head = verse.phoneme_words.slice(0, count);
    if (tail.every((word, index) => relatedStem(word, head[index]!))) {
      overlap = count;
      break;
    }
  }
  return Math.max(basmala, overlap);
}

/** Leftover after the current ayah only when its real opening was heard. */
function remainingAfterCurrent(recognized: string[], verseWords: string[]): string[] {
  const aligned = alignWordPositions(recognized, verseWords);
  const first = aligned[0];
  const last = aligned.at(-1);
  if (!first || first.verse !== 0 || !last) return recognized;
  if (!relatedStem(recognized[first.spoken]!, verseWords[0]!)) return recognized;
  return recognized.slice(last.spoken + 1);
}

/** Tokens after the last current-ayah word in this window, even if the
 * current opening has already slid off. Live follow windows often start
 * with a shared tail (الناس, الصرط, الله). */
function leftoverAfterHeardCurrent(recognized: string[], verseWords: string[]): string[] {
  const aligned = alignWordPositions(recognized, verseWords);
  const last = aligned.at(-1);
  if (!last) return [];
  return recognized.slice(last.spoken + 1);
}

/** Same-surah leftover: start at the first token current does not explain, or
 * after the last aligned current word. Shared tails (الناس, الصرط) alone stay
 * empty so they cannot be re-read as the next ayah. */
function sequentialLeftover(recognized: string[], currentBody: string[]): string[] {
  const after = leftoverAfterHeardCurrent(recognized, currentBody);
  const firstUnused = recognized.findIndex((token) => (
    !currentBody.some((word) => wordsMatch(token, word) || relatedStem(token, word))
  ));
  if (firstUnused < 0) return after;
  const fromUnused = recognized.slice(firstUnused);
  return fromUnused.length >= after.length ? fromUnused : after;
}

function sequentialOpeningMatch(left: string, right: string): boolean {
  if (left === right || wordsMatch(left, right) || openingCousin(left, right)) return true;
  const strip = (word: string) => compact(word).replace(/^[وف]/, '');
  const a = strip(left);
  const b = strip(right);
  return a.length >= 2 && a === b;
}

/** Same-surah next: the opening may sit after a previous-ayah tail, and live
 * CTC may emit الله for إله. Jump/handoff still uses heardDistinct. */
function heardSequentialNext(recognized: string[], verse: QuranVerse, skip: number): boolean {
  const { words, basmala } = verseAlignWords(verse);
  if (!recognized.length || !words.length) return false;
  const from = leadingBasmalaWords(recognized);
  let start = -1;
  for (let index = from; index < recognized.length; index++) {
    if (sequentialOpeningMatch(recognized[index]!, words[0]!)) {
      start = index;
      break;
    }
  }
  if (start < 0) return false;
  const matched = [0];
  let expected = 1;
  for (let spoken = start + 1; spoken < recognized.length && expected < words.length; spoken++) {
    if (wordsMatch(recognized[spoken]!, words[expected]!) || softTokenMatch(recognized[spoken]!, words[expected]!)) {
      matched.push(expected);
      expected += 1;
    }
  }
  const bodySkip = Math.max(0, skip - basmala);
  if (bodySkip > 0 && words.length > bodySkip) return matched.includes(bodySkip);
  const exactOpening = openingWordMatch(recognized[start]!, words[0]!);
  if (!exactOpening && words.length > 1) return matched.length >= 2;
  return matched.length >= 1;
}

/** Tokens after a suffix of the completed last ayah. Interior coincidences
 * (هو in 108:3 and 112:1) must not strip the new surah’s opening. */
function remainingAfterTail(recognized: string[], verseWords: string[]): string[] {
  if (!recognized.length || !verseWords.length) return recognized;
  const maxSuffix = Math.min(verseWords.length, recognized.length);
  for (let length = maxSuffix; length >= 1; length--) {
    const suffix = verseWords.slice(-length);
    for (let start = 0; start + length <= recognized.length; start++) {
      const matches = suffix.every((word, index) => {
        const spoken = recognized[start + index]!;
        return wordsMatch(spoken, word) || relatedStem(spoken, word);
      });
      if (matches) return recognized.slice(start + length);
    }
  }
  return recognized;
}

/** Unexplained last-ayah leftover. Prefer tokens after a last-ayah suffix so
 * in-progress 103:3 recitation is not treated as a new surah. If the suffix
 * sits at the end (Mac CTC) or an interior 103:3 word remains, fall back to
 * distinctive unexplained tokens in the whole window. */
function leftoverAfterLastAyah(recognized: string[], verseWords: string[]): string[] {
  const fromTail = leftoverNewTokens(remainingAfterTail(recognized, verseWords), verseWords);
  if (leftoverIsNewRecitation(fromTail) && compact(fromTail.join(' ')).length >= 6) return fromTail;
  const fromWindow = leftoverNewTokens(recognized, verseWords);
  if (leftoverIsNewRecitation(fromWindow) && compact(fromWindow.join(' ')).length >= 6) return fromWindow;
  return fromTail;
}

/** Tokens the current last-ayah body does not explain. Interior coincidences
 * such as هو in 108:3 are dropped without stripping الله احد. */
function leftoverNewTokens(recognized: string[], verseWords: string[]): string[] {
  return recognized.filter((token) => (
    !verseWords.some((word) => wordsMatch(token, word) || relatedStem(token, word))
  ));
}

function leftoverIsolatedAlifLamMeem(leftover: string[]): boolean {
  if (heardMuqattaatSpelling(leftover, 'الم')) return true;
  const body = leftover.filter((word) => !isSharedBasmalaToken(word) && !isBasmalaTailToken(word));
  return body.length === 1 && compact(body[0]!) === 'الم';
}

function leftoverIsNewRecitation(leftover: string[]): boolean {
  if (leftover.length <= leadingBasmalaWords(leftover)) return false;
  if (leftoverIsolatedAlifLamMeem(leftover)) return true;
  return leftover.some((token) => token.length >= 4);
}

function leftoverLongEnough(leftover: string[]): boolean {
  if (leftoverIsolatedAlifLamMeem(leftover)) return true;
  return compact(leftover.join(' ')).length >= 6;
}

/** Align to the verse body. Ayah-1 phoneme lists often prepend the opening
 * Basmala, but live/fixture audio usually starts at the ayah body (EveryAyah).
 * Only strip when the stored phonemes actually open with Basmala — unit fixtures
 * and some spans omit it. */
function verseAlignWords(verse: QuranVerse): { words: string[]; basmala: number } {
  const declared = openingBasmalaWordCount(verse);
  if (declared <= 0 || verse.phoneme_words[0] !== 'بسم') {
    return { words: verse.phoneme_words, basmala: 0 };
  }
  if (verse.phoneme_words.length <= declared) {
    return { words: verse.phoneme_words, basmala: 0 };
  }
  return { words: verse.phoneme_words.slice(declared), basmala: declared };
}

function displayBodyWords(verse: QuranVerse): string[] {
  const { ayah } = splitOpeningBasmala(verse.text_uthmani, verse);
  const words = ayah.split(/\s+/).filter((word) => /[\u0621-\u064Aa-zA-Z]/.test(word));
  const { basmala } = verseAlignWords(verse);
  return basmala > 0 && words.length > basmala ? words.slice(basmala) : words;
}

function heardPrefix(recognized: string[], verse: QuranVerse): string[] {
  const { words } = verseAlignWords(verse);
  const matched = contiguousAlignFromOpening(recognized, words);
  if (!matched.length) return [];
  const display = displayBodyWords(verse);
  return display.slice(0, Math.min(matched.length, display.length));
}

function contiguousAlignToVerse(recognized: string[], verse: QuranVerse): number[] {
  const { words, basmala } = verseAlignWords(verse);
  return contiguousAlignFromOpening(recognized, words).map((index) => index + basmala);
}

function heardDistinct(recognized: string[], verse: QuranVerse, skip: number): boolean {
  const { words, basmala } = verseAlignWords(verse);
  if (words.length === 1 && shortAyah1Body(words[0]!) && heardIsolatedBodyToken(recognized, words[0]!) && openingIsAtStart(recognized, words)) {
    return true;
  }
  const matched = contiguousAlignFromOpening(recognized, words);
  if (!matched.length || matched[0] !== 0) return false;
  const bodySkip = Math.max(0, skip - basmala);
  if (bodySkip > 0 && words.length > bodySkip) return matched.includes(bodySkip);
  if (!openingIsAtStart(recognized, words) && matched.length < Math.min(2, words.length)) return false;
  return true;
}

function skipUnusableLock(verse: QuranVerse): boolean {
  return isFatihaBasmala(verse) || isFatihaBasmalaTail(verse) || isBasmalaEchoBody(verse);
}

/** Ayah-1 whose only body word is a Basmala token (55:1 الرحمن). Shared
 * Basmala audio must not name that surah; a distinctive one-word body
 * such as والعصر is still lockable. */
function isBasmalaEchoBody(verse: QuranVerse): boolean {
  const { words, basmala } = verseAlignWords(verse);
  if (basmala <= 0 || words.length !== 1) return false;
  const token = words[0]!;
  const formula = OPENING_BASMALA_TOKENS;
  if (formula.has(token)) return true;
  return [...formula].some((word) => relatedStem(word, token));
}

function engineFromSession(session: TilawaSession): TranscribeFn {
  const transcribe = session.transcribeRaw as (audio: Float32Array, locate?: boolean) => Promise<TranscribeResult>;
  return (audio, locate) => transcribe(audio, locate);
}

/** Live acquire / follow / reacquire. Uses Tilawa only as transcribe + Quran index. */
export class RecitationFollower {
  phase: FollowerPhase = 'acquiring';
  /** Latest Tilawa transcript tokens. Liturgy scores these; lock rules stay in this class. */
  lastHeardTokens: string[] = [];
  private window: Float32Array<ArrayBufferLike> = new Float32Array(0);
  private fresh = 0;
  private mismatches = 0;
  private lock: QuranVerse | null = null;
  private priorSurah: number | null = null;
  private wordIndex = -1;
  private queueTimings: FeedTimings = {};
  private bodyPrefixCounts: Map<string, number> | null = null;
  private trimmedForShortLast = false;
  /** Exact muqattaʿāt tokens heard during this acquire (الم / letter names).
   * A later 2:2-dominated CTC decode must not erase them. */
  private heardMuqattaatTokens: string[] = [];
  private readonly transcribe: TranscribeFn;

  constructor(private readonly db: QuranDB, transcribe: TranscribeFn | TilawaSession) {
    this.transcribe = typeof transcribe === 'function' ? transcribe : engineFromSession(transcribe);
  }

  reset(): void {
    this.phase = 'acquiring';
    this.window = new Float32Array(0);
    this.fresh = 0;
    this.mismatches = 0;
    this.lock = null;
    this.priorSurah = null;
    this.wordIndex = -1;
    this.queueTimings = {};
    this.trimmedForShortLast = false;
    this.heardMuqattaatTokens = [];
    this.lastHeardTokens = [];
  }

  get lockedRef(): VerseRef | null {
    return this.lock ? { surah: this.lock.surah, ayah: this.lock.ayah } : null;
  }

  get lockedAyahComplete(): boolean {
    return this.lock !== null && this.ayahComplete(this.lock);
  }

  private noteHeardTokens(text: string): void {
    this.lastHeardTokens = text.trim().split(/\s+/).filter(Boolean);
  }

  async feed(samples: Float32Array, timings: FeedTimings = {}): Promise<RecognitionMessage[]> {
    if (!samples.length) return [];
    this.queueTimings = timings;
    // Trim leftover penultimate audio before appending so a large first
    // last-ayah batch is kept, not collapsed to LAST_AYAH_SEED_SEC after concat.
    if (
      this.phase === 'following'
      && this.lock
      && this.ayahComplete(this.lock)
      && this.shortLastAyahFollow(this.lock)
      && !this.trimmedForShortLast
    ) {
      this.window = keepLast(this.window, LAST_AYAH_SEED_SEC);
      this.trimmedForShortLast = true;
    }
    this.window = concatAudio(this.window, samples);
    this.fresh += samples.length;
    const maxSec = this.followMaxSec();
    if (this.window.length > samplesFor(maxSec)) this.window = keepLast(this.window, maxSec);
    if (this.phase === 'following') return this.follow();
    return this.acquire();
  }

  private noteCycle(result: TranscribeResult, locate: boolean): void {
    recordRecognitionCycle({
      windowSec: Math.round((this.window.length / SAMPLE_RATE) * 100) / 100,
      onnxMs: result.timings?.onnxMs ?? 0,
      decodeMs: result.timings?.decodeMs ?? 0,
      locateMs: locate ? (result.timings?.locateMs ?? 0) : 0,
      queueWaitMs: this.queueTimings.queueWaitMs ?? 0,
      stallMs: this.queueTimings.stallMs ?? 0,
      phase: this.phase,
    });
  }

  private rawMatch(result: TranscribeResult, allowSearch: boolean): QuranChampionMatch | null {
    if (result.championMatch) return result.championMatch;
    if (result.locateAttempted || !allowSearch) return null;
    return this.db.bestJoint03Match(result.text.trim());
  }

  private matchFromTranscript(result: TranscribeResult, allowSearch: boolean): QuranChampionMatch | null {
    const raw = this.rawMatch(result, allowSearch);
    return raw ? rerankChampion(raw, this.priorSurah) : null;
  }

  private async acquire(): Promise<RecognitionMessage[]> {
    if (this.window.length < samplesFor(ACQUIRE_MIN_SEC) || this.fresh < samplesFor(ACQUIRE_MIN_SEC)) return [];
    this.fresh = 0;
    const result = await this.transcribe(this.window, true);
    this.noteCycle(result, true);
    this.noteHeardTokens(result.text);
    const recovered = await this.recoverOpeningMuqattaat(result);
    if (recovered) return recovered;
    return this.lockFromTranscript(result, false);
  }

  /** When a long first-lock window’s CTC names ayah 2+, the older half may
   * still contain الم that the mixed decode dropped. Look back before
   * committing 2:2. Reacquire stays 4 s and does not look back. */
  private async recoverOpeningMuqattaat(result: TranscribeResult): Promise<RecognitionMessage[] | undefined> {
    if (this.phase !== 'acquiring') return undefined;
    if (this.window.length <= samplesFor(ACQUIRE_MAX_SEC) + samplesFor(0.5)) return undefined;
    const raw = result.championMatch;
    if (!raw || raw.ayah <= 1) return undefined;
    const current = result.text.trim().split(/\s+/).filter(Boolean);
    if (this.heardExactMuqattaat(this.acquireEvidence(current))) return undefined;
    const olderSec = (this.window.length / SAMPLE_RATE) - LOOKBACK_DROP_SEC;
    if (olderSec < ACQUIRE_MIN_SEC) return undefined;
    const lookback = await this.transcribe(keepFirst(this.window, olderSec), true);
    const recovered = this.lockFromTranscript(lookback, false);
    const match = recovered.find((message) => message.type === 'verse_match');
    if (!match || match.type !== 'verse_match' || match.ayah !== 1) return undefined;
    const verse = this.db.getVerse(match.surah, match.ayah);
    if (!verse || !isExactMuqattaatAyah1(verse)) return undefined;
    return recovered;
  }

  private lockFromTranscript(
    result: TranscribeResult,
    allowSearch: boolean,
    ignore?: VerseRef,
  ): RecognitionMessage[] {
    const text = result.text.trim();
    const recognized = text.split(/\s+/).filter(Boolean);
    const rawEarly = recognized.length ? this.rawMatch(result, allowSearch) : null;
    if (process.env.ZIKRIST_TRACE === '1') {
      console.log(JSON.stringify({
        kind: 'acquire_asr',
        phase: this.phase,
        windowSec: Math.round((this.window.length / SAMPLE_RATE) * 100) / 100,
        text,
        champion: rawEarly ? `${rawEarly.surah}:${rawEarly.ayah}@${Math.round(rawEarly.score * 100) / 100}` : null,
      }));
    }
    if (!recognized.length) return [];
    if (!this.lock) this.noteHeardMuqattaat(recognized);
    // After a lock, do not stitch remembered الم onto a later garbled hop
    // (الم الي then الل) and treat that as isolated 2:1.
    const evidence = this.priorSurah != null ? recognized : this.acquireEvidence(recognized);
    const raw = rawEarly;
    if (!raw) {
      const isolated = this.lockExactMuqattaatAyah1(text, evidence, ignore);
      return isolated ?? [];
    }
    const ranked = rerankChampion(raw, this.priorSurah);
    const acoustic = acousticChampion(raw);
    const attempts = [ranked];
    if (ranked.surah !== acoustic.surah || ranked.ayah !== acoustic.ayah) attempts.push(acoustic);
    let candidates: RecognitionMessage[] | undefined;
    if (this.locateTextEnough(text, evidence)) {
      for (const match of attempts) {
        const located = this.locateAyah(match, text, evidence);
        const verse = located ? this.preferCanonicalDuplicate(located, text) : undefined;
        if (!verse || this.sameRef(verse, ignore) || this.ambiguousSurah(match, verse, text, evidence)) {
          candidates ??= [{
            type: 'verse_candidate',
            candidates: this.candidateList(match),
            stable: false,
            final_flush: false,
          }];
          continue;
        }
        if (!this.canLock(match, verse, text, evidence)) continue;
        const chosen = this.preferCanonicalDuplicate(verse, text);
        if (this.sameRef(chosen, ignore)) continue;
        if (!this.allowsHandoffVerse(chosen, evidence)) continue;
        return this.commit(chosen, match.score, this.alignForCommit(evidence, chosen));
      }
      const alternative = this.alternativeHeardVerse(evidence, text, ranked);
      if (alternative && !this.sameRef(alternative, ignore)) {
        const chosen = this.preferCanonicalDuplicate(alternative, text);
        if (!this.sameRef(chosen, ignore) && this.allowsHandoffVerse(chosen, evidence)) {
          return this.commit(chosen, this.locationScore(text, chosen), this.alignForCommit(evidence, chosen));
        }
      }
    }
    const isolated = this.lockExactMuqattaatAyah1(text, evidence, ignore);
    if (isolated) return isolated;
    return this.unconfirmedMessages(recognized, ranked, candidates);
  }

  private lockExactMuqattaatAyah1(
    text: string,
    recognized: string[],
    ignore?: VerseRef,
  ): RecognitionMessage[] | undefined {
    let best: QuranVerse | undefined;
    let bestScore = -1;
    for (const verse of this.db.verses) {
      if (!isExactMuqattaatAyah1(verse) || this.sameRef(verse, ignore)) continue;
      const token = verseAlignWords(verse).words[0]!;
      if (!heardIsolatedBodyToken(recognized, token)) continue;
      if (!this.hasVerseEvidence(text, verse, recognized)) continue;
      const score = this.locationScore(token, verse);
      if (!best || score > bestScore + 0.03) {
        best = verse;
        bestScore = score;
      }
    }
    if (!best) return undefined;
    const chosen = this.preferCanonicalDuplicate(best, text);
    const match: QuranChampionMatch = {
      surah: chosen.surah,
      ayah: chosen.ayah,
      text: chosen.text_uthmani,
      phonemes_joined: chosen.phonemes_joined,
      score: Math.max(LOCK_CLEAR_SCORE, bestScore),
      raw_score: Math.max(LOCK_CLEAR_SCORE, bestScore),
      bonus: 0,
    };
    if (!this.canLock(match, chosen, text, recognized)) return undefined;
    if (!this.allowsHandoffVerse(chosen, recognized)) return undefined;
    return this.commit(chosen, match.score, this.alignForCommit(recognized, chosen));
  }

  /** Isolated الم is enough to locate; a 5-letter garbled Kawthar opening is not. */
  private locateTextEnough(text: string, recognized: string[]): boolean {
    if (compact(text).length >= 6) return true;
    for (const verse of this.db.verses) {
      if (verse.ayah !== 1) continue;
      const { words } = verseAlignWords(verse);
      if (words.length !== 1) continue;
      const token = compact(words[0]!);
      if (!shortAyah1Body(token) || skipUnusableLock(verse) || isSharedBasmalaToken(token)) continue;
      if (heardIsolatedBodyToken(recognized, token)) return true;
    }
    return false;
  }

  private followMaxSec(): number {
    if (this.phase === 'acquiring') return ACQUIRE_AFTER_BASMALA_SEC;
    if (this.phase !== 'following' || !this.lock) return ACQUIRE_MAX_SEC;
    return this.shortLastAyahFollow(this.lock) ? FOLLOW_LAST_AYAH_ACCUMULATE_SEC : FOLLOW_WINDOW_SEC;
  }

  private noteHeardMuqattaat(recognized: string[]): void {
    if (this.lock) return;
    for (const verse of this.db.verses) {
      if (!isExactMuqattaatAyah1(verse)) continue;
      const token = verseAlignWords(verse).words[0]!;
      if (!heardIsolatedBodyToken(recognized, token)) continue;
      const spelling = heardMuqattaatSpelling(recognized, compact(token));
      for (const word of recognized) {
        if (isBasmalaTailToken(word)) continue;
        if (!spelling && !heardIsolatedBodyToken([word], token)) continue;
        const heard = compact(word);
        if (heard && !this.heardMuqattaatTokens.includes(heard)) this.heardMuqattaatTokens.push(heard);
      }
    }
    if (this.heardMuqattaatTokens.length > 8) {
      this.heardMuqattaatTokens = this.heardMuqattaatTokens.slice(-8);
    }
  }

  private acquireEvidence(recognized: string[]): string[] {
    if (this.lock || !this.heardMuqattaatTokens.length) return recognized;
    const extra = this.heardMuqattaatTokens.filter((token) => !recognized.includes(token));
    return extra.length ? [...recognized, ...extra] : recognized;
  }

  private heardExactMuqattaat(recognized: string[]): boolean {
    for (const verse of this.db.verses) {
      if (!isExactMuqattaatAyah1(verse)) continue;
      if (heardIsolatedBodyToken(recognized, verseAlignWords(verse).words[0]!)) return true;
    }
    return false;
  }

  /** Next ayah is the last of this surah and short enough that a 1.2 s
   * follow slice often decodes as garbage (stretched 114:6, 108:3). */
  private shortLastAyahFollow(current: QuranVerse): boolean {
    const next = this.db.getNextVerse(current.surah, current.ayah);
    if (!next || next.surah !== current.surah) return false;
    if (this.db.getNextVerse(next.surah, next.ayah)) return false;
    return verseAlignWords(next).words.length <= SHORT_LAST_AYAH_WORDS;
  }

  /** 0 = last ayah of this surah. Caps at 3. */
  private ayahsRemainingInSurah(current: QuranVerse): number {
    let count = 0;
    let surah = current.surah;
    let ayah = current.ayah;
    while (count < 3) {
      const next = this.db.getNextVerse(surah, ayah);
      if (!next || next.surah !== current.surah) return count;
      count += 1;
      surah = next.surah;
      ayah = next.ayah;
    }
    return count;
  }

  /** After a lock, mysterious-letter ayah-1 needs isolated letters or letter-name
   * spelling on this hop. Cold acquire still uses canLock. `الم الي` / `الل`
   * must not default to 2:1. */
  private allowsHandoffVerse(verse: QuranVerse, recognized: string[]): boolean {
    if (this.priorSurah == null) return true;
    const token = this.handoffMuqattaatToken(verse);
    if (!token) return true;
    const body = recognized.filter((word) => !OPENING_BASMALA_TOKENS.has(compact(word)));
    if (body.length === 1 && compact(body[0]!) === token) {
      // Leftover follow may lock recited الم. Reacquire CTC often emits الم
      // for other openings (Naml) — do not auto-display mushaf-next from that.
      return this.phase !== 'reacquiring';
    }
    if (!heardMuqattaatSpelling(recognized, token)) return false;
    return body.length > 0 && body.every((word) => Boolean(namedMuqattaatLetter(word)));
  }

  private handoffMuqattaatToken(verse: QuranVerse): string | undefined {
    if (isExactMuqattaatAyah1(verse)) return compact(verseAlignWords(verse).words[0] ?? '');
    if (verse.surah === 2 && verse.ayah === 1) return 'الم';
    return undefined;
  }

  private ayahComplete(verse: QuranVerse): boolean {
    if (!verse.phoneme_words.length || this.wordIndex < 0) return false;
    return this.wordIndex >= verse.phoneme_words.length - 1
      || (this.wordIndex + 1) / verse.phoneme_words.length >= TRACKING_COMPLETION_COVERAGE;
  }

  private async follow(): Promise<RecognitionMessage[]> {
    if (!this.lock || this.fresh < samplesFor(FOLLOW_TRIGGER_SEC)) return [];
    const current = this.lock;
    const next = this.db.getNextVerse(current.surah, current.ayah);
    this.fresh = 0;
    // Follow transcribes only. Score remainder + mushaf-next; do not locate the mushaf first.
    const result = await this.transcribe(this.window, false);
    this.noteCycle(result, false);
    const text = result.text.trim();
    const recognized = text.split(/\s+/).filter(Boolean);
    this.noteHeardTokens(text);
    const previous = this.previousVerse(current);
    const currentBody = verseAlignWords(current).words;
    const nextBody = next && next.surah === current.surah ? verseAlignWords(next).words : [];
    const bodyCursor = this.wordIndex < 0 ? -1 : this.wordIndex - verseAlignWords(current).basmala;
    const tape = scoreExpectedTape(
      recognized,
      currentRemainder(currentBody, bodyCursor),
      nextBody,
      currentBody,
    );
    if (process.env.ZIKRIST_TRACE === '1') {
      console.log(JSON.stringify({
        kind: 'follow_asr',
        lock: `${current.surah}:${current.ayah}`,
        text,
        nextHeard: tape.nextHeard,
        holdsLock: tape.holdsLock,
        remainderHits: tape.remainderHits,
        nextHits: tape.nextHits,
        leftover: tape.leftover,
        unexplained: tape.unexplainedDistinctive,
        mismatches: this.mismatches,
      }));
    }
    const currentScore = tape.unexplainedDistinctive.length > 0 ? 0 : explainScore(text, current);
    const nextScore = tape.nextHeard ? Math.max(tape.nextCoverage, tape.phonemeScore) : explainScore(text, next);
    const previousScore = previous && !isFatihaBasmala(previous) && !this.onlySharedOpening(recognized, previous)
      ? explainScore(text, previous)
      : 0;
    const heardNext = Boolean(
      next
      && next.surah === current.surah
      && (tape.nextHeard || heardDistinct(recognized, next, this.distinctSkip(next, current))),
    );
    const leftover = leftoverAfterLastAyah(recognized, currentBody);
    const leftoverUnexplained = leftoverIsNewRecitation(leftover) && leftoverLongEnough(leftover);
    const atLastAyah = Boolean(!next || next.surah !== current.surah);
    const earlyLeftover = leftoverNewTokens(remainingAfterCurrent(recognized, currentBody), currentBody);
    const handoffQuery = atLastAyah ? leftover : earlyLeftover;
    const handoffUnexplained = leftoverIsNewRecitation(handoffQuery) && leftoverLongEnough(handoffQuery);
    const atSurahBoundary = Boolean(atLastAyah && leftoverUnexplained);
    const matchedBody = alignWords(recognized, currentBody);
    const matched = matchedBody.map((index) => index + verseAlignWords(current).basmala);
    const wordIndex = matched.length ? matched[matched.length - 1]! : this.wordIndex;
    const completeThisHop = current.phoneme_words.length > 0 && (
      wordIndex >= current.phoneme_words.length - 1
      || (wordIndex + 1) / current.phoneme_words.length >= TRACKING_COMPLETION_COVERAGE
    );
    const advanced = wordIndex > this.wordIndex;
    const sharedPrefixOnly = this.onlySharedOpening(recognized, current);
    const currentOnlyHeard = recognized.some((token) => (
      tokenExplainedBy(token, currentBody)
      && (!nextBody.length || !tokenExplainedBy(token, nextBody))
    ));
    const parkedOnSharedTail = this.ayahComplete(current) && !currentOnlyHeard;
    const neighborhood = Math.max(
      sharedPrefixOnly || parkedOnSharedTail ? 0 : currentScore,
      previousScore,
      heardNext ? nextScore : 0,
    );
    if (advanced) this.wordIndex = wordIndex;
    if (advanced && !sharedPrefixOnly) this.mismatches = 0;
    const complete = completeThisHop;

    const messages: RecognitionMessage[] = [];
    if (this.wordIndex >= 0) {
      messages.push({
        type: 'word_progress',
        surah: current.surah,
        ayah: current.ayah,
        word_index: this.wordIndex + 1,
        total_words: current.phoneme_words.length,
        matched_indices: matched.length ? matched : [this.wordIndex],
      });
    }

    const tapeAdvance = tape.nextHeard && tape.unexplainedDistinctive.length === 0;
    if (next && next.surah === current.surah && (tapeAdvance || this.shouldAdvance(recognized, next, current))) {
      return [...messages, ...this.commit(next, Math.max(nextScore, currentScore), this.alignForCommit(recognized, next))];
    }

    // Shared قل leftover after 112:1 is a new recitation (Nas / Kafirun), not
    // only a last-ayah handoff. Do not wait until second-last to scan the pool.
    if (handoffUnexplained && !this.shortLastAyahFollow(current)) {
      const sameSurahNextOpen = Boolean(next && next.surah === current.surah);
      const leftoverLooksLikeNext = Boolean(
        sameSurahNextOpen
        && next
        && (
          heardDistinct(handoffQuery, next, this.distinctSkip(next, current))
          || this.locationScore(handoffQuery.join(' '), next) >= LOCK_SCORE
          || distinctiveTokens(handoffQuery, verseAlignWords(next).words).length >= 1
        ),
      );
      if (!leftoverLooksLikeNext) {
        const handed = this.commitUnexplainedHandoff(
          handoffQuery,
          recognized,
          text,
          current,
          next,
          this.ayahsRemainingInSurah(current),
        );
        if (handed) return [...messages, ...handed];
      }
    }

    const needSearch = (tape.unexplainedDistinctive.length > 0 && this.mismatches > 0) || atSurahBoundary;
    const located = needSearch ? this.matchFromTranscript(result, true) : null;
    const locatedVerse = located ? this.locateAyah(located, text, recognized) : undefined;
    const locatedScore = locatedVerse ? this.locationScore(text, locatedVerse) : 0;
    const stillInSurah = Boolean(next && next.surah === current.surah);
    const jump = Boolean(
      located
      && locatedVerse
      && !this.ambiguousSurah(located, locatedVerse, text, recognized)
      && !this.sameRef(locatedVerse, current)
      && !this.sameRef(locatedVerse, next)
      && neighborhood < NEIGHBORHOOD_KEEP
      && heardDistinct(recognized, locatedVerse, this.distinctSkip(locatedVerse))
      && locatedScore >= LOCK_CLEAR_SCORE
      && locatedScore >= neighborhood + SURAH_MARGIN
      // Mid-surah: refuse weak cross-surah jumps (was leaping to 7:1 on garbage windows).
      && (!stillInSurah || locatedVerse.surah === current.surah || locatedScore >= 0.92)
      // While waiting for a short last ayah, do not jump to another surah at all.
      && (!this.shortLastAyahFollow(current) || locatedVerse.surah === current.surah)
      // Mysterious-letter ayahs need a whole-word token, not المصدر/المدرس noise.
      && this.canLock(located, locatedVerse, text, recognized)
      && this.allowsHandoffVerse(locatedVerse, recognized)
    );

    if (jump && located && locatedVerse) {
      return [...messages, ...this.commit(locatedVerse, located.score, contiguousAlignToVerse(recognized, locatedVerse))];
    }

    if (complete && !next) {
      const pooled = this.lockFromNextSurahPool(text, recognized, current.surah);
      if (pooled) {
        return [...messages, ...this.commit(pooled, this.locationScore(text, pooled), contiguousAlignToVerse(recognized, pooled))];
      }
      this.startReacquire();
      return messages;
    }

    if (atLastAyah && leftoverUnexplained) {
      const leftoverResult: TranscribeResult = { text: leftover.join(' '), rawPhonemes: leftover.join(' ') };
      const acquired = this.lockFromTranscript(leftoverResult, true, current).filter((message) => {
        if (message.type !== 'verse_match') return true;
        if (message.surah === current.surah) return false;
        const verse = this.db.getVerse(message.surah, message.ayah);
        return Boolean(verse && this.allowsHandoffVerse(verse, leftover));
      });
      if (acquired.some((message) => message.type === 'verse_match')) {
        return [...messages, ...acquired];
      }
    }

    const fillingLastAyah = this.shortLastAyahFollow(current)
      && this.window.length < samplesFor(FOLLOW_LAST_AYAH_ACCUMULATE_SEC);
    if ((!advanced || sharedPrefixOnly) && neighborhood < NEIGHBORHOOD_KEEP) {
      this.mismatches++;
      const reacquireAfter = stillInSurah ? MISMATCH_LIMIT + 3 : MISMATCH_LIMIT;
      // Keep accumulating a short last ayah; still locate so a real jump can recover.
      if (!fillingLastAyah && this.mismatches >= reacquireAfter) {
        this.startReacquire(false);
        const acquired = this.lockFromTranscript(result, true);
        const filtered = acquired.filter((message) => {
          if (message.type !== 'verse_match') return true;
          if (!stillInSurah) return true;
          return message.surah === current.surah || message.confidence >= 0.92;
        });
        if (!filtered.some((message) => message.type === 'verse_match')) this.fresh = this.window.length;
        return [...messages, ...filtered];
      }
    } else if ((advanced && !sharedPrefixOnly) || neighborhood >= NEIGHBORHOOD_KEEP) {
      this.mismatches = 0;
    }
    return messages;
  }

  /** Unique leftover opening of mushaf-next. Overlapping current-ayah audio in
   * the follow window must not veto that evidence with a mixed-window score. */
  private shouldAdvance(recognized: string[], next: QuranVerse, current: QuranVerse): boolean {
    if (next.surah !== current.surah) return false;
    const currentBody = verseAlignWords(current).words;
    const leftover = sequentialLeftover(recognized, currentBody);
    const query = leftover.length ? leftover : recognized;
    const { words, basmala } = verseAlignWords(next);
    // Shared openings (رب/rabbi, الله/allah, الحمد/alhamdu, قل/qul) alone must not
    // advance — Fatiha leftover after Ibrahim 14:39 must not become 14:40.
    const overlap = uniqueWordSkip(next, current);
    const opening = words[0] ?? '';
    const needUnique = words.length > 1 && isAmbiguousAdvanceOpening(opening) ? basmala + 1 : overlap;
    const skip = Math.max(overlap, needUnique);
    if (leftover.length && (heardDistinct(query, next, skip) || heardSequentialNext(query, next, skip))) {
      return true;
    }
    const spoken = query.join(' ');
    const unused = (token: string) => !currentBody.some((word) => wordsMatch(word, token) || relatedStem(word, token));
    // Distinctive unused tokens of the expected next ayah may arrive without the
    // opening: a garbled فليعبدوا, a tail الابتر, or النفثت after shared ومن.
    // Do not drop a unique opening, and do not re-score a tail against the opening.
    // unused() stays stem/word-strict so وانحر cannot consume الابتر via 0.72 fuzzy.
    const openingShared = isAmbiguousAdvanceOpening(opening)
      || this.uniqueOpeningSkip(next) > basmala;
    const from = openingShared && words.length > 1
      ? Math.max(1, skip > basmala ? skip - basmala : 1)
      : 0;
    const distinctive = words
      .slice(from)
      .filter((token) => token.length >= 3 && unused(token) && !isAmbiguousAdvanceOpening(token));
    const hits = distinctive.filter((token) => query.some((word) => {
      // 3-letter leftover (يلد) stays stem/exact so alalamin cannot become lam.
      if (token.length < 4) {
        return word === token || wordsMatch(word, token) || relatedStem(word, token);
      }
      return softTokenMatch(word, token);
    }));
    // Accumulated last-ayah audio may decode the short ayah as a whole even if
    // the leftover opening was missed.
    if (this.shortLastAyahFollow(current) && this.locationScore(spoken, next) >= LOCK_CLEAR_SCORE) {
      return true;
    }
    if (!hits.length) return false;
    // Ambiguous openings still need a strong location score so leftover رب≠14:40.
    if (isAmbiguousAdvanceOpening(opening)) {
      return this.locationScore(spoken, next) >= LOCK_CLEAR_SCORE && hits.length >= 1
        && hits.some((token) => !isAmbiguousAdvanceOpening(token) && token.length >= 5);
    }
    // Live 112:3 يلد is three letters; length-4 was blocking Arabic leftover.
    return hits.some((token) => token.length >= 3);
  }

  /** Unique leftover of another short surah, or a later ayah in this surah
   * after the expected next was missed. Mid-surah only scans ayah-1 openings so
   * Fatiha 1:5 cannot be stolen by a famous-body lookalike. Shared قل is
   * stripped from leftover, so last-ayah hops may also try the full window. */
  private commitUnexplainedHandoff(
    leftover: string[],
    recognized: string[],
    text: string,
    current: QuranVerse,
    next: QuranVerse | undefined,
    remainingInSurah: number,
  ): RecognitionMessage[] | null {
    const stillInSurah = Boolean(next && next.surah === current.surah);
    const midSurah = stillInSurah && remainingInSurah > 1;
    const queries = leftover.length && leftover.join(' ') !== recognized.join(' ')
      ? [leftover, recognized]
      : [leftover.length ? leftover : recognized];
    for (const query of queries) {
      const queryText = query.join(' ');
      const pooled = this.lockFromNextSurahPool(queryText, query, current.surah, {
        openingsOnly: midSurah,
      });
      if (!pooled || this.onlySharedOpening(query, pooled) || !this.hasOpeningEvidence(query, queryText, pooled)) {
        continue;
      }
      const distinctiveQuery = query.filter((token) => compact(token).length >= 4 && !isFormulaBodyToken(token));
      // Formula leftover قل/الله after Kawthar must not name a long famous-body
      // ayah that repeats الله (4:113). Try the next query (full window with هو).
      if (
        !distinctiveQuery.length
        && pooled.ayah > 1
        && verseAlignWords(pooled).words.length > SHORT_LAST_AYAH_WORDS
      ) continue;
      // Fatiha 1:4 leftover must not become 2:1; last-ayah leftover الم still may.
      if (midSurah && this.handoffMuqattaatToken(pooled)) continue;
      if (midSurah && leftover.length && query !== leftover) {
        const body = verseAlignWords(pooled).words;
        const uniqueHits = distinctiveTokens(leftover, body).filter((token) => !isAmbiguousAdvanceOpening(token));
        if (!uniqueHits.length && !heardDistinct(leftover, pooled, this.distinctSkip(pooled, current))) continue;
      }
      return this.commit(pooled, this.locationScore(queryText, pooled), this.alignForCommit(query, pooled));
    }
    const afterNext = next && next.surah === current.surah ? next.ayah : current.ayah;
    const nextBody = next && next.surah === current.surah ? verseAlignWords(next).words : [];
    for (const verse of this.scanAroundAyah(current.surah, current.ayah, leftover.length ? leftover : recognized, leftover.length ? leftover.join(' ') : text)) {
      if (verse.surah !== current.surah || verse.ayah <= afterNext) continue;
      const body = verseAlignWords(verse).words;
      if (nextBody.length && distinctiveTokens(leftover, nextBody).length) continue;
      const hits = distinctiveTokens(leftover, body);
      if (hits.length < 2 && !heardDistinct(leftover, verse, this.distinctSkip(verse, current))) continue;
      const score = this.locationScore(leftover.join(' ') || text, verse);
      const match: QuranChampionMatch = {
        surah: verse.surah,
        ayah: verse.ayah,
        text: verse.text_uthmani,
        phonemes_joined: verse.phonemes_joined,
        score,
        raw_score: score,
        bonus: 0,
      };
      const query = leftover.length ? leftover : recognized;
      const queryText = leftover.length ? leftover.join(' ') : text;
      if (score < LOCK_CLEAR_SCORE || !this.canLock(match, verse, queryText, query)) continue;
      return this.commit(verse, score, this.alignForCommit(query, verse));
    }
    return null;
  }

  /** Prefer contiguous opening align; if the opening was ASR-garbled, map heard
   * unique body tokens so ContinuationGate can confirm ayah-1 (Basmala-in-DB). */
  private alignForCommit(recognized: string[], verse: QuranVerse): number[] {
    const aligned = contiguousAlignToVerse(recognized, verse);
    if (aligned.length) return aligned;
    const { words, basmala } = verseAlignWords(verse);
    if (words.length === 1 && shortAyah1Body(words[0]!) && heardIsolatedBodyToken(recognized, words[0]!)) {
      return [basmala];
    }
    const hits: number[] = [];
    for (let index = 0; index < words.length; index++) {
      if (recognized.some((word) => wordsMatch(word, words[index]!))) {
        hits.push(index + basmala);
      }
    }
    const skip = openingBasmalaWordCount(verse);
    const uniqueHits = hits.filter((index) => index > skip);
    return uniqueHits.length ? uniqueHits : hits;
  }

  private commit(verse: QuranVerse, score: number, matched: number[]): RecognitionMessage[] {
    const advancing = this.lock !== null;
    this.lock = verse;
    this.priorSurah = verse.surah;
    this.phase = 'following';
    this.mismatches = 0;
    this.wordIndex = matched.length ? matched[matched.length - 1]! : -1;
    this.trimmedForShortLast = false;
    this.heardMuqattaatTokens = [];
    this.window = keepLast(this.window, advancing ? KEEP_AFTER_COMMIT_SEC : KEEP_AFTER_LOCK_SEC);
    this.fresh = 0;
    const prefix = displayBodyWords(verse).slice(0, matched.length);
    const messages: RecognitionMessage[] = [];
    if (prefix.length) messages.push({ type: 'heard_words', words: prefix });
    messages.push(this.matchMessage(verse, score));
    if (this.wordIndex >= 0) {
      messages.push({
        type: 'word_progress',
        surah: verse.surah,
        ayah: verse.ayah,
        word_index: this.wordIndex + 1,
        total_words: verse.phoneme_words.length,
        matched_indices: matched.length ? matched : [this.wordIndex],
      });
    }
    return messages;
  }

  private unconfirmedMessages(
    recognized: string[],
    ranked: QuranChampionMatch,
    candidates: RecognitionMessage[] | undefined,
  ): RecognitionMessage[] {
    const words = this.heardDisplayWords(recognized, ranked);
    const messages: RecognitionMessage[] = [];
    if (words.length) messages.push({ type: 'heard_words', words });
    if (candidates) messages.push(...candidates);
    return messages;
  }

  private heardDisplayWords(recognized: string[], ranked: QuranChampionMatch): string[] {
    const verses: QuranVerse[] = [];
    const add = (surah: number, ayah: number) => {
      const verse = this.db.getVerse(surah, ayah);
      if (!verse || skipUnusableLock(verse)) return;
      if (verses.some((item) => item.surah === surah && item.ayah === ayah)) return;
      verses.push(verse);
    };
    add(ranked.surah, ranked.ayah);
    for (const row of ranked.runners_up ?? []) add(row.surah, row.ayah);
    let best: string[] = [];
    for (const verse of verses) {
      const prefix = heardPrefix(recognized, verse);
      if (prefix.length > best.length) best = prefix;
    }
    return best;
  }

  private startReacquire(clearWindow = true): void {
    this.phase = 'reacquiring';
    this.lock = null;
    this.wordIndex = -1;
    this.mismatches = 0;
    this.heardMuqattaatTokens = [];
    if (clearWindow) {
      this.window = new Float32Array(0);
      this.fresh = 0;
    } else {
      this.window = keepLast(this.window, ACQUIRE_MAX_SEC);
    }
  }

  private bodyWords(verse: QuranVerse): string[] {
    return verse.phoneme_words.slice(openingBasmalaWordCount(verse));
  }

  private ensureBodyPrefixCounts(): Map<string, number> {
    if (this.bodyPrefixCounts) return this.bodyPrefixCounts;
    const counts = new Map<string, number>();
    for (const verse of this.db.verses) {
      const body = this.bodyWords(verse);
      let key = '';
      for (let length = 1; length <= Math.min(SHARED_PREFIX_MAX, body.length); length++) {
        key = length === 1 ? body[0]! : `${key}\0${body[length - 1]!}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    this.bodyPrefixCounts = counts;
    return counts;
  }

  /** Leading words, after Basmala, that also open a different ayah. */
  private uniqueOpeningSkip(verse: QuranVerse): number {
    const basmala = openingBasmalaWordCount(verse);
    const body = this.bodyWords(verse);
    if (body.length <= 1) return basmala;
    const counts = this.ensureBodyPrefixCounts();
    let shared = 0;
    const limit = Math.min(SHARED_PREFIX_MAX, body.length - 1);
    let key = '';
    while (shared < limit) {
      key = shared === 0 ? body[0]! : `${key}\0${body[shared]!}`;
      if ((counts.get(key) ?? 0) < 2) break;
      shared++;
    }
    return basmala + shared;
  }

  private distinctSkip(verse: QuranVerse, current?: QuranVerse): number {
    return Math.max(uniqueWordSkip(verse, current), this.uniqueOpeningSkip(verse));
  }

  /** True when the window only matches a formula shared with other ayahs. */
  private onlySharedOpening(recognized: string[], verse: QuranVerse): boolean {
    const skip = this.uniqueOpeningSkip(verse);
    const { words, basmala } = verseAlignWords(verse);
    const bodySkip = Math.max(0, skip - basmala);
    if (bodySkip <= 0 || words.length <= bodySkip) return false;
    const matched = contiguousAlignFromOpening(recognized, words);
    return matched.length > 0 && matched[0] === 0 && matched.every((index) => index < bodySkip);
  }

  /** First post-shared token is still confusable with another ayah (تستوي / تستطيعوا). */
  private uniqueTokenConfusable(verse: QuranVerse): boolean {
    const { words, basmala } = verseAlignWords(verse);
    const bodySkip = Math.max(0, this.uniqueOpeningSkip(verse) - basmala);
    const token = words[bodySkip];
    if (!token || stemKey(token).length < 4) return false;
    for (const other of this.db.verses) {
      if (other.surah === verse.surah && other.ayah === verse.ayah) continue;
      if (skipUnusableLock(other)) continue;
      const otherWords = verseAlignWords(other).words;
      const otherSkip = Math.max(0, this.uniqueOpeningSkip(other) - verseAlignWords(other).basmala);
      const otherToken = otherWords[otherSkip] ?? otherWords[0];
      if (otherToken && confusableBodyToken(token, otherToken)) return true;
    }
    return false;
  }

  /** Thin mid-surah evidence that should not name a distant or short champion. */
  private thinWrongChampion(
    match: QuranChampionMatch,
    verse: QuranVerse,
    recognized: string[],
  ): boolean {
    const { words } = verseAlignWords(verse);
    if (!words.length) return false;
    const leftover = unexplainedDistinctive(recognized, words);
    const hits = distinctiveTokens(recognized, words);
    const aligned = contiguousAlignFromOpening(recognized, words);
    if (verse.ayah > 1 && words.length <= 3 && leftover.length > 0) return true;
    if (
      verse.ayah > 1
      && words.length >= 6
      && match.score < LOCK_CLEAR_SCORE
      && aligned.length < 3
      && leftover.length > 0
    ) return true;
    if (leftover.length >= 2 && leftover.length > hits.length && aligned.length < 3) return true;
    if (
      verse.ayah > 1
      && this.uniqueTokenConfusable(verse)
      && aligned.length > 0
      && aligned[0] === 0
    ) {
      const skip = Math.max(0, this.uniqueOpeningSkip(verse) - verseAlignWords(verse).basmala);
      if (aligned.every((index) => index <= skip) && leftover.length > 0) return true;
      if (aligned.every((index) => index <= skip) && hits.length < 2) return true;
    }
    return false;
  }

  /** When the engine champion is a shared-opening lookalike, lock the ayah
   * whose unique continuation is actually in the window. */
  private alternativeHeardVerse(
    recognized: string[],
    text: string,
    ranked: QuranChampionMatch,
  ): QuranVerse | undefined {
    let best: QuranVerse | undefined;
    let bestScore = -1;
    for (const verse of this.db.verses) {
      if (skipUnusableLock(verse)) continue;
      const start = verseAlignWords(verse).words[0];
      if (!start) continue;
      const body = verseAlignWords(verse).words;
      const oneWordBody = body.length === 1;
      const distinctiveHits = distinctiveTokens(recognized, body);
      const heardStart = oneWordBody
        ? heardIsolatedBodyToken(recognized, start)
        : recognized.some((word) => wordsMatch(word, start));
      // Mid-surah cold start may miss the first word (قالوا) while ربنا يعلم is already in the window.
      if (!heardStart && distinctiveHits.length < 2) continue;
      if (!this.hasVerseEvidence(text, verse, recognized)) continue;
      const score = this.locationScore(text, verse);
      if (!best || score > bestScore + 0.03) {
        best = verse;
        bestScore = score;
      }
    }
    if (!best || (best.surah === ranked.surah && best.ayah === ranked.ayah)) return undefined;
    const rankedVerse = this.db.getVerse(ranked.surah, ranked.ayah);
    if (rankedVerse && !skipUnusableLock(rankedVerse) && this.canLock(ranked, rankedVerse, text, recognized)) {
      const rankedBody = this.locationScore(text, rankedVerse);
      // Acoustic champion already explains the window — do not swap to a distant lookalike.
      if (ranked.score >= LOCK_CLEAR_SCORE && rankedBody >= bestScore - 0.03) return undefined;
      if (rankedBody >= bestScore + SURAH_MARGIN) return undefined;
    }
    const match: QuranChampionMatch = {
      ...ranked,
      surah: best.surah,
      ayah: best.ayah,
      ayah_end: null,
      text: best.text_uthmani,
      phonemes_joined: best.phonemes_joined,
      score: Math.min(ranked.score, bestScore),
    };
    if (this.ambiguousSurah(match, best, text, recognized) || !this.canLock(match, best, text, recognized)) return undefined;
    return best;
  }


  /** When two ayahs share the same body modulo a leading و/ف (1:2 vs 37:182),
   * prefer the higher location score, then the earlier surah/ayah. */
  private preferCanonicalDuplicate(verse: QuranVerse, text: string): QuranVerse {
    const normKey = (words: string[]) => words.map((word) => word.replace(/^[وف]/, '')).join('\0');
    const key = normKey(verseAlignWords(verse).words);
    if (!key) return verse;
    let best = verse;
    let bestScore = this.locationScore(text, verse);
    for (const other of this.db.verses) {
      if (other.surah === best.surah && other.ayah === best.ayah) continue;
      if (skipUnusableLock(other)) continue;
      if (normKey(verseAlignWords(other).words) !== key) continue;
      const score = this.locationScore(text, other);
      if (score > bestScore + 0.02) {
        best = other;
        bestScore = score;
        continue;
      }
      if (Math.abs(score - bestScore) <= 0.02) {
        if (other.surah < best.surah || (other.surah === best.surah && other.ayah < best.ayah)) {
          best = other;
          bestScore = Math.max(bestScore, score);
        }
      }
    }
    return best;
  }

  private canLock(match: QuranChampionMatch, verse: QuranVerse, text: string, recognized: string[]): boolean {
    if (skipUnusableLock(verse) || match.score < LOCK_SCORE) return false;
    if (!this.hasVerseEvidence(text, verse, recognized)) return false;
    // Reject locks that only hear a shared prefix (قل اعوذ برب / Basmala) with no unique body word.
    if (this.onlySharedOpening(recognized, verse)) return false;
    if (this.thinWrongChampion(match, verse, recognized)) return false;
    // Isolated mysterious-letter ayahs (e.g. 7:1 المص) need that token as a whole
    // word. Use phoneme body tokens: Uthmani الٓمٓصٓ is longer than 5 because of
    // maddahs, and substring hits like المصدر / المدرس must not lock. The same
    // phoneme body is how 2:1 الم locks (not Uthmani الٓمٓ).
    const { words: body } = verseAlignWords(verse);
    if (body.length === 1 && shortAyah1Body(body[0]!)) {
      const token = compact(body[0]!);
      if (!heardIsolatedBodyToken(recognized, token)) return false;
    }
    const skip = openingBasmalaWordCount(verse);
    if (skip > 0) {
      const unique = verse.phonemes_joined_no_bsm_ns ?? compact(verse.phonemes_joined_no_bsm ?? '');
      if (unique) {
        const heardShortBody = body.length === 1 && shortAyah1Body(body[0]!)
          && heardIsolatedBodyToken(recognized, compact(body[0]!));
        // Letter-name windows (الف لام ميم) do not contain compact الم as a substring.
        if (!heardShortBody) {
          const query = compact(text);
          const score = unique.length <= query.length
            ? fragmentScore(unique, query)
            : fragmentScore(query, unique);
          if (score < 0.45) return false;
        }
      }
    }
    return match.score >= LOCK_CLEAR_SCORE
      || !this.closeRival(match)
      || this.equivalentAyah1Body(match, verse)
      || this.distinctShortAyah1Body(match, verse, recognized)
      || (verse.ayah > 1 && this.beatsRival(match, verse, text));
  }

  private hasVerseEvidence(text: string, verse: QuranVerse, recognized: string[]): boolean {
    const skip = this.uniqueOpeningSkip(verse);
    const { words, basmala } = verseAlignWords(verse);
    if (!words.length) return false;
    const bodySkip = Math.max(0, skip - basmala);
    const bodyRef = compact(words.join(' '));
    const query = compact(text);
    if (!bodyRef) return false;
    const openingScore = () => {
      if (bodyRef.length <= query.length) return fragmentScore(bodyRef, query) >= LOCK_SCORE;
      const opening = bodyRef.slice(0, Math.min(bodyRef.length, query.length + 6));
      return Math.max(fragmentScore(query, opening), levRatio(query, opening)) >= LOCK_SCORE;
    };
    // Letter-name recitation (الف لام ميم) does not contiguous-align to الم.
    if (words.length === 1 && shortAyah1Body(words[0]!) && heardIsolatedBodyToken(recognized, words[0]!)) {
      return openingIsAtStart(recognized, words);
    }
    const matched = contiguousAlignFromOpening(recognized, words);
    if (matched.length && matched[0] === 0) {
      if (!(bodySkip > 0 && words.length > bodySkip && !matched.includes(bodySkip))) {
        if (!openingIsAtStart(recognized, words)) {
          // One-word ayah-1 bodies found inside Basmala are not verse evidence.
          if (words.length <= 1 || matched.length < Math.min(2, words.length)) return false;
        }
        return openingScore();
      }
    }
    // Opening ASR-garbled (سبحان for انا on 108:1) but unique body tokens are clear.
    // Short mid-surah ayahs (كلا سيعلمون) must not lock from a later suffix / shared root.
    if (verse.ayah > 1 && words.length <= 3) return false;
    const unique = words.slice(Math.max(bodySkip, 1));
    if (!unique.length) return false;
    const hits = [...new Set(unique.filter((token) => (
      !isFormulaBodyToken(token)
      && recognized.some((word) => wordsMatch(word, token))
    )))];
    const need = Math.min(2, unique.filter((token) => !isFormulaBodyToken(token)).length || unique.length);
    if (hits.length < need) return false;
    return this.locationScore(text, verse) >= LOCK_CLEAR_SCORE;
  }

  private locationScore(text: string, verse: QuranVerse): number {
    const { words } = verseAlignWords(verse);
    const ref = compact(words.join(' ')) || verseText(verse);
    const query = compact(text);
    if (!ref) return 0;
    if (ref.length <= query.length) return fragmentScore(ref, query);
    const opening = ref.slice(0, Math.min(ref.length, query.length + 6));
    return Math.max(fragmentScore(query, opening), levRatio(query, opening));
  }

  private beatsRival(match: QuranChampionMatch, verse: QuranVerse, text: string): boolean {
    const rival = match.runners_up?.[0];
    if (!rival || rival.surah === verse.surah) return true;
    const last = this.db.getSurah(rival.surah).at(-1)?.ayah ?? rival.ayah;
    const begin = rival.ayah > 1 ? Math.max(1, rival.ayah - 1) : 1;
    const end = rival.ayah > 1 ? Math.min(last, rival.ayah + 2) : Math.min(last, 1 + RIVAL_SCAN);
    let bestRival = 0;
    for (let ayah = begin; ayah <= end; ayah++) {
      const candidate = this.db.getVerse(rival.surah, ayah);
      if (candidate) bestRival = Math.max(bestRival, explainScore(text, candidate));
    }
    return explainScore(text, verse) >= Math.max(LOCK_SCORE, bestRival + SURAH_MARGIN);
  }

  private ambiguousSurah(match: QuranChampionMatch, verse: QuranVerse, text: string, recognized: string[]): boolean {
    const rival = match.runners_up?.[0];
    if (!rival || rival.surah === match.surah) return false;
    if (match.score - rival.score >= SURAH_MARGIN) return false;
    // Identical muqattaʿāt (2:1 vs 3:1) are the same opening, not two surahs.
    if (this.equivalentAyah1Body(match, verse)) return false;
    if (this.distinctShortAyah1Body(match, verse, recognized)) return false;
    // Was `ayah <= 1 || !beatsRival` which made EVERY ayah-1 lock ambiguous whenever
    // any close cross-surah rival existed (Kawthar/Asr/Quraysh skipped to ayah 2+).
    return !this.beatsRival(match, verse, text);
  }

  /** Heard الم (or letter names) while the close rival is a different body such as المص. */
  private distinctShortAyah1Body(match: QuranChampionMatch, verse: QuranVerse, recognized: string[]): boolean {
    if (verse.ayah !== 1) return false;
    const { words } = verseAlignWords(verse);
    if (words.length !== 1 || !shortAyah1Body(words[0]!)) return false;
    if (!heardIsolatedBodyToken(recognized, words[0]!)) return false;
    const rival = match.runners_up?.[0];
    if (!rival || rival.surah === verse.surah) return true;
    const rivalOpening = this.db.getVerse(rival.surah, 1);
    if (!rivalOpening) return true;
    const rivalBody = verseAlignWords(rivalOpening).words;
    if (rivalBody.length === 1 && heardIsolatedBodyToken(recognized, rivalBody[0]!)) {
      return compact(rivalBody[0]!) === compact(words[0]!);
    }
    return true;
  }

  private equivalentAyah1Body(match: QuranChampionMatch, verse: QuranVerse): boolean {
    if (verse.ayah !== 1) return false;
    const key = (item: QuranVerse) => verseAlignWords(item).words.join('\0');
    const body = key(verse);
    if (!body) return false;
    const sameOpening = (surah: number, ayah: number) => {
      const other = this.db.getVerse(surah, ayah);
      return Boolean(other && other.ayah === 1 && other.surah !== verse.surah && key(other) === body);
    };
    if (match.surah !== verse.surah && sameOpening(match.surah, match.ayah)) return true;
    const rival = match.runners_up?.[0];
    return Boolean(rival && sameOpening(rival.surah, rival.ayah));
  }

  private closeRival(match: QuranChampionMatch): boolean {
    const rival = match.runners_up?.[0];
    return Boolean(rival && match.score - rival.score < SURAH_MARGIN);
  }

  private locateAyah(match: QuranChampionMatch, text: string, recognized: string[]): QuranVerse | undefined {
    const span = this.ayahInSpan(match, text, recognized, !this.closeRival(match));
    const spanOk = Boolean(
      span
      && !this.ambiguousSurah(match, span, text, recognized)
      && !this.thinWrongChampion(match, span, recognized)
    );
    if (spanOk && span) return span;
    const rival = match.runners_up?.[0];
    const pool = [
      ...this.scanAroundAyah(match.surah, match.ayah, recognized, text),
      ...(rival && rival.surah !== match.surah
        ? this.scanAroundAyah(rival.surah, rival.ayah, recognized, text)
        : this.scanOpenings(match.surah, 1, recognized, text)),
    ];
    let best: QuranVerse | undefined;
    let bestScore = -1;
    let bestHits = -1;
    for (const verse of pool) {
      const hits = distinctiveTokens(recognized, verseAlignWords(verse).words).length;
      const score = this.locationScore(text, verse);
      if (!best || hits > bestHits + 1 || (hits >= bestHits && score > bestScore + 0.03)) {
        best = verse;
        bestScore = score;
        bestHits = hits;
      }
    }
    if (!best) return spanOk ? span : undefined;
    const otherBest = pool
      .filter((verse) => verse.surah !== best.surah)
      .reduce((max, verse) => Math.max(max, this.locationScore(text, verse)), 0);
    if (otherBest > 0 && bestHits < 2 && bestScore < otherBest + SURAH_MARGIN) {
      return spanOk ? span : undefined;
    }
    return best;
  }

  private ayahInSpan(
    match: QuranChampionMatch,
    text: string,
    recognized: string[],
    preferEarliest: boolean,
  ): QuranVerse | undefined {
    const first = this.db.getVerse(match.surah, match.ayah);
    if (!first) return undefined;
    const opening = this.db.getVerse(match.surah, 1);
    const openingBody = Boolean(
      opening
      && !skipUnusableLock(opening)
      && this.hasVerseEvidence(text, opening, recognized)
    );
    const begin = openingBody ? 1 : match.ayah;
    const keepEarliest = preferEarliest || openingBody;
    const spanEnd = match.ayah_end && match.ayah_end > match.ayah ? match.ayah_end : match.ayah;
    const last = this.db.getSurah(match.surah).at(-1)?.ayah ?? spanEnd;
    const end = Math.min(last, Math.max(spanEnd, match.ayah + 3));
    let best: QuranVerse | undefined;
    let bestScore = -1;
    for (let ayah = begin; ayah <= end; ayah++) {
      const verse = this.db.getVerse(match.surah, ayah);
      if (!verse || skipUnusableLock(verse)) continue;
      // Allow unique-token evidence when the body opening was ASR-garbled (Kawthar انا→سبحان).
      if (recognized.length
        && !heardDistinct(recognized, verse, this.uniqueOpeningSkip(verse))
        && !this.hasVerseEvidence(text, verse, recognized)) continue;
      if (ayah > spanEnd
        && !heardDistinct(recognized, verse, this.uniqueOpeningSkip(verse))
        && !this.hasVerseEvidence(text, verse, recognized)) continue;
      const score = explainScore(text, verse);
      if (!best) {
        best = verse;
        bestScore = score;
        continue;
      }
      // Ayah-1 body in the window is the start of the recitation, not a later
      // ayah that happens to score higher in the same acquire window.
      if (openingBody && best.ayah === 1) continue;
      if (keepEarliest) {
        if (bestScore < LOCK_SCORE && score >= LOCK_SCORE) {
          best = verse;
          bestScore = score;
        }
      } else if (score > bestScore + 0.03) {
        best = verse;
        bestScore = score;
      }
    }
    return best;
  }

  private scanOpenings(surah: number, fromAyah: number, recognized: string[], text: string): QuranVerse[] {
    return this.scanAroundAyah(surah, fromAyah, recognized, text);
  }

  /** Openings when ayah is 1; the reported mid-surah ayah and its neighbors otherwise. */
  private scanAroundAyah(surah: number, ayah: number, recognized: string[], text: string): QuranVerse[] {
    const last = this.db.getSurah(surah).at(-1)?.ayah ?? ayah;
    const from = ayah > 1 ? Math.max(1, ayah - 1) : 1;
    const end = ayah > 1 ? Math.min(last, ayah + 2) : Math.min(last, 1 + RIVAL_SCAN);
    const found: QuranVerse[] = [];
    for (let n = from; n <= end; n++) {
      const verse = this.db.getVerse(surah, n);
      if (!verse || skipUnusableLock(verse)) continue;
      const hits = distinctiveTokens(recognized, verseAlignWords(verse).words).length;
      if (!heardDistinct(recognized, verse, this.uniqueOpeningSkip(verse)) && hits < 2) continue;
      if (this.locationScore(text, verse) < LOCK_SCORE && hits < 2) continue;
      found.push(verse);
    }
    return found;
  }

  private hasOpeningEvidence(recognized: string[], text: string, verse: QuranVerse): boolean {
    return heardDistinct(recognized, verse, this.distinctSkip(verse))
      || this.hasVerseEvidence(text, verse, recognized);
  }

  private scanPoolOpenings(surah: number, recognized: string[], text: string): QuranVerse[] {
    const first = this.db.getVerse(surah, 1);
    const fromAyah = first && skipUnusableLock(first) ? 2 : 1;
    const verse = this.db.getVerse(surah, fromAyah);
    if (!verse || skipUnusableLock(verse) || !this.hasOpeningEvidence(recognized, text, verse)) return [];
    if (this.locationScore(text, verse) < LOCK_SCORE) return [];
    return [verse];
  }

  private scanHandoffVerses(surah: number, recognized: string[], text: string): QuranVerse[] {
    const found = this.scanPoolOpenings(surah, recognized, text);
    if (!isFamousHandoffSurah(surah)) return found;
    for (const verse of this.db.getSurah(surah)) {
      if (found.some((item) => item.ayah === verse.ayah)) continue;
      if (skipUnusableLock(verse)) continue;
      const hits = distinctiveTokens(recognized, verseAlignWords(verse).words).length;
      if (!this.hasOpeningEvidence(recognized, text, verse) && hits < 2) continue;
      if (this.locationScore(text, verse) < LOCK_SCORE) continue;
      found.push(verse);
    }
    return found;
  }

  private lockFromNextSurahPool(
    text: string,
    recognized: string[],
    fromSurah: number,
    options: { openingsOnly?: boolean } = {},
  ): QuranVerse | undefined {
    const last = this.db.getSurah(fromSurah).at(-1);
    const mushafNext = last ? this.db.getNextVerse(last.surah, last.ayah)?.surah ?? null : null;
    const pool: { verse: QuranVerse; score: number; bonus: number }[] = [];
    for (const surah of handoffCandidateSurahs(fromSurah, mushafNext)) {
      const verses = options.openingsOnly
        ? this.scanPoolOpenings(surah, recognized, text)
        : this.scanHandoffVerses(surah, recognized, text);
      for (const verse of verses) {
        if (this.sameRef(verse, this.lock ?? undefined)) continue;
        if (surah === fromSurah && verse.ayah > 1) continue;
        if (!this.allowsHandoffVerse(verse, recognized)) continue;
        if (!this.hasOpeningEvidence(recognized, text, verse) && distinctiveTokens(recognized, verseAlignWords(verse).words).length < 2) continue;
        pool.push({
          verse,
          score: this.locationScore(text, verse),
          bonus: surahBonus(surah, fromSurah),
        });
      }
    }
    pool.sort((left, right) => {
      if (Math.abs(left.score - right.score) + 1e-9 >= SURAH_MARGIN) return right.score - left.score;
      if (left.bonus !== right.bonus) return right.bonus - left.bonus;
      return right.score - left.score;
    });
    for (const row of pool) {
      const match: QuranChampionMatch = {
        surah: row.verse.surah,
        ayah: row.verse.ayah,
        text: row.verse.text_uthmani,
        phonemes_joined: row.verse.phonemes_joined,
        score: row.score,
        raw_score: row.score,
        bonus: 0,
      };
      if (this.canLock(match, row.verse, text, recognized)) return row.verse;
    }
    return undefined;
  }

  private previousVerse(ref: VerseRef): QuranVerse | undefined {
    if (ref.ayah > 1) return this.db.getVerse(ref.surah, ref.ayah - 1);
    if (ref.surah <= 1) return undefined;
    const previousSurah = this.db.getSurah(ref.surah - 1);
    return previousSurah.at(-1);
  }

  private sameRef(left: VerseRef | undefined, right: VerseRef | undefined): boolean {
    return Boolean(left && right && left.surah === right.surah && left.ayah === right.ayah);
  }

  private candidateList(match: QuranChampionMatch) {
    const rows = [match, ...(match.runners_up ?? [])].slice(0, 4);
    return rows.map((row, rank) => ({
      surah: row.surah,
      ayah: row.ayah,
      ayah_end: rank === 0 ? match.ayah_end ?? null : null,
      confidence: row.score,
      rank,
      source: 'discovery' as const,
    }));
  }

  private matchMessage(verse: QuranVerse, score: number): VerseMatchMessage {
    return {
      type: 'verse_match',
      surah: verse.surah,
      ayah: verse.ayah,
      verse_text: verse.text_uthmani,
      surah_name: verse.surah_name,
      confidence: Math.round(Math.min(0.99, Math.max(score, 0.45)) * 100) / 100,
      surrounding_verses: [],
    };
  }
}
