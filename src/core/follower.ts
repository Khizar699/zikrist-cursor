import type { QuranChampionMatch, QuranDB, QuranVerse, TilawaSession, TranscribeResult, VerseMatchMessage } from '@tilawa/core';
import { fragmentScore, ratio as levRatio } from '../../node_modules/@tilawa/core/dist/levenshtein.js';
import { isFatihaBasmala, isFatihaBasmalaTail, OPENING_BASMALA_WORDS, openingBasmalaWordCount, splitOpeningBasmala } from './basmala';
import { recordRecognitionCycle } from './recognition-clocks';
import { DEBUG_HUD_MISS_THRESHOLD, formatDebugHudMode, formatSearchSpace, publishDebugHud, resetDebugHud, type DebugHudSnapshot } from './debug-hud';
import { rerankChampion, surahBonus, acousticChampion, TIE_BREAK_MARGIN } from './salah-prior';
import { collapseMaddRuns, currentRemainder, openingCousin, scoreExpectedTape } from './expected-tape';
import { TRACKING_COMPLETION_COVERAGE } from './sequential';
import type { FollowerPhase, RecognitionMessage, VerseRef, ZikristVerseMatch } from './types';
import {
  decideLocationCommit,
  freshCommitState,
  noteCredibleSupport,
  noteUnsupportedVoiced,
  type CommitControllerState,
} from './tracking/commit-controller';
import type { CommitKind } from './tracking/types';
import { CROSS_SURAH_ENTER, scoreCandidate, applyMargin } from './tracking/evidence';
import {
  classifyFollowEvidence,
  formatTrackDebug,
  freshTrackConfidence,
  trackLost,
  transcriptUnusable,
  updateTrackConfidence,
  type TrackConfidenceState,
} from './tracking/follow-evidence';
import { TokenDocumentStats } from './tracking/token-stats';

export type { FollowerPhase };
export type TranscribeFn = (audio: Float32Array, locate: boolean) => Promise<TranscribeResult>;
export type FeedTimings = { queueWaitMs?: number; stallMs?: number; voicedMs?: number };

export const TRACK_UNSUPPORTED_VOICED_MS = 1500;

type CommitHandoffMeta = {
  uniqueSecond?: boolean;
  ayah2Ready?: boolean;
  twoContiguous?: boolean;
  runnerUpTotal?: number;
  shortOpeningConfirmed?: boolean;
  muqattaatHeard?: boolean;
  openingEntropy?: boolean;
  distinctiveTokenCount?: number;
  bodyHeardCount?: number;
  recognized?: string[];
};

const SAMPLE_RATE = 16000;
const ACQUIRE_MIN_SEC = 0.9;
export const ACQUIRE_MAX_SEC = 4;
/** Slide the reacquire window after consecutive denied commits so Buf does not stick at 4s. */
const REACQUIRE_DENY_TRIM_SEC = 0.5;
const REACQUIRE_DENY_TRIM_AFTER = 2;
/** Same-surah reacquire scores this ayah band first (then full-surah fallback). */
const REACQUIRE_SAME_SURAH_BEHIND = 1;
const REACQUIRE_SAME_SURAH_AHEAD = 4;
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
/** On the last ayah of a surah the follow window grows to acquire size so the
 * next surah's shared-prefix opening is heard whole (قل اعوذ برب … الناس). */
export const FOLLOW_SURAH_END_ACCUMULATE_SEC = ACQUIRE_MAX_SEC;
/** Prayer handoffs score all 114 ayah-1 openings (ayah 2 when ayah 1 is Basmala).
 * Long ayah-1 bodies are admitted only by opening-align + entropy, not by a
 * surah-number allow-list. */
const HANDOFF_OPENING_MAX_WORDS = 8;
export const QURAN_SURAH_COUNT = 114;
/** New-surah lock: two aligned body words, or this many aligned characters. */
export const OPENING_ENTROPY_MIN_WORDS = 2;
export const OPENING_ENTROPY_MIN_CHARS = 7;
const LAST_AYAH_SEED_SEC = 0.3;
/** After the first lock of a session, keep enough of the current ayah to keep following it. */
export const KEEP_AFTER_LOCK_SEC = 1.0;
/** After advancing to the next ayah, keep a short splice so the previous tail does not dominate. */
export const KEEP_AFTER_COMMIT_SEC = 0.25;
const LOCK_SCORE = 0.62;
const LOCK_CLEAR_SCORE = 0.72;
/** Advance to mushaf-next once its candidate similarity clears this bar. */
const SEQUENTIAL_ADVANCE_SCORE = 0.65;
/** New-surah opening must clear this, or align two contiguous ayah-1 words. */
const HANDOFF_OPENING_SCORE = 0.70;
const SURAH_MARGIN = TIE_BREAK_MARGIN;
const NEIGHBORHOOD_KEEP = 0.5;
/** Consecutive weak hops before dropping lock / allowing global reacquire. */
export const LOCK_GRACE_FAILS = DEBUG_HUD_MISS_THRESHOLD;
/** Wall-clock grace while locked: non-matching speech must last this long. */
export const LOCK_GRACE_MS = 1500;
/** Prefer same-surah candidates this much over distant mushaf hits. */
const LOCALITY_SURAH_BIAS = 0.14;
const GLOBAL_SEARCH_MIN_WORDS = 3;
const GLOBAL_SEARCH_MIN_CHARS = 10;
/** Skip stacking JS mushaf search so Match on the audio loop stays bounded. */
const GLOBAL_SEARCH_BUDGET_MS = 50;
const GLOBAL_SEARCH_COOLDOWN_MS = 250;
const FOLLOW_WINDOW_BEHIND = 1;
const FOLLOW_WINDOW_AHEAD = 2;
const LOOKAHEAD = 5;
const RIVAL_SCAN = 6;
const SHARED_PREFIX_MAX = 6;
/** Openings-pool shared-prefix veto lifts when the heard prefix opens at most
 * this many other (mid-surah) ayahs — a textual twin such as 89:6 for 105:1. */
const RARE_SHARED_PREFIX_TWINS = 1;
/** A two-word formula (الحمد لله, قل هو) is never a rare twin; need a trigram. */
const RARE_SHARED_PREFIX_MIN_WORDS = 3;

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

/** Advance/follow soft match: نفاث ≈ النفثت, الجنة ≈ الجنه, لإيلاف ≈ ايلاف. */
function softTokenMatch(left: string, right: string): boolean {
  if (wordsMatch(left, right) || relatedStem(left, right) || cliticTokenMatch(left, right)) return true;
  const a = stripProclitics(left);
  const b = stripProclitics(right);
  if (a.length >= 2 && a === b) return true;
  if (a.length < 3 || b.length < 3) return false;
  if (a.includes(b) || b.includes(a)) return true;
  return levRatio(a, b) >= 0.72;
}

function openingWordMatch(left: string, right: string): boolean {
  return left === right || openingStem(left, right);
}

/** ASR writes the long alif the phoneme index omits (كتاب vs الكتب). Compare
 * the consonant skeleton after dropping ال / و / ف proclitics and every alif. */
function sameConsonantSkeleton(left: string, right: string): boolean {
  const skeleton = (word: string) => {
    let text = foldArabicLetters(word);
    if ((text[0] === 'و' || text[0] === 'ف') && text.length > 3) text = text.slice(1);
    if (text.startsWith('ال') && text.length > 4) text = text.slice(2);
    return text.replace(/ا/g, '');
  };
  const a = skeleton(left);
  const b = skeleton(right);
  return a.length >= 3 && a === b;
}

function foldArabicLetters(token: string): string {
  return compact(token)
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase();
}

/** Strip Arabic proclitics و/ف, ب/ل/ك, and ال so لإيلاف and ايلاف share a stem. */
export function stripProclitics(token: string): string {
  let word = foldArabicLetters(token);
  if (word.length <= 2) return word;
  if ((word[0] === 'و' || word[0] === 'ف') && word.length > 3) word = word.slice(1);
  if ((word[0] === 'ب' || word[0] === 'ك' || word[0] === 'ل') && word.length > 3) {
    word = word.slice(1);
  }
  if (word.startsWith('ال') && word.length > 4) word = word.slice(2);
  return word;
}

function cliticTokenMatch(left: string, right: string): boolean {
  const aRaw = foldArabicLetters(left);
  const bRaw = foldArabicLetters(right);
  if (aRaw && aRaw === bRaw) return true;
  const a = stripProclitics(left);
  const b = stripProclitics(right);
  if (a.length >= 2 && a === b) return true;
  if (a.length >= 3 && b.length >= 3) {
    if (a.endsWith(b) || b.endsWith(a)) return true;
    if ((a.startsWith(b) || b.startsWith(a)) && Math.abs(a.length - b.length) <= 2) return true;
    if (levRatio(a, b) >= 0.85) return true;
  }
  if (aRaw.length >= 4 && bRaw.length >= 4 && Math.abs(aRaw.length - bRaw.length) <= 2) {
    if (aRaw.endsWith(bRaw) || bRaw.endsWith(aRaw)) return true;
    return levRatio(aRaw, bRaw) >= 0.85;
  }
  return false;
}

/** Exact or stem match for a switch word. Substring `لك`⊂`تلك`/`الكتاب` is not evidence. */
function confirmedSwitchWord(heard: string, expected: string): boolean {
  if (heard === expected) return true;
  if (heard.length <= 2 || expected.length <= 2) return false;
  return wordsMatch(heard, expected, 0.85) || openingStem(heard, expected);
}

/** Longest verse word still treated as a short particle / verb (تر, هو, في, لم). */
const SHORT_VERSE_WORD_MAX = 3;

/**
 * ASR renders short verse words with the final vowel written long (تَرَ → ترى,
 * تَرَ → ترا). Positional opening alignment accepts that one-letter tail; the
 * word must otherwise be identical, so لك ≠ تلك and الم ≠ المال.
 */
function shortWordVariant(heard: string, expected: string): boolean {
  const target = foldArabicLetters(expected);
  if (target.length < 2 || target.length > SHORT_VERSE_WORD_MAX) return false;
  const spoken = foldArabicLetters(heard);
  if (spoken === target) return true;
  return spoken.length === target.length + 1 && spoken.startsWith(target) && /[اويه]$/.test(spoken);
}

/** CTC dropped the word boundary (تركيف = تر + كيف). Exact folded concatenation only. */
function mergedPairMatch(heard: string, first: string, second: string): boolean {
  const spoken = foldArabicLetters(heard);
  const pair = foldArabicLetters(first) + foldArabicLetters(second);
  if (pair.length < 4 || spoken.length !== pair.length) return false;
  return spoken === pair;
}

/**
 * One verse word crushed by CTC (برب → ب, الناس → الن) may be stepped over
 * only when the very next heard token confirms the very next verse word
 * (≥ 3 letters, strong match). The crumb must still resemble the skipped
 * word — start it, or share half its letters — so قل الله never stands in
 * for قل لو شاء الله.
 */
function garbledWordSkip(
  heard: string,
  expected: string,
  nextHeard: string | undefined,
  nextExpected: string | undefined,
  confirm: (heard: string, expected: string) => boolean,
): boolean {
  if (!nextHeard || !nextExpected) return false;
  const crumb = foldArabicLetters(heard);
  const word = foldArabicLetters(expected);
  const following = foldArabicLetters(nextExpected);
  if (!crumb || !word || following.length < 3) return false;
  if (crumb.length >= word.length) return false;
  const resembles = word.startsWith(crumb) || levRatio(crumb, word) >= 0.5;
  if (!resembles) return false;
  return confirm(nextHeard, nextExpected);
}

function openingBodyWords(verse: QuranVerse): string[] {
  const { words } = verseAlignWords(verse);
  if (!words.length) return [];
  return words[0] && isSharedBasmalaToken(words[0]!)
    ? words.slice(Math.min(OPENING_BASMALA_WORDS, words.length))
    : words;
}

function openingEntropyReady(alignedWords: string[]): boolean {
  if (alignedWords.length >= OPENING_ENTROPY_MIN_WORDS) return true;
  return compact(alignedWords.join('')).length >= OPENING_ENTROPY_MIN_CHARS;
}

function sharedOpeningPrefixLen(left: string[], right: string[]): number {
  const max = Math.min(left.length, right.length);
  let count = 0;
  while (count < max && cliticTokenMatch(left[count]!, right[count]!)) count += 1;
  return count;
}

function heardDivergentOpening(heard: string[], body: string[], rivals: string[][]): boolean {
  if (!rivals.length) return true;
  let shared = body.length;
  for (const rival of rivals) shared = Math.min(shared, sharedOpeningPrefixLen(body, rival));
  const unique = body.slice(shared);
  if (!unique.length) return false;
  return unique.some((word) => heard.some((token) => cliticTokenMatch(token, word)));
}

type QuranOpeningEntry = {
  verse: QuranVerse;
  body: string[];
  ayah2?: QuranVerse;
  ayah2Body: string[];
};

const OPENING_BASMALA_TOKENS = new Set([
  'بسم', 'الله', 'الرحمن', 'الرحيم', 'bismi', 'allahi', 'alrahman', 'alrahim',
]);

function isBasmalaTokenLike(word: string): boolean {
  const token = compact(word);
  const folded = foldArabicLetters(token);
  if (OPENING_BASMALA_TOKENS.has(token) || OPENING_BASMALA_TOKENS.has(folded)) return true;
  return [...OPENING_BASMALA_TOKENS].some((item) => {
    const expected = compact(item);
    // لله is a suffix of الله, not the Basmala word itself.
    if (token.length < expected.length && folded.length < expected.length) return false;
    return openingWordMatch(token, item) || openingWordMatch(folded, item) || cliticTokenMatch(token, item);
  });
}

function isSharedBasmalaToken(word: string): boolean {
  return isBasmalaTokenLike(word);
}

/** Tight Basmala-tail tokens. relatedStem would swallow الرحيمالم as الرحيم. */
function isBasmalaTailToken(word: string): boolean {
  return isBasmalaTokenLike(word);
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

/** Drop a leading Basmala run only. Keep later الله / هو that are ayah body
 * (Ikhlas قل هو الله احد must not lose الله to the Basmala filter). */
function bodyHeardTokens(recognized: string[]): string[] {
  let start = 0;
  while (
    start < recognized.length
    && start < OPENING_BASMALA_WORDS
    && (isSharedBasmalaToken(recognized[start]!) || isBasmalaTailToken(recognized[start]!))
  ) {
    start += 1;
  }
  return recognized.slice(start);
}

function shortAyah1Body(token: string): boolean {
  const body = compact(token);
  return body.length >= 2 && body.length <= 5;
}

/** Recited muqattaʿāt are often letter names (الف لام ميم), not the compact الم. */
const STANDARD_MUQATTAAT_BODIES = new Set([
  'الم', 'المص', 'المر', 'الر', 'كهيعص', 'طه', 'طسم', 'طس', 'يس', 'ص', 'حم', 'عسق', 'ق', 'ن',
  'alif', 'lam', 'meem', 'ya', 'seen',
]);

function isStandardMuqattaatBody(token: string): boolean {
  const raw = compact(token);
  // Interrogative أَلَمْ folds to الم but is not a mysterious-letter ayah-1 body.
  if (/^[أإآ]/.test(raw)) return false;
  return STANDARD_MUQATTAAT_BODIES.has(foldArabicLetters(token));
}

/** ASR often emits compact الم for ألم/إلم openings; not an isolated muqattaʿāt body. */
function muqattaatOpeningHomophone(heard: string, openingFirst: string): boolean {
  const heardBody = compact(heard);
  if (!isStandardMuqattaatBody(heardBody)) return false;
  if (isStandardMuqattaatBody(openingFirst)) return false;
  return foldArabicLetters(heardBody) === foldArabicLetters(openingFirst);
}
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

const LATIN_MUQATTAAT_NAMES: Record<string, string> = {
  alif: 'ا', lam: 'ل', meem: 'م', mim: 'م', ya: 'ي', yeh: 'ي',
  seen: 'س', sad: 'ص', haa: 'ح', ha: 'ه', qaf: 'ق', noon: 'ن',
  kaf: 'ك', ain: 'ع', tah: 'ط',
};

function namedMuqattaatLetter(word: string): string | undefined {
  const token = compact(word);
  if (!token) return undefined;
  const folded = foldArabicLetters(token);
  for (const [letter, names] of Object.entries(MUQATTAAT_LETTER_NAMES)) {
    if (names.includes(token) || names.includes(folded)) return letter;
  }
  return LATIN_MUQATTAAT_NAMES[folded];
}

function heardAttachedLetterName(heard: string, body: string): boolean {
  const last = muqattaatLetter(body.at(-1) ?? '');
  const names = MUQATTAAT_LETTER_NAMES[last];
  if (!names) return false;
  for (const name of names) {
    if (name.length < 2) continue;
    if (heard === body + name) return true;
    // الميم = الم + (ميم without leading م). Do not treat طها as طه+ها:
    // two-letter names make every 2-letter body a noise lock (english-negative).
    if (name.length >= 3 && name.startsWith(last) && heard === body + name.slice(1)) return true;
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
  if (heardMuqattaatSpelling(recognized, body)) return true;
  return recognized.some((word) => {
    const heard = compact(word);
    if (!heard) return false;
    if (heard === body || heardAttachedLetterName(heard, body)) return true;
    // Short mysterious-letter bodies: only +1 elongation on 3+ letters (المي),
    // never lexical cousins (المصدر⊃المص) or 2-letter noise (طها⊃طه).
    if (shortAyah1Body(body) && body.length >= 3) {
      return isMaddElongation(heard, body);
    }
    return openingStem(heard, body);
  });
}

/** المي / الما for الم: the body plus one madd letter. المه / المس are garble. */
function isMaddElongation(heard: string, body: string): boolean {
  return heard.length === body.length + 1 && heard.startsWith(body) && /[اويى]$/.test(heard);
}

type RunningOpeningAlign = {
  body: string[];
};

/** True when a muqattaʿāt homophone (الم from ASR) starts a running multi-word ayah-1 (ألم تر). */
function muqattaatHomophoneContinuesRunningOpening(
  recognized: string[],
  muqattaatBody: string,
  openings: readonly RunningOpeningAlign[],
  switchOpeningMatch: (heard: string, expected: string) => boolean,
  alignFromOpening: (heard: string[], verseWords: string[]) => number[],
): boolean {
  if (!isStandardMuqattaatBody(muqattaatBody)) return false;
  const body = compact(muqattaatBody);
  const from = leadingBasmalaWords(recognized);
  for (let index = from; index < recognized.length; index += 1) {
    const heard = compact(recognized[index]!);
    if (!heard) continue;
    const homophone = heard === body
      || heardAttachedLetterName(heard, body)
      || (shortAyah1Body(body) && body.length >= 3 && isMaddElongation(heard, body))
      || openingStem(foldArabicLetters(heard), foldArabicLetters(body));
    if (!homophone) continue;
    const tail = recognized.slice(index).filter((word) => !isBasmalaTailToken(word));
    if (tail.length < 2) continue;
    const afterFirst = tail.slice(1);
    if (afterFirst.length && afterFirst.every((word) => Boolean(namedMuqattaatLetter(word)))) continue;
    for (const entry of openings) {
      if (entry.body.length < 2) continue;
      if (entry.body.length === 1 && isStandardMuqattaatBody(entry.body[0]!)) continue;
      let aligned: number[];
      if (switchOpeningMatch(tail[0]!, entry.body[0]!)) {
        aligned = alignFromOpening(tail, entry.body);
        if (aligned.length >= 2 && aligned[0] === 0 && aligned.includes(1)) return true;
        continue;
      }
      if (!muqattaatOpeningHomophone(tail[0]!, entry.body[0]!)) continue;
      const restBody = entry.body.slice(1);
      if (!restBody.length) continue;
      aligned = alignFromOpening(afterFirst, restBody);
      if (aligned.length >= 2 && aligned[0] === 0 && aligned.includes(1)) return true;
    }
  }
  return false;
}

/** One-word ayah-1 muqattaʿāt (الم, المص). Not Basmala-echo الرحمن or عم. */
function isExactMuqattaatAyah1(verse: QuranVerse): boolean {
  if (verse.ayah !== 1 || skipUnusableLock(verse)) return false;
  const { words } = verseAlignWords(verse);
  if (words.length !== 1) return false;
  const token = compact(words[0]!);
  return shortAyah1Body(token) && isStandardMuqattaatBody(token) && !isSharedBasmalaToken(token);
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
    const heard = recognized[spoken]!;
    const word = verseWords[expected]!;
    if (wordsMatch(heard, word) || shortWordVariant(heard, word)) {
      matched.push(expected);
      expected += 1;
      continue;
    }
    const following = verseWords[expected + 1];
    if (following && mergedPairMatch(heard, word, following)) {
      matched.push(expected, expected + 1);
      expected += 2;
      continue;
    }
    if (garbledWordSkip(heard, word, recognized[spoken + 1], following, (h, w) => wordsMatch(h, w))) {
      matched.push(expected + 1);
      expected += 2;
      spoken += 1;
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

/** Ayah-1 second words shared by many surahs (يايها الناس). UniqueHits must not use them. */
const SHARED_AYAH1_SECONDS = new Set([
  'الناس', 'alnnas', 'ايها', 'يايها', 'الذين', 'الذي', 'huwa', 'هو',
]);

/**
 * Ultra-common tokens that must never confirm a rival ayah-2 (Ikhlas هو الله
 * must not unlock Imran 3:2 / Ibrahim 14:2 and then paint muqattaʿāt ayah 1).
 */
const WEAK_OPENING_CONFIRM_TOKENS = new Set([
  'هو', 'huwa', 'لا', 'الا', 'اله', 'ان', 'إن', 'ما', 'من', 'في', 'على', 'له',
  'هذا', 'هذه', 'اولئك', 'ذلك', 'تلك', 'او', 'أم', 'ام', 'عن', 'مع', 'قد',
  'ilah', 'illa', 'alladhi', 'alladhina',
]);

function isFormulaBodyToken(word: string): boolean {
  const token = compact(word);
  if (isAmbiguousAdvanceOpening(token) || isSharedBasmalaToken(token)) return true;
  return FORMULA_BODY_TOKENS.has(token);
}

function isWeakOpeningConfirmToken(word: string): boolean {
  const token = foldArabicLetters(word);
  if (!token) return true;
  if (isFormulaBodyToken(token) || isAmbiguousAdvanceOpening(token) || isSharedBasmalaToken(token)) {
    return true;
  }
  if (WEAK_OPENING_CONFIRM_TOKENS.has(token) || WEAK_OPENING_CONFIRM_TOKENS.has(compact(word))) {
    return true;
  }
  // Two-letter CTC crumbs are never ayah-2 evidence.
  return token.length <= 2;
}

function stemKey(word: string): string {
  return stripProclitics(word);
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
  const heard = collapseMaddRuns(compact(token));
  if (!heard) return false;
  return verseWords.some((word) => {
    const expected = collapseMaddRuns(compact(word));
    if (!expected) return false;
    if (wordsMatch(heard, expected) || relatedStem(heard, expected)) return true;
    const a = stripProclitics(heard);
    const b = stripProclitics(expected);
    if (a.length < 3 || b.length < 3) return false;
    return a.startsWith(b) || b.startsWith(a) || a.endsWith(b) || b.endsWith(a);
  });
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
  if (left === right || wordsMatch(left, right) || openingCousin(left, right) || cliticTokenMatch(left, right)) {
    return true;
  }
  const a = stripProclitics(left);
  const b = stripProclitics(right);
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
  return recognized.filter((token) => !tokenExplainedBy(token, verseWords));
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

function isShortHandoffOpening(verse: QuranVerse): boolean {
  if (verse.ayah > 2) return false;
  const words = openingBodyWords(verse);
  if (!words.length || words.length > HANDOFF_OPENING_MAX_WORDS) return false;
  if (words.length === 1 && compact(words[0]!).length > 12) return false;
  return true;
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
  private mismatchStartedAt: number | null = null;
  private lock: QuranVerse | null = null;
  /** Ayah held when grace dropped lock; bounds same-surah reacquire scoring. */
  private lastLockedRef: VerseRef | null = null;
  private priorSurah: number | null = null;
  private wordIndex = -1;
  private queueTimings: FeedTimings = {};
  private bodyPrefixCounts: Map<string, number> | null = null;
  private alignPrefixCounts: Map<string, number> | null = null;
  private ayah1SecondCounts: Map<string, number> | null = null;
  /** Ayah 1 (ayah 2 when ayah 1 is solely the opening Basmala) for every surah in the DB. */
  private quranOpenings: QuranVerse[] = [];
  private openingIndex: QuranOpeningEntry[] | null = null;
  /** Shared-prefix openings waiting for a divergent token (قل اعوذ برب, الحمد لله). */
  private openingForks: QuranVerse[] = [];
  /** One-word / short-syllable opening waiting for the next confirming frame. */
  private pendingShortOpening: string | null = null;
  private pendingShortHop = -1;
  private hopId = 0;
  private trimmedForShortLast = false;
  /** Exact muqattaʿāt tokens heard during this acquire (الم / letter names).
   * A later 2:2-dominated CTC decode must not erase them. */
  private heardMuqattaatTokens: string[] = [];
  private lastGlobalSearchAt = 0;
  private lastGlobalSearchMs = 0;
  /** Last-ayah drop: stay in Next-surah pool instead of a 2s mushaf scan. */
  private handoffWait = false;
  private debugAsr = '';
  private debugInferenceMs = 0;
  private debugMatchMs = 0;
  private debugBufferMs = 0;
  private debugLocateMs = 0;
  private debugMatchStarted: number | null = null;
  private debugCandidate: VerseRef | null = null;
  private debugScore: number | null = null;
  private debugSearchSpace = 'Global Search';
  private readonly transcribe: TranscribeFn;
  private commitState: CommitControllerState = freshCommitState();
  private tokenStats: TokenDocumentStats | null = null;
  private lastFeedVoicedMs = 0;
  private lastHopVoicedMs = 0;
  private trackState: TrackConfidenceState = freshTrackConfidence();
  private debugMargin: number | null = null;
  private debugLocationConfidence: number | null = null;
  private debugTrackConfidence: number | null = null;
  private reacquireDenyStreak = 0;

  constructor(private readonly db: QuranDB, transcribe: TranscribeFn | TilawaSession) {
    this.transcribe = typeof transcribe === 'function' ? transcribe : engineFromSession(transcribe);
  }

  reset(): void {
    this.phase = 'acquiring';
    this.window = new Float32Array(0);
    this.fresh = 0;
    this.mismatches = 0;
    this.mismatchStartedAt = null;
    this.lock = null;
    this.lastLockedRef = null;
    this.priorSurah = null;
    this.wordIndex = -1;
    this.queueTimings = {};
    this.bodyPrefixCounts = null;
    this.alignPrefixCounts = null;
    this.ayah1SecondCounts = null;
    this.openingForks = [];
    this.pendingShortOpening = null;
    this.pendingShortHop = -1;
    this.hopId = 0;
    this.trimmedForShortLast = false;
    this.heardMuqattaatTokens = [];
    this.lastGlobalSearchAt = 0;
    this.lastGlobalSearchMs = 0;
    this.handoffWait = false;
    this.lastHeardTokens = [];
    this.debugAsr = '';
    this.debugInferenceMs = 0;
    this.debugMatchMs = 0;
    this.debugBufferMs = 0;
    this.debugLocateMs = 0;
    this.debugMatchStarted = null;
    this.debugCandidate = null;
    this.debugScore = null;
    this.debugSearchSpace = 'Global Search';
    this.commitState = freshCommitState();
    this.tokenStats = null;
    this.lastFeedVoicedMs = 0;
    this.lastHopVoicedMs = 0;
    this.trackState = freshTrackConfidence();
    this.debugMargin = null;
    this.debugLocationConfidence = null;
    this.debugTrackConfidence = null;
    this.reacquireDenyStreak = 0;
    resetDebugHud();
  }

  private ensureTokenStats(): TokenDocumentStats {
    if (!this.tokenStats) this.tokenStats = new TokenDocumentStats(this.db);
    return this.tokenStats;
  }

  private trackingMode(): 'locating' | 'following' | 'reacquiring' {
    if (this.phase === 'following') return 'following';
    if (this.phase === 'reacquiring') return 'reacquiring';
    return 'locating';
  }

  private commitKindFor(verse: QuranVerse): CommitKind {
    if (this.phase === 'reacquiring') {
      // Mid-surah audio after a grace drop: same-surah commits use sequential
      // policy, not the cross-surah reacquire gate (reacquire_mid_ayah).
      if (this.priorSurah != null && verse.surah === this.priorSurah) return 'same_surah_jump';
      return 'reacquire';
    }
    if (!this.lock) return 'cold_acquire';
    if (this.lock.surah === verse.surah) {
      const next = this.db.getNextVerse(this.lock.surah, this.lock.ayah);
      if (next && next.surah === verse.surah && next.ayah === verse.ayah) return 'sequential_next';
      return 'same_surah_jump';
    }
    return 'cross_surah_handoff';
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
    this.lastHopVoicedMs = Math.round((samples.length / SAMPLE_RATE) * 1000);
    if (timings.voicedMs != null) this.lastFeedVoicedMs = timings.voicedMs;
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
    const messages = this.phase === 'following' ? await this.follow() : await this.acquire();
    this.emitDebugHud();
    return messages;
  }

  private noteProcessedBuffer(audio: Float32Array): void {
    this.debugBufferMs = Math.round((audio.length / SAMPLE_RATE) * 1000);
  }

  private noteInference(result: TranscribeResult): void {
    this.debugAsr = result.text.trim();
    this.debugInferenceMs = (result.timings?.onnxMs ?? 0) + (result.timings?.decodeMs ?? 0);
    this.debugLocateMs = result.timings?.locateMs ?? 0;
    this.debugMatchStarted = Date.now();
  }

  private noteCandidate(ref: VerseRef | null, score: number | null): void {
    this.debugCandidate = ref;
    this.debugScore = score;
  }

  private lockedSearchSpace(lock: QuranVerse): string {
    const last = this.db.getSurah(lock.surah).at(-1)?.ayah ?? lock.ayah;
    const start = Math.max(1, lock.ayah - FOLLOW_WINDOW_BEHIND);
    const end = Math.min(last, lock.ayah + FOLLOW_WINDOW_AHEAD);
    return formatSearchSpace({
      phase: 'following',
      lock: { surah: lock.surah, ayah: lock.ayah },
      previousAyah: start,
      nextAyah: end,
      globalLocate: false,
      nextSurahPool: false,
    });
  }

  private closeMatchTimer(): void {
    if (this.debugMatchStarted == null) return;
    this.debugMatchMs = Date.now() - this.debugMatchStarted + this.debugLocateMs;
    this.debugMatchStarted = null;
  }

  private emitDebugHud(): void {
    this.closeMatchTimer();
    const lock = this.lock ? { surah: this.lock.surah, ayah: this.lock.ayah } : null;
    let candidate = this.debugCandidate;
    if (lock && candidate && candidate.surah === lock.surah && candidate.ayah === lock.ayah) {
      const next = this.db.getNextVerse(lock.surah, lock.ayah);
      candidate = next ? { surah: next.surah, ayah: next.ayah } : null;
    }
    const searchSpace = this.phase === 'following' && this.lock && this.debugSearchSpace !== 'Global Search'
      && this.debugSearchSpace !== 'Next-surah pool'
      ? this.lockedSearchSpace(this.lock)
      : this.debugSearchSpace;
    const snapshot: DebugHudSnapshot = {
      partialAsr: this.debugAsr,
      inferenceMs: this.debugInferenceMs,
      matchMs: this.debugMatchMs,
      bufferMs: this.debugBufferMs,
      lock,
      candidate,
      matchScore: this.debugScore,
      searchSpace,
      phase: this.phase,
      mode: formatDebugHudMode({ phase: this.phase, searchSpace, lock }),
      misses: this.mismatches,
      missThreshold: LOCK_GRACE_FAILS,
      candidateMargin: this.debugMargin,
      locationConfidence: this.debugLocationConfidence,
      trackConfidence: this.debugTrackConfidence,
      unsupportedVoicedMs: this.commitState.unsupportedVoicedMs,
    };
    publishDebugHud(snapshot);
  }

  private championRunnerUpTotal(match: QuranChampionMatch, recognized: string[]): number | undefined {
    const rival = match.runners_up?.[0];
    if (!rival) return undefined;
    const from = this.lock ? { surah: this.lock.surah, ayah: this.lock.ayah } : null;
    const stats = this.ensureTokenStats();
    return scoreCandidate(
      rival.score,
      recognized,
      stats,
      from,
      { surah: rival.surah, ayah: rival.ayah },
      this.trackingMode(),
    ).total;
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
    // Follow / post-lock handoff must not run a synchronous mushaf scan.
    // Missed salah-pool openings wait on the next packet as Next-surah pool.
    if (this.phase === 'following' || this.handoffWait) return null;
    // Reacquire stays on the 114-openings index — never block the audio loop on 6k ayahs.
    if (this.phase === 'reacquiring') return null;
    const recognized = result.text.trim().split(/\s+/).filter(Boolean);
    if (!this.allowsPostLockGlobalSearch(recognized, result.text)) return null;
    if (!this.allowThrottledGlobalSearch()) return null;
    const started = Date.now();
    this.lastGlobalSearchAt = started;
    const match = this.db.bestJoint03Match(result.text.trim());
    this.lastGlobalSearchMs = Date.now() - started;
    return match;
  }

  private matchFromTranscript(result: TranscribeResult, allowSearch: boolean): QuranChampionMatch | null {
    const raw = this.rawMatch(result, allowSearch);
    return raw ? rerankChampion(raw, this.priorSurah) : null;
  }

  private async acquire(): Promise<RecognitionMessage[]> {
    if (this.window.length < samplesFor(ACQUIRE_MIN_SEC) || this.fresh < samplesFor(ACQUIRE_MIN_SEC)) return [];
    this.fresh = 0;
    this.hopId += 1;
    this.noteProcessedBuffer(this.window);
    // Cold first-lock uses native engine locate (main behavior) so short
    // openings such as والعصر / الله الصمد emit a champion. After a lock,
    // reacquire and follow stay transcribe(..., false) so the audio loop
    // never blocks on 6,236 ayahs.
    const coldFirstLock = this.phase === 'acquiring' && this.priorSurah == null;
    const local = await this.transcribe(this.window, coldFirstLock);
    this.noteCycle(local, coldFirstLock);
    this.noteHeardTokens(local.text);
    this.noteInference(local);
    const text = local.text.trim();
    const recognized = text.split(/\s+/).filter(Boolean).map((token) => collapseMaddRuns(token));
    const fromSurah = this.priorSurah ?? 1;
    if (recognized.length) {
      this.debugSearchSpace = 'Next-surah pool';
      const opening = this.lockShortSurahOpening(recognized, text, fromSurah);
      const champion = local.championMatch;
      if (process.env.ZIKRIST_TRACE === '1') {
        console.log(JSON.stringify({
          kind: 'acquire_pool',
          phase: this.phase,
          windowSec: Math.round((this.window.length / SAMPLE_RATE) * 100) / 100,
          text,
          opening: opening ? `${opening.surah}:${opening.ayah}` : null,
          champion: champion ? `${champion.surah}:${champion.ayah}@${Math.round(champion.score * 100) / 100}` : null,
        }));
      }
      // Native locate on Basmala/Fatiha often names a distant mid-surah.
      // On cold first-lock, only let that block openings if the champion can lock.
      let midSurahChampion = Boolean(champion && champion.ayah > 2);
      if (midSurahChampion && coldFirstLock && champion) {
        const championVerse = this.db.getVerse(champion.surah, champion.ayah);
        midSurahChampion = Boolean(
          championVerse && this.canLock(champion, championVerse, text, recognized)
        );
      }
      const shortCold = this.priorSurah == null && this.window.length <= samplesFor(3);
      const thinOpening = (verse: QuranVerse) => {
        const body = openingBodyWords(verse);
        return body.length <= 1 && !openingEntropyReady(body);
      };
      if (
        opening
        && opening.ayah <= 2
        && !midSurahChampion
        && (shortCold || this.priorSurah != null || !thinOpening(opening))
        && (this.priorSurah == null || isShortHandoffOpening(opening))
      ) {
        const laterSameSurah = Boolean(
          champion
          && champion.surah === opening.surah
          && champion.ayah > opening.ayah,
        );
        if (!laterSameSurah) {
          const score = Math.max(
            this.shortOpeningTokenMatch(recognized, opening),
            this.locationScore(text, opening),
          );
          this.noteCandidate({ surah: opening.surah, ayah: opening.ayah }, score);
          return this.commit(
            opening,
            score,
            this.alignForCommit(recognized, opening),
            this.handoffCommitMeta(recognized, text, opening, fromSurah),
          );
        }
      }
      const pooled = this.lockFromNextSurahPool(text, recognized, fromSurah, { openingsOnly: true });
      if (
        pooled
        && pooled.ayah <= 2
        && !midSurahChampion
        && (shortCold || this.priorSurah != null || !thinOpening(pooled))
        && (this.priorSurah == null || isShortHandoffOpening(pooled))
        && this.surahSwitchReady(recognized, text, pooled)
      ) {
        const score = this.locationScore(text, pooled);
        this.noteCandidate({ surah: pooled.surah, ayah: pooled.ayah }, score);
        return this.commit(
          pooled,
          score,
          this.alignForCommit(recognized, pooled),
          this.handoffCommitMeta(recognized, text, pooled, fromSurah),
        );
      }
      if (this.phase === 'reacquiring' && this.priorSurah != null) {
        const sameSurah = this.reacquireSameSurahMatch(recognized, text);
        if (sameSurah.some((message) => message.type === 'verse_match')) return sameSurah;
      }
    }
    const recovered = await this.recoverOpeningMuqattaat(local);
    if (recovered) return recovered;
    const localLock = this.lockFromTranscript(local, false);
    if (localLock.some((message) => message.type === 'verse_match')) return localLock;
    // Never a second transcribe(..., true) on this hop. Cold first-lock already
    // located above. After a lock, or while shared-prefix openings are still
    // co-candidates, wait in the openings index — do not synchronously scan
    // 6,236 ayahs (Match spike). Post-lock Global Search is only for long
    // mid-ayah recovery windows; short formula leftovers stay on the
    // 114-openings index.
    const waitingFork = this.openingForks.length > 0;
    const allowSearch = !local.locateAttempted
      && !this.handoffWait
      && !waitingFork
      && this.globalSearchTranscriptOk(recognized, text)
      && this.allowsPostLockGlobalSearch(recognized, text);
    if (!allowSearch) {
      if (this.handoffWait || waitingFork || this.priorSurah != null) {
        this.debugSearchSpace = 'Next-surah pool';
      }
      return localLock;
    }
    this.debugSearchSpace = 'Global Search';
    const searchInput = local.championMatch
      ? { ...local, championMatch: undefined }
      : local;
    return this.lockFromTranscript(searchInput, true);
  }

  /** When a long first-lock window’s CTC names ayah 2+, the older half may
   * still contain الم that the mixed decode dropped. Look back before
   * committing 2:2. Reacquire stays 4 s and does not look back. */
  private async recoverOpeningMuqattaat(result: TranscribeResult): Promise<RecognitionMessage[] | undefined> {
    if (this.phase !== 'acquiring') return undefined;
    if (this.window.length <= samplesFor(ACQUIRE_MAX_SEC) + samplesFor(0.5)) return undefined;
    const raw = result.championMatch;
    // Only the 2:2 mixed-window case. Mid-surah champions (36:16) must not
    // look back for a stray الم and steal 2:1.
    if (!raw || raw.ayah !== 2) return undefined;
    const opening = this.db.getVerse(raw.surah, 1);
    if (!opening || !isExactMuqattaatAyah1(opening)) return undefined;
    const current = result.text.trim().split(/\s+/).filter(Boolean);
    if (this.heardExactMuqattaat(this.acquireEvidence(current))) return undefined;
    const olderSec = (this.window.length / SAMPLE_RATE) - LOOKBACK_DROP_SEC;
    if (olderSec < ACQUIRE_MIN_SEC) return undefined;
    const lookbackAudio = keepFirst(this.window, olderSec);
    this.noteProcessedBuffer(lookbackAudio);
    const lookback = await this.transcribe(lookbackAudio, false);
    this.noteInference(lookback);
    const recovered = this.lockFromTranscript(lookback, false);
    const match = recovered.find((message) => message.type === 'verse_match');
    if (!match || match.type !== 'verse_match' || match.ayah !== 1) return undefined;
    if (match.surah !== raw.surah) return undefined;
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
    this.noteCandidate({ surah: ranked.surah, ayah: ranked.ayah }, ranked.score);
    if (allowSearch) this.debugSearchSpace = 'Global Search';
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
        if (!this.allowsSurahSwitch(chosen)) continue;
        return this.commit(chosen, match.score, this.alignForCommit(evidence, chosen), {
          ...this.handoffCommitMeta(evidence, text, chosen, this.priorSurah ?? 1),
          runnerUpTotal: this.championRunnerUpTotal(match, evidence),
        });
      }
      const alternative = this.alternativeHeardVerse(evidence, text, ranked);
      if (alternative && !this.sameRef(alternative, ignore)) {
        const chosen = this.preferCanonicalDuplicate(alternative, text);
        if (!this.sameRef(chosen, ignore) && this.allowsHandoffVerse(chosen, evidence) && this.allowsSurahSwitch(chosen)) {
          return this.commit(
            chosen,
            this.locationScore(text, chosen),
            this.alignForCommit(evidence, chosen),
            this.handoffCommitMeta(evidence, text, chosen, this.priorSurah ?? 1),
          );
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
      if (!this.heardIsolatedMuqattaatBody(recognized, token)) continue;
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
    if (!this.allowsSurahSwitch(chosen)) return undefined;
    return this.commit(
      chosen,
      match.score,
      this.alignForCommit(recognized, chosen),
      this.handoffCommitMeta(recognized, text, chosen, this.priorSurah ?? 1),
    );
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
    // The last ayah of a surah is the acquire boundary for the next surah. Its
    // opening (قل اعوذ برب الناس vs قل اعوذ برب الفلق) only resolves once the
    // distinctive word lands in the same window as the shared prefix, so keep
    // a cold-acquire-sized window instead of 1.2 s follow slices.
    if (this.atSurahEnd(this.lock)) return FOLLOW_SURAH_END_ACCUMULATE_SEC;
    return this.shortLastAyahFollow(this.lock) ? FOLLOW_LAST_AYAH_ACCUMULATE_SEC : FOLLOW_WINDOW_SEC;
  }

  /** True when `current` is the last ayah of its surah (or of the mushaf). */
  private atSurahEnd(current: QuranVerse): boolean {
    const next = this.db.getNextVerse(current.surah, current.ayah);
    return !next || next.surah !== current.surah;
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
   * must not default to 2:1. Common words (هو الله) never count as الم. */
  private allowsHandoffVerse(verse: QuranVerse, recognized: string[], hopTokens: string[] = recognized): boolean {
    if (this.priorSurah == null) return true;
    const token = this.handoffMuqattaatToken(verse);
    if (!token) return true;
    const body = recognized.filter((word) => !OPENING_BASMALA_TOKENS.has(compact(word)));
    if (heardMuqattaatSpelling(recognized, token)) {
      return body.length > 0 && body.every((word) => Boolean(namedMuqattaatLetter(word)));
    }
    if (!this.heardIsolatedMuqattaatBody(body, token) && !this.heardIsolatedMuqattaatBody(recognized, token)) {
      return false;
    }
    // The hop (not just the leftover query) decides whether الم is real speech.
    // Words of the ayah we are locked on that come *after* الم mean the
    // recitation is still inside that ayah and الم is madd garble (الم من الجن
    // inside 114:6). The tail of the last ayah *before* الم (الضالين الم) is fine.
    // Checked on the raw hop: الله after الم inside 4:131 (الم كتاب الله) is the
    // ayah's own word, not a Basmala token to drop.
    if (this.currentAyahContinuesAfterBody(hopTokens, token)) return false;
    const hop = hopTokens.filter((word) => !OPENING_BASMALA_TOKENS.has(compact(word)));
    const companions = this.independentMuqattaatCompanions(hop, token, verse);
    // Lone الم after noise must not auto-display while reacquiring (Naml CTC).
    if (body.length === 1 && compact(body[0]!) === token) {
      if (this.phase === 'reacquiring') return false;
      return companions.some((word) => compact(word).length >= 3);
    }
    // Fatiha leftover + الم is fine (long companions). Short CTC crumbs beside
    // الم (الي / الل / لم ي) are not — including single letter-name glyphs that
    // appear in Ikhlas CTC (الم لم ي). Full الف لام ميم already returned above.
    return companions.some((word) => compact(word).length >= 4);
  }

  /**
   * Hop tokens that independently prove الم was spoken as a new surah.
   * Excluded: the body itself; tokens that start with it (المصدر beside المي —
   * the same madd garble of والناس); and words of the mushaf-next surah's
   * opening (الناس after Falaq 113:5), which argue for that surah instead.
   */
  private independentMuqattaatCompanions(hop: string[], token: string, verse: QuranVerse): string[] {
    const expectedOpening = this.expectedNextSurahOpeningWords(verse);
    return hop.filter((word) => {
      const text = compact(word);
      if (!text || text === token || text.startsWith(token)) return false;
      return !expectedOpening.some((expected) => wordsMatch(word, expected) || cliticTokenMatch(word, expected));
    });
  }

  /** True when a word of the current (or last-locked) ayah is heard after the
   * muqattaʿāt body token — the reciter is still inside that ayah. */
  private currentAyahContinuesAfterBody(body: string[], token: string): boolean {
    const from = this.lock ?? (this.lastLockedRef ? this.db.getVerse(this.lastLockedRef.surah, this.lastLockedRef.ayah) : undefined);
    if (!from) return false;
    const at = body.findIndex((word) => heardIsolatedBodyToken([word], token));
    if (at < 0) return false;
    const currentWords = verseAlignWords(from).words.filter((word) => compact(word).length >= 3);
    return body.slice(at + 1).some((word) => (
      compact(word).length >= 3
      && currentWords.some((expected) => softTokenMatch(word, expected) || sameConsonantSkeleton(word, expected))
    ));
  }

  /** Body words of the surah opening that follows the current / last lock in
   * the mushaf, unless `target` is that opening itself. */
  private expectedNextSurahOpeningWords(target: QuranVerse): string[] {
    const from = this.lock ?? this.lastLockedRef;
    if (!from) return [];
    const next = this.db.getNextVerse(from.surah, from.ayah);
    if (!next || next.surah === from.surah || next.surah === target.surah) return [];
    return openingBodyWords(next);
  }

  private handoffMuqattaatToken(verse: QuranVerse): string | undefined {
    const body = openingBodyWords(verse);
    if (body.length === 1 && isStandardMuqattaatBody(body[0]!)) return compact(body[0]!);
    if (isExactMuqattaatAyah1(verse)) return compact(verseAlignWords(verse).words[0] ?? '');
    const letters: string[] = [];
    for (const word of body) {
      const letter = namedMuqattaatLetter(word);
      if (!letter) return undefined;
      letters.push(letter);
    }
    const joined = letters.join('');
    return joined && STANDARD_MUQATTAAT_BODIES.has(joined) ? joined : undefined;
  }

  private voicedDeltaMs(): number {
    const fromClock = this.lastFeedVoicedMs - this.commitState.lastVoicedMs;
    if (fromClock > 0) return fromClock;
    return this.lastHopVoicedMs;
  }

  private noteTrackUncertainty(countWeakHop: boolean, pauseUnsupportedVoiced = false): void {
    if (countWeakHop) {
      this.mismatches++;
      if (this.mismatchStartedAt == null) this.mismatchStartedAt = Date.now();
    }
    const delta = this.voicedDeltaMs();
    if (delta > 0 && countWeakHop && !pauseUnsupportedVoiced) {
      noteUnsupportedVoiced(this.commitState, delta);
    }
  }

  private noteTrackContradiction(): void {
    this.mismatches++;
    if (this.mismatchStartedAt == null) this.mismatchStartedAt = Date.now();
    const delta = this.voicedDeltaMs();
    if (delta > 0) noteUnsupportedVoiced(this.commitState, delta * 1.25);
  }

  private clearMismatch(): void {
    this.mismatches = 0;
    this.mismatchStartedAt = null;
    noteCredibleSupport(this.commitState);
  }

  private credibleFollowSupport(
    tape: { holdsLock: boolean; nextHeard: boolean; nextInProgress: boolean; nextHits: number; nextTotal: number },
    advanced: boolean,
    sharedPrefixOnly: boolean,
    mushafNextSequential: boolean,
    heardNext: boolean,
  ): boolean {
    if (mushafNextSequential && (
      tape.nextHeard
      || tape.nextInProgress
      || (tape.nextTotal > 0 && tape.nextHits >= tape.nextTotal)
    )) {
      return true;
    }
    return Boolean(
      (tape.holdsLock || (advanced && !sharedPrefixOnly) || tape.nextHeard || tape.nextInProgress)
      && !sharedPrefixOnly,
    );
  }

  private shortOpeningPeeksConfirmed(verse: QuranVerse): boolean {
    const key = `${verse.surah}:${verse.ayah}`;
    return this.pendingShortOpening === key && this.pendingShortHop !== this.hopId;
  }

  private confirmShortOpening(verse: QuranVerse): boolean {
    const key = `${verse.surah}:${verse.ayah}`;
    if (this.shortOpeningPeeksConfirmed(verse)) {
      this.pendingShortOpening = null;
      this.pendingShortHop = -1;
      return true;
    }
    this.pendingShortOpening = key;
    this.pendingShortHop = this.hopId;
    return false;
  }

  private clearOpeningWait(): void {
    this.openingForks = [];
    this.pendingShortOpening = null;
    this.pendingShortHop = -1;
  }

  /** Drop lock after sustained contradictory evidence (not mere ASR uncertainty). */
  private lockGraceExpired(): boolean {
    return trackLost(
      this.trackState,
      this.commitState.unsupportedVoicedMs,
      TRACK_UNSUPPORTED_VOICED_MS,
      LOCK_GRACE_FAILS,
      LOCK_GRACE_MS,
      this.mismatchStartedAt,
      this.mismatches,
    );
  }

  /** Cross-surah hops start at ayah 1, or ayah 2 only when ayah 1 is unusable Basmala. */
  private allowsSurahSwitch(verse: QuranVerse): boolean {
    if (this.priorSurah == null || verse.surah === this.priorSurah) return true;
    if (verse.ayah === 1) return true;
    if (verse.ayah === 2) {
      const first = this.db.getVerse(verse.surah, 1);
      if (!first) return true;
      return skipUnusableLock(first);
    }
    return false;
  }

  private twoContiguousOpeningWords(recognized: string[], verse: QuranVerse): boolean {
    const { words } = verseAlignWords(verse);
    if (words.length < 2) return false;
    const aligned = this.switchAlignFromOpening(recognized, words);
    return aligned.length >= 2 && aligned[0] === 0 && aligned.includes(1);
  }

  /** والليل / والضحى / والعصر must be heard as the opening, not a بالصبر cousin. */
  private oathOpeningMismatch(recognized: string[], verse: QuranVerse): boolean {
    const { words } = verseAlignWords(verse);
    const opening = words[0];
    if (!opening || opening[0] !== 'و' || compact(opening).length < 5) return false;
    const bodyHeard = bodyHeardTokens(recognized);
    return !bodyHeard.some((word) => (
      this.switchOpeningMatch(word, opening)
      || openingWordMatch(word, opening)
      || cliticTokenMatch(word, opening)
      || wordsMatch(word, opening, 0.8)
    ));
  }

  /** Prefixed CTC cousins (بايلاف / لايلاف / ايلاف) still count as the ayah-1 opening. */
  private switchOpeningMatch(heard: string, expected: string): boolean {
    const body = compact(expected);
    if (body.length <= 2) {
      return compact(heard) === body || stripProclitics(heard) === stripProclitics(expected);
    }
    // Muqattaʿāt must not cousin-match المصدر→المص or الله→الم.
    if (shortAyah1Body(body) && isStandardMuqattaatBody(body)) {
      return this.heardIsolatedMuqattaatBody([heard], body);
    }
    if (muqattaatOpeningHomophone(heard, expected)) return true;
    if (openingWordMatch(heard, expected) || openingCousin(heard, expected) || cliticTokenMatch(heard, expected)) {
      return true;
    }
    if (foldArabicLetters(compact(heard)) === foldArabicLetters(body)) return true;
    return compact(heard).length >= 4 && body.length >= 4 && wordsMatch(heard, expected, 0.85);
  }

  /** CTC cousins such as بايلاف / لايلاف still count as the ayah-1 opening. */
  private switchAlignFromOpening(recognized: string[], verseWords: string[]): number[] {
    if (!verseWords.length || !recognized.length) return [];
    const from = leadingBasmalaWords(recognized);
    let start = -1;
    for (let index = from; index < recognized.length; index++) {
      const heard = recognized[index]!;
      if (this.switchOpeningMatch(heard, verseWords[0]!)) {
        start = index;
        break;
      }
    }
    if (start < 0) return [];
    const matched = [0];
    let expected = 1;
    for (let spoken = start + 1; spoken < recognized.length && expected < verseWords.length; spoken++) {
      const heard = recognized[spoken]!;
      const word = verseWords[expected]!;
      if (
        confirmedSwitchWord(heard, word)
        || cliticTokenMatch(heard, word)
        || shortWordVariant(heard, word)
      ) {
        matched.push(expected);
        expected += 1;
        continue;
      }
      const following = verseWords[expected + 1];
      if (following && mergedPairMatch(heard, word, following)) {
        matched.push(expected, expected + 1);
        expected += 2;
        continue;
      }
      const confirm = (h: string, w: string) => confirmedSwitchWord(h, w) || cliticTokenMatch(h, w);
      if (garbledWordSkip(heard, word, recognized[spoken + 1], following, confirm)) {
        matched.push(expected + 1);
        expected += 2;
        spoken += 1;
      }
    }
    return matched;
  }

  /** New surah: two aligned body words, 7 aligned characters, ayah-2 confirmation,
   * or a second consecutive frame of a short opening. Shared prefixes stay forked. */
  /** Last-ayah / weak-hop cross-surah pool commits (e.g. Fatiha → Baqarah). */
  private trailingCrossSurahHandoffReady(
    recognized: string[],
    query: string[],
    queryText: string,
    target: QuranVerse,
    fromSurah: number,
  ): boolean {
    if (target.surah === fromSurah) return true;
    if (target.ayah > 2) return false;
    if (!this.surahSwitchReady(query, queryText, target)) return false;
    if (this.locationScore(queryText, target) < CROSS_SURAH_ENTER) return false;
    const muqattaat = this.handoffMuqattaatToken(target);
    if (muqattaat && !this.heardMuqattaatEvidence(recognized, muqattaat)) return false;
    return true;
  }

  private surahSwitchReady(recognized: string[], text: string, verse: QuranVerse): boolean {
    if (verse.ayah > 2) return false;
    const bodyWords = openingBodyWords(verse);
    if (!bodyWords.length) return false;
    const bodyHeard = bodyHeardTokens(recognized);
    if (!bodyHeard.length) return false;
    if (this.onlySharedOpeningInPool(bodyHeard, verse) || this.onlySharedOpeningInPool(recognized, verse)) return false;
    if (this.oathOpeningMismatch(bodyHeard, verse)) return false;
    const aligned = this.switchAlignFromOpening(bodyHeard, bodyWords);
    const alignedTokens = aligned.map((index) => bodyWords[index]!);
    const twoContiguous = aligned.length >= 2 && aligned[0] === 0 && aligned.includes(1);
    if (twoContiguous) return true;
    if (aligned.length >= 1 && aligned[0] === 0 && openingEntropyReady(alignedTokens)) return true;
    // Last-ayah CTC may garble word 0 while the unique second opening word is intact.
    const second = bodyWords[1];
    if (
      this.priorSurah != null
      && verse.surah !== this.priorSurah
      && bodyHeard.length >= 2
      && second
      && compact(second).length >= 4
      && !isAmbiguousAdvanceOpening(second)
      && !isFormulaBodyToken(second)
      && !isSharedBasmalaToken(second)
      && second !== 'huwa'
      && second !== 'هو'
      && !SHARED_AYAH1_SECONDS.has(compact(second))
        && !namedMuqattaatLetter(second)
        && (this.ensureAyah1SecondCounts().get(compact(second)) ?? 0) < 2
    ) {
      const hit = bodyHeard.some((token) => {
        const heard = compact(token);
        const expected = compact(second);
        if (heard.length < 4) return false;
        if (confusableBodyToken(heard, expected)) return false;
        return heard === expected || wordsMatch(heard, expected, 0.85);
      });
      if (hit) return true;
    }
    if (this.priorSurah != null && verse.surah !== this.priorSurah) {
      return this.oneWordSwitchReady(recognized, text, verse, bodyHeard, bodyWords, alignedTokens);
    }
    if (bodyWords.length === 1 && shortAyah1Body(bodyWords[0]!) && isStandardMuqattaatBody(bodyWords[0]!)) {
      if (!this.heardMuqattaatEvidence(recognized, bodyWords[0]!)) return false;
      return Math.max(this.locationScore(bodyHeard.join(' '), verse), this.locationScore(text, verse)) >= HANDOFF_OPENING_SCORE;
    }
    if (bodyWords.length === 1 && shortAyah1Body(bodyWords[0]!) && heardIsolatedBodyToken(bodyHeard, bodyWords[0]!)) {
      if (this.priorSurah != null && verse.surah !== this.priorSurah) {
        return this.oneWordSwitchReady(recognized, text, verse, bodyHeard, bodyWords, alignedTokens);
      }
      return Math.max(this.locationScore(bodyHeard.join(' '), verse), this.locationScore(text, verse)) >= HANDOFF_OPENING_SCORE;
    }
    if (!aligned.length || aligned[0] !== 0) return false;
    return this.locationScore(bodyHeard.join(' '), verse) >= HANDOFF_OPENING_SCORE
      && this.shortOpeningTokenMatch(bodyHeard, verse) >= HANDOFF_OPENING_SCORE;
  }

  /** Short ayah-1 bodies need ayah-2 entropy, 7 aligned characters, or the next frame. */
  private oneWordSwitchReady(
    recognized: string[],
    text: string,
    verse: QuranVerse,
    bodyHeard: string[],
    bodyWords: string[],
    alignedTokens: string[] = [],
  ): boolean {
    if (openingEntropyReady(alignedTokens)) return true;
    const muqattaat = bodyWords[0] && isStandardMuqattaatBody(bodyWords[0]) ? compact(bodyWords[0]) : '';
    if (muqattaat) {
      // Common words (هو الله) must never stand in for الم / الر. Require the
      // isolated body or recited letter names before any ayah-2 shortcut.
      if (
        !this.heardIsolatedMuqattaatBody(bodyHeard, muqattaat)
        && !heardMuqattaatSpelling(recognized, muqattaat)
      ) {
        return false;
      }
      return Math.max(this.locationScore(bodyHeard.join(' '), verse), this.locationScore(text, verse)) >= HANDOFF_OPENING_SCORE;
    }
    const ayah2 = this.db.getVerse(verse.surah, 2);
    if (ayah2 && this.ayah2OpeningConfirmed(recognized, text, ayah2)) return true;
    const expected = [
      ...bodyWords,
      ...(ayah2 ? verseAlignWords(ayah2).words : []),
    ]
      .map((word) => foldArabicLetters(word))
      .filter((word) => word.length >= 2 && !isWeakOpeningConfirmToken(word));
    const heard = bodyHeard
      .map((word) => foldArabicLetters(word))
      .filter((word) => word.length >= 2 && !isWeakOpeningConfirmToken(word));
    const hits = new Set(expected.filter((word) => heard.some((token) => confirmedSwitchWord(token, word) || cliticTokenMatch(token, word))));
    if (hits.size >= OPENING_ENTROPY_MIN_WORDS) return true;
    if (
      alignedTokens.length >= 1
      || (bodyWords[0] && heardIsolatedBodyToken(bodyHeard, bodyWords[0]))
    ) {
      if (this.shortOpeningPeeksConfirmed(verse)) return true;
      this.confirmShortOpening(verse);
      return false;
    }
    return false;
  }

  private ayah2OpeningConfirmed(recognized: string[], text: string, ayah2: QuranVerse): boolean {
    if (ayah2.ayah !== 2) return false;
    const { words } = verseAlignWords(ayah2);
    if (words.length < 2) return false;
    const bodyHeard = bodyHeardTokens(recognized);
    if (this.twoContiguousOpeningWords(bodyHeard, ayah2) || this.twoContiguousOpeningWords(recognized, ayah2)) {
      const aligned = this.switchAlignFromOpening(bodyHeard.length ? bodyHeard : recognized, words);
      const alignedTokens = aligned.map((index) => words[index]!);
      // الله لا alone is still weak; need a non-formula body word or 3 aligned tokens.
      if (alignedTokens.some((token) => !isWeakOpeningConfirmToken(token) && compact(token).length >= 3)) {
        return true;
      }
      if (aligned.length >= 3 && this.locationScore(text, ayah2) >= SEQUENTIAL_ADVANCE_SCORE) {
        return true;
      }
    }
    const heard = recognized
      .map((token) => foldArabicLetters(token))
      .filter((token) => token.length >= 3 && !isWeakOpeningConfirmToken(token));
    const expected = words
      .map((token) => foldArabicLetters(token))
      .filter((token) => token.length >= 3 && !isWeakOpeningConfirmToken(token));
    // Two distinct heard tokens must each confirm a distinct ayah-2 word. One
    // heard الناس matching both للناس and الناس inside Yunus 10:2 is one hit.
    const used = new Set<number>();
    let hits = 0;
    for (const token of new Set(heard)) {
      const index = expected.findIndex((word, at) => !used.has(at) && confirmedSwitchWord(token, word));
      if (index < 0) continue;
      used.add(index);
      hits += 1;
    }
    return hits >= 2 && this.locationScore(text, ayah2) >= SEQUENTIAL_ADVANCE_SCORE;
  }

  /** True when the window actually carries the muqattaʿāt body or its letter names. */
  private heardMuqattaatEvidence(recognized: string[], token: string): boolean {
    const body = compact(token);
    if (!body || !isStandardMuqattaatBody(body)) return false;
    const bodyHeard = bodyHeardTokens(recognized);
    return this.heardIsolatedMuqattaatBody(bodyHeard, body)
      || this.heardIsolatedMuqattaatBody(recognized, body)
      || heardMuqattaatSpelling(recognized, body);
  }

  /** Mysterious-letter bodies only when acoustically isolated — not ألم تر / ألم يجعل homophones. */
  private heardIsolatedMuqattaatBody(recognized: string[], token: string): boolean {
    if (!heardIsolatedBodyToken(recognized, token)) return false;
    if (!isStandardMuqattaatBody(token)) return true;
    const openings = this.ensureQuranOpenings().map((entry) => ({ body: entry.body }));
    if (muqattaatHomophoneContinuesRunningOpening(
      recognized,
      token,
      openings,
      (heard, expected) => this.switchOpeningMatch(heard, expected),
      (heard, words) => this.switchAlignFromOpening(heard, words),
    )) {
      return false;
    }
    return true;
  }

  private allowThrottledGlobalSearch(): boolean {
    const cooldown = this.lastGlobalSearchMs > GLOBAL_SEARCH_BUDGET_MS
      ? Math.max(GLOBAL_SEARCH_COOLDOWN_MS, this.lastGlobalSearchMs)
      : GLOBAL_SEARCH_COOLDOWN_MS;
    return Date.now() - this.lastGlobalSearchAt >= cooldown;
  }

  /** Global mushaf locate needs enough transcript to avoid short-phrase false locks. */
  private globalSearchTranscriptOk(recognized: string[], text: string): boolean {
    if (recognized.length >= GLOBAL_SEARCH_MIN_WORDS) return true;
    return compact(text).length >= GLOBAL_SEARCH_MIN_CHARS;
  }

  /**
   * After a prayer lock, short windows stay on the 114-openings index. Only a
   * long mid-ayah transcript may pay for synchronous bestJoint03Match.
   */
  private allowsPostLockGlobalSearch(recognized: string[], text: string): boolean {
    if (this.priorSurah == null) return true;
    if (this.handoffWait) return false;
    const body = bodyHeardTokens(recognized);
    if (body.length < 4) return false;
    return compact(text).length >= 16;
  }

  private followNeighborhoodRefs(lock: QuranVerse): { start: number; end: number } {
    const last = this.db.getSurah(lock.surah).at(-1)?.ayah ?? lock.ayah;
    return {
      start: Math.max(1, lock.ayah - FOLLOW_WINDOW_BEHIND),
      end: Math.min(last, lock.ayah + FOLLOW_WINDOW_AHEAD),
    };
  }

  private reacquireSameSurahBounds(surah: number): { start: number; end: number } {
    const surahLast = this.db.getSurah(surah).at(-1)?.ayah ?? 1;
    const anchor = this.lastLockedRef?.surah === surah ? this.lastLockedRef.ayah : 2;
    return {
      start: Math.max(1, anchor - REACQUIRE_SAME_SURAH_BEHIND),
      end: Math.min(surahLast, anchor + REACQUIRE_SAME_SURAH_AHEAD),
    };
  }

  private bestReacquireSameSurahInRange(
    surah: number,
    start: number,
    end: number,
    recognized: string[],
    text: string,
  ): { verse: QuranVerse; score: number } | null {
    let best: { verse: QuranVerse; score: number } | null = null;
    for (let ayah = start; ayah <= end; ayah++) {
      const verse = this.db.getVerse(surah, ayah);
      if (!verse || skipUnusableLock(verse)) continue;
      if (!this.hasVerseEvidence(text, verse, recognized)) continue;
      if (this.onlySharedOpening(recognized, verse)) continue;
      const score = this.locationScore(text, verse);
      if (score < LOCK_SCORE) continue;
      if (!best || score > best.score + 1e-9) best = { verse, score };
    }
    return best;
  }

  /** After grace drop, score a tight band around lastLockedRef, then full surah. */
  private reacquireSameSurahMatch(recognized: string[], text: string): RecognitionMessage[] {
    const surah = this.priorSurah;
    if (this.phase !== 'reacquiring' || surah == null) return [];
    const local = this.reacquireSameSurahBounds(surah);
    let best = this.bestReacquireSameSurahInRange(surah, local.start, local.end, recognized, text);
    if (!best) {
      const surahLast = this.db.getSurah(surah).at(-1)?.ayah ?? local.end;
      best = this.bestReacquireSameSurahInRange(surah, 1, surahLast, recognized, text);
    }
    if (!best) return [];
    this.debugSearchSpace = best.verse.ayah >= local.start && best.verse.ayah <= local.end
      ? `Reacquire: Surah ${surah} ±${REACQUIRE_SAME_SURAH_AHEAD}`
      : `Reacquire: Surah ${surah} (full)`;
    this.noteCandidate({ surah: best.verse.surah, ayah: best.verse.ayah }, best.score);
    // commit() trims window (KEEP_AFTER_*), clears reacquireDenyStreak, sets following.
    return this.commit(best.verse, best.score, this.alignForCommit(recognized, best.verse));
  }

  /** Score only [current-1, current+2] while sticky-locked in a surah. */
  private bestFollowNeighborhoodMatch(
    current: QuranVerse,
    text: string,
    recognized: string[],
  ): { verse: QuranVerse; score: number } | null {
    const { start, end } = this.followNeighborhoodRefs(current);
    let best: { verse: QuranVerse; score: number } | null = null;
    for (let ayah = start; ayah <= end; ayah++) {
      if (ayah === current.ayah) continue;
      const verse = this.db.getVerse(current.surah, ayah);
      if (!verse || skipUnusableLock(verse)) continue;
      if (!heardDistinct(recognized, verse, this.distinctSkip(verse, current))
        && distinctiveTokens(recognized, verseAlignWords(verse).words).length < 1) {
        continue;
      }
      const score = this.locationScore(text, verse) + LOCALITY_SURAH_BIAS;
      if (!best || score > best.score + 1e-9) best = { verse, score };
    }
    return best;
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
    this.hopId += 1;
    // Follow transcribes only. Score remainder + mushaf-next; do not locate the mushaf first.
    this.noteProcessedBuffer(this.window);
    const result = await this.transcribe(this.window, false);
    this.noteCycle(result, false);
    const recognized = result.text.trim().split(/\s+/).filter(Boolean).map((token) => collapseMaddRuns(token));
    const text = recognized.join(' ');
    this.noteHeardTokens(text);
    this.noteInference(result);
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
    const currentScore = explainScore(text, current);
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
    const ayahDone = this.ayahComplete(current);
    const parkedOnSharedTail = ayahDone && !currentOnlyHeard;
    const awaitingSequentialNext = Boolean(next && next.surah === current.surah && ayahDone);
    const neighborhood = Math.max(
      sharedPrefixOnly || (parkedOnSharedTail && !awaitingSequentialNext) ? 0 : currentScore,
      previousScore,
      heardNext || (awaitingSequentialNext && tape.nextHits > 0)
        ? Math.max(nextScore, tape.phonemeScore)
        : 0,
    );
    this.debugSearchSpace = this.lockedSearchSpace(current);
    this.noteCandidate(
      next && next.surah === current.surah ? { surah: next.surah, ayah: next.ayah } : null,
      heardNext ? nextScore : currentScore,
    );
    if (advanced) this.wordIndex = wordIndex;
    if (advanced && !sharedPrefixOnly) this.clearMismatch();
    const complete = completeThisHop;
    const stillInSurah = Boolean(next && next.surah === current.surah);
    let contradictoryLocalScore = 0;
    let contradictoryLocalMargin = 0;
    if (stillInSurah && tape.unexplainedDistinctive.length > 0) {
      const localRival = this.bestFollowNeighborhoodMatch(current, text, recognized);
      if (localRival && !this.sameRef(localRival.verse, current)) {
        contradictoryLocalScore = localRival.score;
        contradictoryLocalMargin = localRival.score - Math.max(currentScore, nextScore);
      }
    }
    const followEvidence = classifyFollowEvidence({
      tape,
      advanced,
      sharedPrefixOnly,
      neighborhood,
      neighborhoodKeep: NEIGHBORHOOD_KEEP,
      recognized,
      contradictoryLocalScore,
      contradictoryLocalMargin,
      localContradictionScore: LOCK_CLEAR_SCORE,
    });
    updateTrackConfidence(
      this.trackState,
      followEvidence,
      this.voicedDeltaMs(),
      Boolean(this.lock),
    );
    const trackDebug = formatTrackDebug(this.trackState, this.lockedRef);
    this.debugLocationConfidence = trackDebug.locationConfidence;
    this.debugTrackConfidence = trackDebug.trackConfidence;
    const mushafNextSequential = Boolean(
      next && next.surah === current.surah && next.ayah === current.ayah + 1,
    );
    const nextBodyComplete = tape.nextTotal > 0 && tape.nextHits >= tape.nextTotal;
    const expectedNextEvidence = mushafNextSequential && (
      tape.nextHeard
      || nextBodyComplete
      || (awaitingSequentialNext && (tape.nextHits > 0 || tape.nextInProgress))
    );
    const sequentialBridge = Boolean(
      mushafNextSequential
      && awaitingSequentialNext
      && (
        recognized.length === 0
        || tape.nextHits > 0
        || tape.nextInProgress
        || tape.nextHeard
      ),
    );
    const holdsCurrentVerse = followEvidence.stickyLocation && Boolean(
      tape.holdsLock
      || currentOnlyHeard
      || (advanced && !sharedPrefixOnly)
      || (neighborhood >= NEIGHBORHOOD_KEEP && !sharedPrefixOnly)
      || followEvidence.verdict === 'uncertain'
      || expectedNextEvidence
      || sequentialBridge,
    );

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
    const sequentialScore = next && next.surah === current.surah
      ? Math.max(nextScore, this.locationScore(text, next))
      : 0;
    // Score-gated sequential advance: need a non-formula body token of mushaf-next,
    // not a lone الله / قل / رب that also opens dozens of other ayahs.
    const sequentialReady = Boolean(
      next
      && next.surah === current.surah
      && heardNext
      && sequentialScore >= SEQUENTIAL_ADVANCE_SCORE
      && !this.onlySharedOpening(recognized, next)
      && distinctiveTokens(recognized, verseAlignWords(next).words)
        .some((token) => !isAmbiguousAdvanceOpening(token) && compact(token).length >= 4),
    );
    const sequentialFormulaReady = Boolean(
      mushafNextSequential
      && (tape.nextHeard || nextBodyComplete)
      && sequentialScore >= SEQUENTIAL_ADVANCE_SCORE
    );
    if (next && next.surah === current.surah) {
      const advanceReady = tapeAdvance || sequentialReady || sequentialFormulaReady
        || this.shouldAdvance(recognized, next, current);
      const rivalOpening = !atLastAyah
        ? this.lockShortSurahOpening(recognized, text, current.surah)
        : null;
      const rivalScore = rivalOpening && rivalOpening.surah !== current.surah
        ? Math.max(this.shortOpeningTokenMatch(recognized, rivalOpening), this.locationScore(text, rivalOpening))
        : 0;
      const deferSequentialForHandoff = Boolean(
        rivalOpening
        && rivalOpening.surah !== current.surah
        && rivalScore >= SEQUENTIAL_ADVANCE_SCORE
        && rivalScore > sequentialScore + 0.02
        && !nextBodyComplete
        && !(tape.nextInProgress && sequentialScore >= rivalScore - 0.02),
      );
      if (advanceReady && !deferSequentialForHandoff) {
        this.noteCandidate({ surah: next.surah, ayah: next.ayah }, Math.max(nextScore, currentScore, sequentialScore));
        return [...messages, ...this.commit(next, Math.max(nextScore, currentScore, sequentialScore), this.alignForCommit(recognized, next))];
      }
    }

    // Last ayah / leftover opening of a short surah at ≥0.70 or two contiguous
    // ayah-1 words. Short tokens (ألم تر كيف) are not leftoverIsNewRecitation
    // (those require length ≥ 4) but still start a new surah. Weak 0.50
    // fragments must not name An-Nasr 110:1 or Muhammad 47:1.
    const openingQueries = leftover.length && leftover.join(' ') !== recognized.join(' ')
      ? [leftover, recognized]
      : [leftover.length ? leftover : recognized];
    for (const query of openingQueries) {
      // Empty leftover mid-surah is still the current ayah (اياك نستعين), not a
      // famous-opening scan. Short unused leftover (ألم تر كيف) may still switch.
      if (!atLastAyah && !leftoverUnexplained && leftover.length === 0) {
        const crossSurah = this.lockShortSurahOpening(query, query.join(' '), current.surah);
        const crossScore = crossSurah && crossSurah.surah !== current.surah
          ? Math.max(this.shortOpeningTokenMatch(query, crossSurah), this.locationScore(query.join(' '), crossSurah))
          : 0;
        if (crossScore < SEQUENTIAL_ADVANCE_SCORE) continue;
      }
      if (!atLastAyah && !leftoverUnexplained && query.length < 2) continue;
      // Last ayah still being recited (والذين امنوا inside 103:3) is not a
      // transition — do not re-read it as Ma'idah 5:1.
      if (leftover.length === 0 && holdsCurrentVerse && !(atLastAyah && ayahDone)) continue;
      // The full hop, not only the leftover, judges a muqattaʿāt crumb (الم كتاب الله inside 4:131).
      const opening = this.lockShortSurahOpening(query, query.join(' '), current.surah, recognized);
      if (!opening || opening.surah === current.surah) continue;
      this.debugSearchSpace = 'Next-surah pool';
      const score = Math.max(
        this.shortOpeningTokenMatch(query, opening),
        this.locationScore(query.join(' '), opening),
      );
      if (score < SEQUENTIAL_ADVANCE_SCORE) continue;
      this.noteCandidate({ surah: opening.surah, ayah: opening.ayah }, score);
      return [...messages, ...this.commit(
        opening,
        score,
        this.alignForCommit(query, opening),
        this.handoffCommitMeta(query, query.join(' '), opening, current.surah),
      )];
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

    // Sticky mid-surah lock: only score [current-1, current+2]. Never fire a
    // full-mushaf locate while following — Global Search waits for startReacquire().
    if (stillInSurah && !holdsCurrentVerse && tape.unexplainedDistinctive.length > 0) {
      const crossSurah = this.lockShortSurahOpening(recognized, text, current.surah);
      const crossScore = crossSurah && crossSurah.surah !== current.surah
        ? Math.max(this.shortOpeningTokenMatch(recognized, crossSurah), this.locationScore(text, crossSurah))
        : 0;
      const local = this.bestFollowNeighborhoodMatch(current, text, recognized);
      const deferLocalForHandoff = Boolean(
        local
        && next
        && this.sameRef(local.verse, next)
        && crossScore >= SEQUENTIAL_ADVANCE_SCORE
        && crossScore > local.score + 0.02,
      );
      if (
        local
        && !this.sameRef(local.verse, current)
        && !deferLocalForHandoff
        && local.score >= SEQUENTIAL_ADVANCE_SCORE
        && (local.verse.ayah === (next?.ayah ?? -1) || local.score >= LOCK_CLEAR_SCORE)
      ) {
        this.noteCandidate({ surah: local.verse.surah, ayah: local.verse.ayah }, local.score);
        return [...messages, ...this.commit(local.verse, local.score, this.alignForCommit(recognized, local.verse))];
      }
    }

    if (atLastAyah && (leftoverUnexplained || ayahDone)) {
      const query = leftover.length ? leftover : recognized;
      const queryText = query.join(' ');
      const pooled = this.lockFromNextSurahPool(queryText, query, current.surah, {
        openingsOnly: true,
        hopTokens: recognized,
      });
      if (
        pooled
        && pooled.surah !== current.surah
        && pooled.ayah <= 2
        && this.allowsSurahSwitch(pooled)
        && this.trailingCrossSurahHandoffReady(recognized, query, queryText, pooled, current.surah)
      ) {
        this.debugSearchSpace = 'Next-surah pool';
        this.noteCandidate({ surah: pooled.surah, ayah: pooled.ayah }, this.locationScore(queryText, pooled));
        const pScore = this.locationScore(queryText, pooled);
        return [...messages, ...this.commit(
          pooled,
          pScore,
          this.alignForCommit(query, pooled),
          this.handoffCommitMeta(query, queryText, pooled, current.surah),
        )];
      }
    }

    if (complete && !next) {
      if (!(holdsCurrentVerse && leftover.length === 0)) {
        const pooled = this.lockFromNextSurahPool(text, recognized, current.surah, { openingsOnly: true });
        if (
          pooled
          && pooled.surah !== current.surah
          && pooled.ayah <= 2
          && this.trailingCrossSurahHandoffReady(recognized, recognized, text, pooled, current.surah)
        ) {
          this.debugSearchSpace = 'Next-surah pool';
          this.noteCandidate({ surah: pooled.surah, ayah: pooled.ayah }, this.locationScore(text, pooled));
          const pScore = this.locationScore(text, pooled);
          return [...messages, ...this.commit(
            pooled,
            pScore,
            contiguousAlignToVerse(recognized, pooled),
            this.handoffCommitMeta(recognized, text, pooled, current.surah),
          )];
        }
      }
      if (this.pendingShortOpening || this.openingForks.length > 0) {
        const rescue = this.lockShortSurahOpening(recognized, text, current.surah);
        if (
          rescue
          && rescue.surah !== current.surah
          && rescue.ayah <= 2
          && this.surahSwitchReady(recognized, text, rescue)
        ) {
          this.debugSearchSpace = 'Next-surah pool';
          const pScore = Math.max(
            this.shortOpeningTokenMatch(recognized, rescue),
            this.locationScore(text, rescue),
          );
          this.noteCandidate({ surah: rescue.surah, ayah: rescue.ayah }, pScore);
          return [...messages, ...this.commit(
            rescue,
            pScore,
            this.alignForCommit(recognized, rescue),
            this.handoffCommitMeta(recognized, text, rescue, current.surah),
          )];
        }
        this.debugSearchSpace = 'Next-surah pool';
        this.handoffWait = true;
        return messages;
      }
      if (!transcriptUnusable(recognized)) {
        this.startReacquire();
      }
      return messages;
    }

    const fillingLastAyah = this.shortLastAyahFollow(current)
      && this.window.length < samplesFor(FOLLOW_LAST_AYAH_ACCUMULATE_SEC);
    const weakFollowHop = (!advanced || sharedPrefixOnly)
      && neighborhood < NEIGHBORHOOD_KEEP
      && followEvidence.verdict !== 'supported'
      && !expectedNextEvidence;
    if (atLastAyah && ayahDone && transcriptUnusable(recognized)) {
      const pooled = this.lockFromNextSurahPool(text, recognized, current.surah, { openingsOnly: true });
      if (
        pooled
        && pooled.surah !== current.surah
        && pooled.ayah <= 2
        && this.allowsSurahSwitch(pooled)
        && this.trailingCrossSurahHandoffReady(recognized, recognized, text, pooled, current.surah)
      ) {
        this.debugSearchSpace = 'Next-surah pool';
        const pScore = this.locationScore(text, pooled);
        this.noteCandidate({ surah: pooled.surah, ayah: pooled.ayah }, pScore);
        return [...messages, ...this.commit(
          pooled,
          pScore,
          this.alignForCommit(recognized, pooled),
          this.handoffCommitMeta(recognized, text, pooled, current.surah),
        )];
      }
      return messages;
    }
    if (followEvidence.verdict !== 'supported' && weakFollowHop) {
      if (followEvidence.verdict === 'contradicted') {
        this.noteTrackContradiction();
      } else {
        const weakHopMiss = transcriptUnusable(recognized) || neighborhood < 0.12;
        this.noteTrackUncertainty(weakHopMiss, expectedNextEvidence || sequentialBridge);
      }
    }
    if (weakFollowHop && !holdsCurrentVerse) {
      // Three consecutive contradictions: break a wrong-surah deadlock if this hop is
      // already ayah 1 of a salah-prior surah. Do not wait for the 1.5 s grace.
      if (this.mismatches >= LOCK_GRACE_FAILS) {
        const opening = this.lockShortSurahOpening(recognized, text, current.surah);
        if (opening && opening.surah !== current.surah && this.surahSwitchReady(recognized, text, opening)) {
          this.debugSearchSpace = 'Next-surah pool';
          const score = Math.max(
            this.shortOpeningTokenMatch(recognized, opening),
            this.locationScore(text, opening),
          );
          this.noteCandidate({ surah: opening.surah, ayah: opening.ayah }, score);
          return [...messages, ...this.commit(
            opening,
            score,
            this.alignForCommit(recognized, opening),
            this.handoffCommitMeta(recognized, text, opening, current.surah),
          )];
        }
      }
      // Keep accumulating a short last ayah; only drop lock after 3 hops and 1.5 s.
      const lostTrack = !fillingLastAyah && this.lockGraceExpired();
      if (lostTrack) {
        const pooled = this.lockFromNextSurahPool(text, recognized, current.surah, { openingsOnly: true });
        if (
          pooled
          && pooled.surah !== current.surah
          && pooled.ayah <= 2
          && this.trailingCrossSurahHandoffReady(recognized, recognized, text, pooled, current.surah)
        ) {
          this.debugSearchSpace = 'Next-surah pool';
          const pScore = this.locationScore(text, pooled);
          this.noteCandidate({ surah: pooled.surah, ayah: pooled.ayah }, pScore);
          return [...messages, ...this.commit(
            pooled,
            pScore,
            this.alignForCommit(recognized, pooled),
            this.handoffCommitMeta(recognized, text, pooled, current.surah),
          )];
        }
        // Never run bestJoint03Match on this follow hop — it stalls frame
        // ingestion (~2s Match spike). Global Search waits for reacquire.
        this.startReacquire(false);
        return messages;
      }
    } else if (
      weakFollowHop
      && !sequentialBridge
      && !fillingLastAyah
      && !expectedNextEvidence
      && this.lockGraceExpired()
      && (
        this.mismatches >= LOCK_GRACE_FAILS
        || this.commitState.unsupportedVoicedMs >= TRACK_UNSUPPORTED_VOICED_MS
      )
    ) {
      // Drop only after real grace misses (unsupported voiced counts with misses).
      this.startReacquire(false);
      return messages;
    } else if (
      followEvidence.verdict === 'supported'
      || this.credibleFollowSupport(tape, advanced, sharedPrefixOnly, mushafNextSequential, heardNext)
      || sequentialBridge
    ) {
      this.clearMismatch();
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
    if (
      !isAmbiguousAdvanceOpening(opening)
      && this.locationScore(spoken, next) >= SEQUENTIAL_ADVANCE_SCORE
      && (heardDistinct(query, next, skip) || heardSequentialNext(query, next, skip) || hits.length >= 1)
    ) {
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
      const opening = this.lockShortSurahOpening(query, queryText, current.surah);
      const pooled = opening ?? this.lockFromNextSurahPool(queryText, query, current.surah, {
        openingsOnly: true,
        hopTokens: recognized,
      });
      if (
        !pooled
        || pooled.ayah > 2
        || !this.surahSwitchReady(query, queryText, pooled)
        || this.onlySharedOpeningInPool(query, pooled)
        || (
          !this.hasOpeningEvidence(query, queryText, pooled)
          && !this.shortHandoffOpeningReady(query, queryText, pooled)
          && this.shortOpeningTokenMatch(query, pooled) < SEQUENTIAL_ADVANCE_SCORE
        )
      ) {
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
      const pScore = this.locationScore(queryText, pooled);
      return this.commit(
        pooled,
        pScore,
        this.alignForCommit(query, pooled),
        this.handoffCommitMeta(query, queryText, pooled, current.surah),
      );
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

  private commit(
    verse: QuranVerse,
    score: number,
    matched: number[],
    handoff: CommitHandoffMeta = {},
  ): RecognitionMessage[] {
    const kind = this.commitKindFor(verse);
    const from = this.lock ? { surah: this.lock.surah, ayah: this.lock.ayah } : null;
    if (from && (from.surah !== verse.surah || from.ayah !== verse.ayah) && !this.allowsSurahSwitch(verse)) {
      const prefix = displayBodyWords(verse).slice(0, matched.length);
      const messages: RecognitionMessage[] = [];
      if (prefix.length) messages.push({ type: 'heard_words', words: prefix });
      if (matched.length || prefix.length) {
        messages.push({
          type: 'verse_candidate',
          candidates: [{
            surah: verse.surah,
            ayah: verse.ayah,
            ayah_end: null,
            confidence: score,
            rank: 0,
            source: 'discovery',
          }],
          stable: false,
          final_flush: false,
        });
      }
      return messages;
    }
    const recognized = handoff.recognized ?? [];
    const bodyWords = openingBodyWords(verse);
    const stats = this.ensureTokenStats();
    let evidence = scoreCandidate(
      score,
      recognized,
      stats,
      from,
      { surah: verse.surah, ayah: verse.ayah },
      this.trackingMode(),
    );
    if (handoff.runnerUpTotal != null) {
      evidence = applyMargin(evidence, handoff.runnerUpTotal);
    }
    this.debugMargin = evidence.margin;
    const twoContiguous = handoff.twoContiguous ?? this.twoContiguousOpeningWords(recognized, verse);
    const decision = decideLocationCommit({
      kind,
      from,
      verse,
      bodyWords,
      evidence,
      matchScore: score,
      uniqueSecond: handoff.uniqueSecond ?? false,
      ayah2Ready: handoff.ayah2Ready ?? false,
      twoContiguous,
      shortOpeningConfirmed: handoff.shortOpeningConfirmed ?? false,
      muqattaatHeard: handoff.muqattaatHeard,
      openingEntropy: handoff.openingEntropy,
      distinctiveTokenCount: handoff.distinctiveTokenCount,
      bodyHeardCount: handoff.bodyHeardCount,
      voicedMs: this.lastFeedVoicedMs,
      hopId: this.hopId,
      state: this.commitState,
    });
    const prefix = displayBodyWords(verse).slice(0, matched.length);
    const messages: RecognitionMessage[] = [];
    if (prefix.length) messages.push({ type: 'heard_words', words: prefix });
    if (!decision.allow) {
      if (kind === 'reacquire') {
        this.reacquireDenyStreak += 1;
        if (this.reacquireDenyStreak >= REACQUIRE_DENY_TRIM_AFTER) {
          const windowSec = this.window.length / SAMPLE_RATE;
          const targetSec = windowSec - REACQUIRE_DENY_TRIM_SEC;
          if (targetSec >= ACQUIRE_MIN_SEC && targetSec < windowSec) {
            this.window = keepLast(this.window, targetSec);
            this.fresh = Math.min(this.fresh, this.window.length);
            this.reacquireDenyStreak = 0;
          }
        }
      }
      if (matched.length || prefix.length) {
        messages.push({
          type: 'verse_candidate',
          candidates: [{
            surah: verse.surah,
            ayah: verse.ayah,
            ayah_end: null,
            confidence: score,
            rank: 0,
            source: 'discovery',
          }],
          stable: false,
          final_flush: false,
        });
      }
      return messages;
    }

    this.reacquireDenyStreak = 0;

    if (kind === 'cross_surah_handoff' && verse.ayah <= 2) {
      this.confirmShortOpening(verse);
    }

    const recoveringSameSurah = this.phase === 'reacquiring'
      && this.priorSurah != null
      && verse.surah === this.priorSurah;
    const advancing = this.lock !== null || recoveringSameSurah;
    this.lock = verse;
    this.lastLockedRef = { surah: verse.surah, ayah: verse.ayah };
    this.priorSurah = verse.surah;
    this.phase = 'following';
    this.handoffWait = false;
    this.clearOpeningWait();
    this.debugSearchSpace = this.lockedSearchSpace(verse);
    this.clearMismatch();
    noteCredibleSupport(this.commitState);
    this.trackState = freshTrackConfidence();
    this.trackState.locationConfidence = 1;
    this.trackState.trackConfidence = 0.9;
    this.wordIndex = matched.length ? matched[matched.length - 1]! : -1;
    this.trimmedForShortLast = false;
    this.heardMuqattaatTokens = [];
    this.window = keepLast(this.window, advancing ? KEEP_AFTER_COMMIT_SEC : KEEP_AFTER_LOCK_SEC);
    this.fresh = 0;
    this.debugBufferMs = Math.round((this.window.length / SAMPLE_RATE) * 1000);
    messages.push(this.matchMessage(verse, score, decision.locationCommit));
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
    const last = this.lock
      ? this.db.getSurah(this.lock.surah).at(-1)
      : undefined;
    this.handoffWait = Boolean(this.lock && last && last.ayah === this.lock.ayah);
    if (this.lock) {
      this.lastLockedRef = { surah: this.lock.surah, ayah: this.lock.ayah };
    }
    this.phase = 'reacquiring';
    this.lock = null;
    this.reacquireDenyStreak = 0;
    this.wordIndex = -1;
    this.clearMismatch();
    this.heardMuqattaatTokens = [];
    this.debugSearchSpace = 'Next-surah pool';
    this.debugCandidate = null;
    if (clearWindow) {
      this.window = new Float32Array(0);
      this.fresh = 0;
    } else {
      this.window = keepLast(this.window, ACQUIRE_MAX_SEC);
    }
  }

  private bodyWords(verse: QuranVerse): string[] {
    return openingBodyWords(verse);
  }

  private ensureAyah1SecondCounts(): Map<string, number> {
    if (this.ayah1SecondCounts) return this.ayah1SecondCounts;
    const counts = new Map<string, number>();
    for (const verse of this.db.verses) {
      if (verse.ayah > 2 || skipUnusableLock(verse)) continue;
      const { words } = verseAlignWords(verse);
      const body = words[0] && isSharedBasmalaToken(words[0]!)
        ? words.slice(Math.min(OPENING_BASMALA_WORDS, words.length))
        : words;
      const second = body[1];
      if (!second || compact(second).length < 4) continue;
      const key = compact(second);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    this.ayah1SecondCounts = counts;
    return counts;
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
    const { words, basmala } = verseAlignWords(verse);
    if (!words.length) return false;
    const skip = this.uniqueOpeningSkip(verse);
    const declared = openingBasmalaWordCount(verse);
    // Ayah-1 phoneme lists often omit the opening Basmala; uniqueOpeningSkip still
    // adds 4 declared Basmala words and would treat الم تر كيف as "shared".
    const bodySkip = basmala === 0 && declared > 0
      ? this.sharedAlignPrefix(verse)
      : Math.max(0, skip - basmala);
    if (bodySkip <= 0 || words.length <= bodySkip) return false;
    const matched = contiguousAlignFromOpening(recognized, words);
    return matched.length > 0 && matched[0] === 0 && matched.every((index) => index < bodySkip);
  }

  /**
   * Openings-pool decision. `onlySharedOpening` counts every ayah, so 105:1
   * ألم تر كيف فعل ربك stays "shared" through five words because of 89:6. In
   * the 114-openings pool the reciter is starting a surah: when the heard prefix
   * is at least a trigram, runs at least two words past what any other opening
   * shares, includes a non-formula word, and is a near-unique mushaf n-gram
   * (this opening plus at most one mid-surah twin), it is the opening. Formula
   * prefixes shared by many ayahs (الحمد لله, الذين كفروا, يسألونك عن) keep the veto.
   */
  private onlySharedOpeningInPool(recognized: string[], verse: QuranVerse): boolean {
    if (!this.onlySharedOpening(recognized, verse)) return false;
    const { words } = verseAlignWords(verse);
    const matched = contiguousAlignFromOpening(recognized, words);
    if (matched.length < RARE_SHARED_PREFIX_MIN_WORDS || matched[0] !== 0) return true;
    const poolSkip = this.sharedOpeningPoolPrefix(verse);
    const beyond = matched.filter((index) => index >= poolSkip);
    if (beyond.length < 2) return true;
    const distinctive = beyond.some((index) => {
      const word = words[index]!;
      return !isWeakOpeningConfirmToken(word) && compact(word).length >= 3;
    });
    if (!distinctive) return true;
    // A garbled word may leave a gap in `matched`; the twin test is on the verse span.
    const span = Math.min(Math.max(...matched) + 1, SHARED_PREFIX_MAX);
    const key = words.slice(0, span).join('\0');
    return (this.ensureAlignPrefixCounts().get(key) ?? 0) > RARE_SHARED_PREFIX_TWINS + 1;
  }

  /** Leading body words this opening shares with another opening in the pool. */
  private sharedOpeningPoolPrefix(verse: QuranVerse): number {
    const { words } = verseAlignWords(verse);
    if (words.length <= 1) return 0;
    let shared = 0;
    for (const entry of this.ensureQuranOpenings()) {
      if (this.sameRef(entry.verse, verse)) continue;
      const other = verseAlignWords(entry.verse).words;
      const limit = Math.min(SHARED_PREFIX_MAX, words.length - 1, other.length);
      let count = 0;
      while (count < limit && words[count] === other[count]) count += 1;
      shared = Math.max(shared, count);
    }
    return shared;
  }

  private ensureAlignPrefixCounts(): Map<string, number> {
    if (this.alignPrefixCounts) return this.alignPrefixCounts;
    const counts = new Map<string, number>();
    for (const verse of this.db.verses) {
      const { words } = verseAlignWords(verse);
      let key = '';
      for (let length = 1; length <= Math.min(SHARED_PREFIX_MAX, words.length); length++) {
        key = length === 1 ? words[0]! : `${key}\0${words[length - 1]!}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    this.alignPrefixCounts = counts;
    return counts;
  }

  /** Leading verseAlignWords that also open a different ayah. */
  private sharedAlignPrefix(verse: QuranVerse): number {
    const { words } = verseAlignWords(verse);
    if (words.length <= 1) return 0;
    const counts = this.ensureAlignPrefixCounts();
    let shared = 0;
    const limit = Math.min(SHARED_PREFIX_MAX, words.length - 1);
    let key = '';
    while (shared < limit) {
      key = shared === 0 ? words[0]! : `${key}\0${words[shared]!}`;
      if ((counts.get(key) ?? 0) < 2) break;
      shared++;
    }
    return shared;
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


  /** When two ayahs share the same body modulo proclitics (1:2 vs 37:182),
   * prefer the higher location score, then the earlier surah/ayah. */
  private preferCanonicalDuplicate(verse: QuranVerse, text: string): QuranVerse {
    const normKey = (words: string[]) => words.map((word) => stripProclitics(word)).join('\0');
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
    // Thin mysterious-letter ayahs (20:1 طه, 7:1 المص) cannot cold-lock from
    // noise or global search. priorSurah == null must not skip this check.
    const muqattaat = this.handoffMuqattaatToken(verse);
    if (muqattaat && !this.heardMuqattaatEvidence(recognized, muqattaat)) return false;
    if (this.priorSurah == null && isExactMuqattaatAyah1(verse)) {
      // Cold الم / الر / طه must be acoustically isolated. When the homophone
      // starts a running non-muqattaʿāt opening (ألم تر كيف, ألم نشرح) the
      // continuation words prove it — however short they are (تر, ترى, تركيف).
      const { words } = verseAlignWords(verse);
      const token = words[0] ? compact(words[0]) : '';
      if (!token || !this.heardIsolatedMuqattaatBody(recognized, token)) return false;
    }
    const holdChampionAyah1 = this.holdChampionAyah1(match, verse, text, recognized);
    if (!this.hasVerseEvidence(text, verse, recognized) && !holdChampionAyah1) return false;
    // Reject locks that only hear a shared prefix (قل اعوذ برب / Basmala) with no unique body word.
    if (this.onlySharedOpening(recognized, verse)) return false;
    // Trailing ayah-2 audio in a cold 103:1 window is not a wrong champion.
    if (!holdChampionAyah1 && this.thinWrongChampion(match, verse, recognized)) return false;
    if (this.priorSurah != null && verse.surah !== this.priorSurah && verse.ayah <= 2) {
      if (!isShortHandoffOpening(verse)) return false;
      if (this.handoffMuqattaatToken(verse) && !this.allowsHandoffVerse(verse, recognized)) return false;
      const { words } = verseAlignWords(verse);
      const bodyWords = words[0] && isSharedBasmalaToken(words[0]!)
        ? words.slice(Math.min(OPENING_BASMALA_WORDS, words.length))
        : words;
      const bodyHeard = bodyHeardTokens(recognized);
      if (!this.oneWordSwitchReady(recognized, text, verse, bodyHeard, bodyWords)) return false;
    }
    // Isolated mysterious-letter ayahs (e.g. 7:1 المص) need that token as a whole
    // word. Use phoneme body tokens: Uthmani الٓمٓصٓ is longer than 5 because of
    // maddahs, and substring hits like المصدر / المدرس must not lock. The same
    // phoneme body is how 2:1 الم locks (not Uthmani الٓمٓ).
    const { words: body } = verseAlignWords(verse);
    if (body.length === 1 && shortAyah1Body(body[0]!)) {
      const token = compact(body[0]!);
      const isolated = isStandardMuqattaatBody(token)
        ? this.heardIsolatedMuqattaatBody(recognized, token)
        : heardIsolatedBodyToken(recognized, token);
      if (!isolated) return false;
    }
    const skip = openingBasmalaWordCount(verse);
    if (skip > 0) {
      const unique = verse.phonemes_joined_no_bsm_ns ?? compact(verse.phonemes_joined_no_bsm ?? '');
      if (unique) {
        const heardShortBody = body.length === 1 && shortAyah1Body(body[0]!)
          && (isStandardMuqattaatBody(compact(body[0]!))
            ? this.heardIsolatedMuqattaatBody(recognized, compact(body[0]!))
            : heardIsolatedBodyToken(recognized, compact(body[0]!)));
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
    if (!this.heardIsolatedMuqattaatBody(recognized, words[0]!)) return false;
    const rival = match.runners_up?.[0];
    if (!rival || rival.surah === verse.surah) return true;
    const rivalOpening = this.db.getVerse(rival.surah, 1);
    if (!rivalOpening) return true;
    const rivalBody = verseAlignWords(rivalOpening).words;
    if (rivalBody.length === 1 && this.heardIsolatedMuqattaatBody(recognized, rivalBody[0]!)) {
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

  /** Cold first-lock: a clear ayah-1 champion stays on ayah 1 when the
   * one-word body is heard, even if garbled (والعفر≈والعصر). Trailing ayah-2
   * tokens in the same sliding window must not overtake it. */
  private holdChampionAyah1(
    match: QuranChampionMatch,
    verse: QuranVerse,
    text: string,
    recognized: string[],
  ): boolean {
    if (this.lock || match.ayah !== 1 || verse.ayah !== 1) return false;
    if (match.score < LOCK_CLEAR_SCORE || skipUnusableLock(verse)) return false;
    return this.ayah1BasicEvidence(text, verse, recognized);
  }

  private ayah1BasicEvidence(text: string, verse: QuranVerse, recognized: string[]): boolean {
    if (verse.ayah !== 1 || skipUnusableLock(verse)) return false;
    if (this.hasVerseEvidence(text, verse, recognized)) return true;
    const body = openingBodyWords(verse);
    if (!body.length) return false;
    const muqattaat = this.handoffMuqattaatToken(verse);
    if (muqattaat) return this.heardMuqattaatEvidence(recognized, muqattaat);
    const bodyHeard = bodyHeardTokens(recognized);
    if (body.length === 1) {
      const token = body[0]!;
      if (this.heardIsolatedMuqattaatBody(recognized, token) || this.heardIsolatedMuqattaatBody(bodyHeard, token)) {
        return true;
      }
      if (bodyHeard.some((word) => this.switchOpeningMatch(word, token) || openingWordMatch(word, token))) {
        return true;
      }
      // Garbled oath openings (والعفر≈والعصر). Do not fuzzy-match الحمد→الحاقة.
      const compactToken = compact(token);
      if (compactToken[0] === 'و' && compactToken.length >= 5) {
        return bodyHeard.some((word) => wordsMatch(word, token, 0.8));
      }
      return false;
    }
    return this.locationScore(text, verse) >= LOCK_SCORE;
  }

  private locateAyah(match: QuranChampionMatch, text: string, recognized: string[]): QuranVerse | undefined {
    const opening = this.db.getVerse(match.surah, 1);
    if (opening && this.holdChampionAyah1(match, opening, text, recognized)) return opening;
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
    const holdAyah1 = Boolean(opening && this.holdChampionAyah1(match, opening, text, recognized));
    const openingBody = Boolean(
      opening
      && !skipUnusableLock(opening)
      && (this.hasVerseEvidence(text, opening, recognized) || holdAyah1)
    );
    const begin = openingBody || holdAyah1 ? 1 : match.ayah;
    const keepEarliest = preferEarliest || openingBody || holdAyah1;
    const spanEnd = match.ayah_end && match.ayah_end > match.ayah ? match.ayah_end : match.ayah;
    const last = this.db.getSurah(match.surah).at(-1)?.ayah ?? spanEnd;
    const end = Math.min(last, Math.max(spanEnd, match.ayah + 3));
    let best: QuranVerse | undefined;
    let bestScore = -1;
    for (let ayah = begin; ayah <= end; ayah++) {
      const verse = this.db.getVerse(match.surah, ayah);
      if (!verse || skipUnusableLock(verse)) continue;
      // Allow unique-token evidence when the body opening was ASR-garbled (Kawthar انا→سبحان).
      // Champion ayah 1 with basic evidence stays in the span even when fuzzy.
      const ayah1Hold = holdAyah1 && ayah === 1;
      if (!ayah1Hold && recognized.length
        && !heardDistinct(recognized, verse, this.uniqueOpeningSkip(verse))
        && !this.hasVerseEvidence(text, verse, recognized)) continue;
      if (!ayah1Hold && ayah > spanEnd
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
      if ((openingBody || holdAyah1) && best.ayah === 1) continue;
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
    const from = ayah > 1 ? Math.max(1, ayah - FOLLOW_WINDOW_BEHIND) : 1;
    const end = ayah > 1 ? Math.min(last, ayah + FOLLOW_WINDOW_AHEAD) : Math.min(last, 1 + RIVAL_SCAN);
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
    if (!verse || skipUnusableLock(verse) || !isShortHandoffOpening(verse)) return [];
    if (this.locationScore(text, verse) < LOCK_SCORE) return [];
    if (!this.hasOpeningEvidence(recognized, text, verse) && !this.shortHandoffOpeningReady(recognized, text, verse)) {
      return [];
    }
    return [verse];
  }

  private scanHandoffVerses(surah: number, recognized: string[], text: string): QuranVerse[] {
    // Prayer surah switches only target ayah 1 (or ayah 2 when 1 is Basmala).
    return this.scanPoolOpenings(surah, recognized, text).filter((verse) => verse.ayah <= 2);
  }

  /** Short salah-pool openings (قل هو الله احد) need ≥0.65 token match or two contiguous ayah-1 words. */
  private shortHandoffOpeningReady(recognized: string[], text: string, verse: QuranVerse): boolean {
    if (verse.ayah > 2) return false;
    if (this.onlySharedOpening(recognized, verse)) return false;
    if (this.priorSurah != null && verse.surah !== this.priorSurah) {
      const { words } = verseAlignWords(verse);
      const bodyWords = words[0] && isSharedBasmalaToken(words[0]!)
        ? words.slice(Math.min(OPENING_BASMALA_WORDS, words.length))
        : words;
      const bodyHeard = bodyHeardTokens(recognized);
      if (!this.oneWordSwitchReady(recognized, text, verse, bodyHeard, bodyWords)) return false;
    }
    if (this.surahSwitchReady(recognized, text, verse)) return true;
    return this.locationScore(text, verse) >= SEQUENTIAL_ADVANCE_SCORE
      && this.shortOpeningTokenMatch(recognized, verse) >= SEQUENTIAL_ADVANCE_SCORE;
  }

  /** Fraction of the spoken opening that contiguous-aligns to ayah 1. */
  private shortOpeningTokenMatch(recognized: string[], verse: QuranVerse): number {
    const words = openingBodyWords(verse);
    if (!words.length || !recognized.length) return 0;
    const aligned = this.switchAlignFromOpening(recognized, words);
    if (!aligned.length || aligned[0] !== 0) return 0;
    // A lone قل / إن must not name every ayah-1 that shares that opening.
    if (aligned.length < 2 && words.length > 1) return 0;
    return aligned.length / Math.min(recognized.length, words.length);
  }

  /** Ayah 1 (ayah 2 when ayah 1 is solely Basmala) of every surah present in the DB. */
  private ensureQuranOpenings(): QuranOpeningEntry[] {
    if (this.openingIndex) return this.openingIndex;
    const index: QuranOpeningEntry[] = [];
    const openings: QuranVerse[] = [];
    for (let surah = 1; surah <= QURAN_SURAH_COUNT; surah++) {
      const first = this.db.getVerse(surah, 1);
      const verse = first && !skipUnusableLock(first)
        ? first
        : this.db.getVerse(surah, 2);
      if (!verse || skipUnusableLock(verse) || verse.ayah > 2) continue;
      const body = openingBodyWords(verse);
      if (!body.length) continue;
      const ayah2 = verse.ayah === 1 ? this.db.getVerse(surah, 2) : undefined;
      const ayah2Ok = ayah2 && !skipUnusableLock(ayah2) ? ayah2 : undefined;
      index.push({
        verse,
        body,
        ayah2: ayah2Ok,
        ayah2Body: ayah2Ok ? verseAlignWords(ayah2Ok).words : [],
      });
      openings.push(verse);
    }
    this.openingIndex = index;
    this.quranOpenings = openings;
    return index;
  }

  /** Score incoming tokens only against the 114-openings index. Never 6,236-ayah search. */
  private lockShortSurahOpening(
    recognized: string[],
    text: string,
    fromSurah: number,
    hopTokens: string[] = recognized,
  ): QuranVerse | undefined {
    const bodyHeard = bodyHeardTokens(recognized);
    if (!bodyHeard.length) {
      this.openingForks = [];
      return undefined;
    }
    const admitted: {
      entry: QuranOpeningEntry;
      alignedTokens: string[];
      score: number;
      uniqueSecond: boolean;
      ayah2Ready: boolean;
      sharedOnly: boolean;
    }[] = [];
    for (const entry of this.ensureQuranOpenings()) {
      const verse = entry.verse;
      if (this.sameRef(verse, this.lock ?? undefined)) continue;
      if (this.oathOpeningMismatch(recognized, verse)) continue;
      const aligned = this.switchAlignFromOpening(bodyHeard, entry.body);
      const alignedTokens = aligned.map((item) => entry.body[item]!);
      const fromOpening = aligned.length >= 1 && aligned[0] === 0;
      const second = entry.body[1];
      const uniqueSecond = Boolean(
        this.priorSurah != null
        && verse.surah !== this.priorSurah
        && bodyHeard.length >= 2
        && second
        && compact(second).length >= 4
        && !isAmbiguousAdvanceOpening(second)
        && !isFormulaBodyToken(second)
        && !isSharedBasmalaToken(second)
        && second !== 'huwa'
        && second !== 'هو'
        && !SHARED_AYAH1_SECONDS.has(compact(second))
        && (this.ensureAyah1SecondCounts().get(compact(second)) ?? 0) < 2
        && !namedMuqattaatLetter(second)
        && bodyHeard.some((token) => {
          const heard = compact(token);
          if (heard.length < 4) return false;
          if (confusableBodyToken(heard, compact(second))) return false;
          return heard === compact(second) || wordsMatch(heard, compact(second), 0.85);
        }),
      );
      const ayah2Ready = Boolean(
        this.priorSurah != null
        && verse.surah !== this.priorSurah
        && entry.ayah2
        && this.ayah2OpeningConfirmed(recognized, text, entry.ayah2)
      );
      const muqattaat = this.handoffMuqattaatToken(verse);
      const muqattaatHeard = Boolean(muqattaat && this.heardMuqattaatEvidence(recognized, muqattaat));
      // Letter-name spellings (الف لام ميم) do not align as compact الم; still admit.
      if (!fromOpening && !uniqueSecond && !ayah2Ready && !muqattaatHeard) continue;
      if (!isShortHandoffOpening(verse) && !ayah2Ready && !muqattaatHeard) continue;
      // Muqattaʿāt ayah-1 never admits from ayah-2 lookalikes (هو الله ≠ 3:1).
      if (muqattaat && !muqattaatHeard) {
        continue;
      }
      if (
        entry.body.length === 1
        && shortAyah1Body(entry.body[0]!)
        && !ayah2Ready
        && !muqattaatHeard
        && !(isStandardMuqattaatBody(entry.body[0]!)
          ? this.heardIsolatedMuqattaatBody(bodyHeard, entry.body[0]!)
          : heardIsolatedBodyToken(bodyHeard, entry.body[0]!))
      ) {
        continue;
      }
      if (muqattaat && !this.allowsHandoffVerse(verse, recognized, hopTokens)) {
        continue;
      }
      if (
        fromOpening
        && entry.body.length > 1
        && aligned.length < 2
        && compact(alignedTokens.join('')).length < OPENING_ENTROPY_MIN_CHARS
        && !uniqueSecond
        && !ayah2Ready
      ) continue;
      if (!muqattaat && !this.allowsHandoffVerse(verse, recognized, hopTokens) && !ayah2Ready && !uniqueSecond) {
        continue;
      }
      const tokenMatch = fromOpening ? this.shortOpeningTokenMatch(bodyHeard, verse) : 0;
      admitted.push({
        entry,
        alignedTokens: muqattaatHeard && !alignedTokens.length ? entry.body.slice(0, 1) : alignedTokens,
        score: Math.max(
          tokenMatch,
          uniqueSecond || ayah2Ready || muqattaatHeard ? SEQUENTIAL_ADVANCE_SCORE : 0,
          muqattaatHeard ? HANDOFF_OPENING_SCORE : 0,
          this.locationScore(text, verse),
        ),
        uniqueSecond,
        ayah2Ready: ayah2Ready || muqattaatHeard,
        sharedOnly: this.onlySharedOpeningInPool(recognized, verse),
      });
    }
    if (!admitted.length) {
      this.openingForks = [];
      return undefined;
    }
    const bodies = admitted.map((row) => row.entry.body);
    const resolved: typeof admitted = [];
    const forks: QuranVerse[] = [];
    for (const row of admitted) {
      const rivals = bodies.filter((body) => body !== row.entry.body);
      const sharesPrefix = rivals.some((body) => sharedOpeningPrefixLen(row.entry.body, body) >= 1);
      const divergent = heardDivergentOpening(bodyHeard, row.entry.body, rivals);
      if ((sharesPrefix && !divergent && !row.uniqueSecond && !row.ayah2Ready) || (row.sharedOnly && !divergent && !row.uniqueSecond && !row.ayah2Ready)) {
        forks.push(row.entry.verse);
        continue;
      }
      if (row.sharedOnly) continue;
      resolved.push(row);
    }
    if (!resolved.length && forks.length > 0) {
      this.openingForks = forks;
      this.debugSearchSpace = 'Next-surah pool';
      return undefined;
    }
    this.openingForks = [];
    const ranked = (resolved.length ? resolved : admitted).map((row) => ({
      ...row,
      // Prefer Juz 30 / last-20 prayer surahs when acoustic scores are close so
      // Fatiha → Ikhlas / Falaq / Nas wins over obscure early openings.
      bonus: surahBonus(row.entry.verse.surah, fromSurah),
    }));
    ranked.sort((left, right) => {
      const leftAdj = left.score + left.bonus;
      const rightAdj = right.score + right.bonus;
      // Within the tie-break margin, salah-prior bonus decides before raw score.
      if (Math.abs(left.score - right.score) <= SURAH_MARGIN + 1e-9) {
        if (left.bonus !== right.bonus) return right.bonus - left.bonus;
      }
      if (Math.abs(leftAdj - rightAdj) > 1e-9) return rightAdj - leftAdj;
      return right.score - left.score;
    });
    const best = ranked[0];
    if (!best) return undefined;
    const verse = best.entry.verse;
    if (!this.surahSwitchReady(recognized, text, verse) && !best.uniqueSecond && !best.ayah2Ready) {
      return undefined;
    }
    if (best.score < SEQUENTIAL_ADVANCE_SCORE && !best.ayah2Ready) return undefined;
    if (best.score < HANDOFF_OPENING_SCORE && !best.uniqueSecond && !best.ayah2Ready) {
      const twoContiguous = best.alignedTokens.length >= 2;
      if (!twoContiguous) return undefined;
    }
    return verse;
  }

  private lockFromNextSurahPool(
    text: string,
    recognized: string[],
    fromSurah: number,
    options: { openingsOnly?: boolean; hopTokens?: string[] } = {},
  ): QuranVerse | undefined {
    return this.lockShortSurahOpening(recognized, text, fromSurah, options.hopTokens ?? recognized);
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

  private matchMessage(verse: QuranVerse, score: number, locationCommit = true): ZikristVerseMatch {
    return {
      type: 'verse_match',
      surah: verse.surah,
      ayah: verse.ayah,
      verse_text: verse.text_uthmani,
      surah_name: verse.surah_name,
      confidence: Math.round(Math.min(0.99, Math.max(score, 0.45)) * 100) / 100,
      surrounding_verses: [],
      locationCommit,
    };
  }

  private handoffCommitMeta(
    recognized: string[],
    text: string,
    verse: QuranVerse,
    fromSurah: number,
  ): CommitHandoffMeta {
    const bodyWords = openingBodyWords(verse);
    const bodyHeard = bodyHeardTokens(recognized);
    const aligned = this.switchAlignFromOpening(bodyHeard, bodyWords);
    const alignedTokens = aligned.map((index) => bodyWords[index]!);
    const muq = this.handoffMuqattaatToken(verse);
    const ayah2 = this.db.getVerse(verse.surah, 2);
    const stats = this.ensureTokenStats();
    const distinctiveTokenCount = bodyHeard.filter((t) => stats.idfNorm(t) > 0.35).length;
    return {
      recognized,
      runnerUpTotal: this.handoffRunnerUpTotal(recognized, text, verse, fromSurah),
      twoContiguous: this.twoContiguousOpeningWords(recognized, verse),
      shortOpeningConfirmed: this.shortOpeningPeeksConfirmed(verse),
      muqattaatHeard: Boolean(muq && this.heardMuqattaatEvidence(recognized, muq)),
      openingEntropy: openingEntropyReady(alignedTokens),
      ayah2Ready: Boolean(ayah2 && this.ayah2OpeningConfirmed(recognized, text, ayah2)),
      distinctiveTokenCount,
      bodyHeardCount: bodyHeard.length,
    };
  }

  /** Runner-up log-evidence total for cross-surah margin (second ranked opening). */
  private handoffRunnerUpTotal(
    recognized: string[],
    text: string,
    winner: QuranVerse,
    fromSurah: number,
  ): number | undefined {
    const bodyHeard = bodyHeardTokens(recognized);
    const query = bodyHeard.length ? bodyHeard : recognized;
    if (!query.length) return undefined;
    const stats = this.ensureTokenStats();
    const from = this.lock ? { surah: this.lock.surah, ayah: this.lock.ayah } : null;
    let best: number | undefined;
    for (const entry of this.ensureQuranOpenings()) {
      const verse = entry.verse;
      if (verse.surah === winner.surah && verse.ayah === winner.ayah) continue;
      const score = Math.max(
        this.shortOpeningTokenMatch(query, verse),
        this.locationScore(text, verse),
      ) + surahBonus(verse.surah, fromSurah);
      const ev = scoreCandidate(
        score,
        recognized,
        stats,
        from,
        { surah: verse.surah, ayah: verse.ayah },
        this.trackingMode(),
      );
      if (best == null || ev.total > best) best = ev.total;
    }
    return best;
  }
}
