import type { QuranChampionMatch, QuranDB, QuranVerse, TilawaSession, TranscribeResult, VerseMatchMessage } from '@tilawa/core';
import { fragmentScore, ratio as levRatio } from '../../node_modules/@tilawa/core/dist/levenshtein.js';
import { isFatihaBasmala, isFatihaBasmalaTail, OPENING_BASMALA_WORDS, openingBasmalaWordCount, splitOpeningBasmala } from './basmala';
import { recordRecognitionCycle } from './recognition-clocks';
import { remainingAfter, rerankChampion, surahBonus, acousticChampion, TIE_BREAK_MARGIN } from './salah-prior';
import { TRACKING_COMPLETION_COVERAGE } from './sequential';
import type { FollowerPhase, RecognitionMessage, VerseRef } from './types';

export type { FollowerPhase };
export type TranscribeFn = (audio: Float32Array, locate: boolean) => Promise<TranscribeResult>;
export type FeedTimings = { queueWaitMs?: number; stallMs?: number };

const SAMPLE_RATE = 16000;
const ACQUIRE_MIN_SEC = 0.9;
const ACQUIRE_MAX_SEC = 4;
export const FOLLOW_WINDOW_SEC = 1.2;
export const FOLLOW_TRIGGER_SEC = 0.4;
/** Grow the follow window only for a short last ayah of the current surah. */
export const FOLLOW_LAST_AYAH_ACCUMULATE_SEC = 5;
export const SHORT_LAST_AYAH_WORDS = 4;
const LAST_AYAH_SEED_SEC = 0.3;
const KEEP_AFTER_COMMIT_SEC = 1.0;
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

/** Shared stem such as الصرط / صرط. Not a 0.7 fuzzy hit like الرحمن / الحمد. */
function relatedStem(left: string, right: string): boolean {
  if (left === right) return true;
  if (left.length <= 2 || right.length <= 2) return false;
  const longer = left.length >= right.length ? left : right;
  const shorter = left.length >= right.length ? right : left;
  return longer.endsWith(shorter) || longer.startsWith(shorter);
}

/** Advance/follow soft match: نفاث ≈ النفثت, الجنة ≈ الجنه. */
function softTokenMatch(left: string, right: string): boolean {
  if (wordsMatch(left, right) || relatedStem(left, right)) return true;
  const strip = (word: string) => compact(word).replace(/^ال/, '').replace(/^[وف]/, '');
  const a = strip(left);
  const b = strip(right);
  if (a.length < 3 || b.length < 3) return false;
  if (a.includes(b) || b.includes(a)) return true;
  return levRatio(a, b) >= 0.72;
}

function openingWordMatch(left: string, right: string): boolean {
  return left === right || relatedStem(left, right);
}

/** Opening words in order. Extra spoken words may be skipped; a distinctive
 * verse word may not, so قُلْ … ٱللَّهُ cannot stand in for قُل لَّوْ شَاءَ. */
function contiguousAlignFromOpening(recognized: string[], verseWords: string[]): number[] {
  if (!verseWords.length) return [];
  let start = -1;
  for (let index = 0; index < recognized.length; index++) {
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
  return skip > 0 && skip < recognized.length && openingWordMatch(recognized[skip]!, verseWords[0]!);
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

/** Tokens the current last-ayah body does not explain. A leftover suffix is
 * not required: a 103:3 interior word or a tail token after 106:1 in CTC
 * order must not hide Quraysh. Interior coincidences such as هو in 108:3
 * are dropped without stripping الله احد. */
function leftoverNewTokens(recognized: string[], verseWords: string[]): string[] {
  return recognized.filter((token) => (
    !verseWords.some((word) => wordsMatch(token, word) || relatedStem(token, word))
  ));
}

function leftoverIsNewRecitation(leftover: string[]): boolean {
  return leftover.length > leadingBasmalaWords(leftover);
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
  const formula = new Set(['بسم', 'الله', 'الرحمن', 'الرحيم', 'bismi', 'allahi', 'alrahman', 'alrahim']);
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
  private window: Float32Array<ArrayBufferLike> = new Float32Array(0);
  private fresh = 0;
  private mismatches = 0;
  private lock: QuranVerse | null = null;
  private priorSurah: number | null = null;
  private wordIndex = -1;
  private queueTimings: FeedTimings = {};
  private bodyPrefixCounts: Map<string, number> | null = null;
  private trimmedForShortLast = false;
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
    return this.lockFromTranscript(result, false);
  }

  private lockFromTranscript(
    result: TranscribeResult,
    allowSearch: boolean,
    ignore?: VerseRef,
  ): RecognitionMessage[] {
    const text = result.text.trim();
    const recognized = text.split(/\s+/).filter(Boolean);
    if (!recognized.length) return [];
    const raw = this.rawMatch(result, allowSearch);
    if (!raw) return [];
    const ranked = rerankChampion(raw, this.priorSurah);
    const acoustic = acousticChampion(raw);
    const attempts = [ranked];
    if (ranked.surah !== acoustic.surah || ranked.ayah !== acoustic.ayah) attempts.push(acoustic);
    let candidates: RecognitionMessage[] | undefined;
    if (compact(text).length >= 6) {
      for (const match of attempts) {
        const verse = this.locateAyah(match, text, recognized);
        if (!verse || this.sameRef(verse, ignore) || this.ambiguousSurah(match, verse, text)) {
          candidates ??= [{
            type: 'verse_candidate',
            candidates: this.candidateList(match),
            stable: false,
            final_flush: false,
          }];
          continue;
        }
        if (!this.canLock(match, verse, text, recognized)) continue;
        const chosen = this.preferCanonicalDuplicate(verse, text);
        if (this.sameRef(chosen, ignore)) continue;
        return this.commit(chosen, match.score, this.alignForCommit(recognized, chosen));
      }
      const alternative = this.alternativeHeardVerse(recognized, text, ranked);
      if (alternative && !this.sameRef(alternative, ignore)) {
        const chosen = this.preferCanonicalDuplicate(alternative, text);
        if (!this.sameRef(chosen, ignore)) {
          return this.commit(chosen, this.locationScore(text, chosen), this.alignForCommit(recognized, chosen));
        }
      }
    }
    return this.unconfirmedMessages(recognized, ranked, candidates);
  }

  private followMaxSec(): number {
    if (this.phase !== 'following' || !this.lock) return ACQUIRE_MAX_SEC;
    return this.shortLastAyahFollow(this.lock) ? FOLLOW_LAST_AYAH_ACCUMULATE_SEC : FOLLOW_WINDOW_SEC;
  }

  /** Next ayah is the last of this surah and short enough that a 1.2 s
   * follow slice often decodes as garbage (stretched 114:6, 108:3). */
  private shortLastAyahFollow(current: QuranVerse): boolean {
    const next = this.db.getNextVerse(current.surah, current.ayah);
    if (!next || next.surah !== current.surah) return false;
    if (this.db.getNextVerse(next.surah, next.ayah)) return false;
    return verseAlignWords(next).words.length <= SHORT_LAST_AYAH_WORDS;
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
    const alreadyComplete = this.ayahComplete(current);
    this.fresh = 0;
    const locate = this.mismatches > 0;
    const result = await this.transcribe(this.window, locate);
    this.noteCycle(result, locate);
    const text = result.text.trim();
    const recognized = text.split(/\s+/).filter(Boolean);
    const previous = this.previousVerse(current);
    const currentScore = explainScore(text, current);
    const nextScore = explainScore(text, next);
    const previousScore = previous && !isFatihaBasmala(previous) && !this.onlySharedOpening(recognized, previous)
      ? explainScore(text, previous)
      : 0;
    const heardNext = Boolean(next && heardDistinct(recognized, next, this.distinctSkip(next, current)));
    const currentBody = verseAlignWords(current).words;
    const leftover = leftoverNewTokens(recognized, currentBody);
    const leftoverUnexplained = leftoverIsNewRecitation(leftover);
    const matchedBody = alignWords(recognized, currentBody);
    const matched = matchedBody.map((index) => index + verseAlignWords(current).basmala);
    const wordIndex = matched.length ? matched[matched.length - 1]! : this.wordIndex;
    const completeThisHop = current.phoneme_words.length > 0 && (
      wordIndex >= current.phoneme_words.length - 1
      || (wordIndex + 1) / current.phoneme_words.length >= TRACKING_COMPLETION_COVERAGE
    );
    const atLastAyah = Boolean(next && next.surah !== current.surah);
    const atSurahBoundary = Boolean(
      atLastAyah && (alreadyComplete || completeThisHop || leftoverUnexplained),
    );
    const newRecitationAfterSurah = Boolean(atLastAyah && leftoverUnexplained);
    const advanced = wordIndex > this.wordIndex;
    const sharedPrefixOnly = this.onlySharedOpening(recognized, current);
    const neighborhood = Math.max(
      sharedPrefixOnly || newRecitationAfterSurah ? 0 : currentScore,
      newRecitationAfterSurah ? 0 : previousScore,
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

    if (atSurahBoundary) {
      const query = leftover.length ? leftover : recognized;
      const queryText = leftover.length ? leftover.join(' ') : text;
      const pooled = this.lockFromNextSurahPool(queryText, query, current.surah);
      // Basmala alone must not open the next surah.
      if (pooled && !this.onlySharedOpening(query, pooled) && this.hasOpeningEvidence(query, queryText, pooled)) {
        return [...messages, ...this.commit(pooled, this.locationScore(queryText, pooled), this.alignForCommit(query, pooled))];
      }
    }

    const located = locate || atSurahBoundary ? this.matchFromTranscript(result, atSurahBoundary && !locate) : null;
    const locatedVerse = located ? this.locateAyah(located, text, recognized) : undefined;
    const locatedScore = locatedVerse ? this.locationScore(text, locatedVerse) : 0;
    const stillInSurah = Boolean(next && next.surah === current.surah);
    const jump = Boolean(
      located
      && locatedVerse
      && !this.ambiguousSurah(located, locatedVerse, text)
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
    );

    if (jump && located && locatedVerse) {
      return [...messages, ...this.commit(locatedVerse, located.score, contiguousAlignToVerse(recognized, locatedVerse))];
    }

    if (next && this.shouldAdvance(recognized, next, current)) {
      return [...messages, ...this.commit(next, Math.max(nextScore, currentScore), contiguousAlignToVerse(recognized, next))];
    }

    if (complete && !next) {
      const pooled = this.lockFromNextSurahPool(text, recognized, current.surah);
      if (pooled) {
        return [...messages, ...this.commit(pooled, this.locationScore(text, pooled), contiguousAlignToVerse(recognized, pooled))];
      }
      this.startReacquire();
      return messages;
    }

    if (newRecitationAfterSurah) {
      if (compact(leftover.join(' ')).length >= 6) {
        const leftoverResult: TranscribeResult = { text: leftover.join(' '), rawPhonemes: leftover.join(' ') };
        const acquired = this.lockFromTranscript(leftoverResult, true, current);
        if (acquired.some((message) => message.type === 'verse_match')) {
          return [...messages, ...acquired];
        }
      }
      const fromWindow = this.lockFromTranscript(result, true, current);
      if (fromWindow.some((message) => message.type === 'verse_match')) {
        return [...messages, ...fromWindow];
      }
      // Leave follow so the next hops use the 4 s acquire window on kept audio.
      this.startReacquire(false);
      this.fresh = this.window.length;
      return messages;
    }

    const fillingLastAyah = this.shortLastAyahFollow(current)
      && this.window.length < samplesFor(FOLLOW_LAST_AYAH_ACCUMULATE_SEC);
    if ((!advanced || sharedPrefixOnly) && neighborhood < NEIGHBORHOOD_KEEP) {
      this.mismatches++;
      const reacquireAfter = stillInSurah ? MISMATCH_LIMIT + 3 : MISMATCH_LIMIT;
      // Keep accumulating a short last ayah; still locate so a real jump can recover.
      if (!fillingLastAyah && this.mismatches >= reacquireAfter) {
        this.startReacquire(false);
        const acquired = this.lockFromTranscript(result, false, newRecitationAfterSurah ? current : undefined);
        const filtered = acquired.filter((message) => {
          if (message.type !== 'verse_match') return true;
          if (newRecitationAfterSurah && this.sameRef(message, current)) return false;
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
    const leftover = remainingAfterCurrent(recognized, currentBody);
    const query = leftover.length ? leftover : recognized;
    const { words, basmala } = verseAlignWords(next);
    // Shared openings (رب/rabbi, الله/allah, الحمد/alhamdu, قل/qul) alone must not
    // advance — Fatiha leftover after Ibrahim 14:39 must not become 14:40.
    const overlap = uniqueWordSkip(next, current);
    const opening = words[0] ?? '';
    const needUnique = words.length > 1 && isAmbiguousAdvanceOpening(opening) ? basmala + 1 : overlap;
    const skip = Math.max(overlap, needUnique);
    if (heardDistinct(query, next, skip)) return true;
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
    const hits = distinctive.filter((token) => query.some((word) => softTokenMatch(word, token)));
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
    return hits.some((token) => token.length >= 4);
  }


  /** Prefer contiguous opening align; if the opening was ASR-garbled, map heard
   * unique body tokens so ContinuationGate can confirm ayah-1 (Basmala-in-DB). */
  private alignForCommit(recognized: string[], verse: QuranVerse): number[] {
    const aligned = contiguousAlignToVerse(recognized, verse);
    if (aligned.length) return aligned;
    const { words, basmala } = verseAlignWords(verse);
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
    this.lock = verse;
    this.priorSurah = verse.surah;
    this.phase = 'following';
    this.mismatches = 0;
    this.wordIndex = matched.length ? matched[matched.length - 1]! : -1;
    this.trimmedForShortLast = false;
    this.window = keepLast(this.window, KEEP_AFTER_COMMIT_SEC);
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
      const start = this.bodyWords(verse)[0];
      if (!start || !recognized.some((word) => wordsMatch(word, start))) continue;
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
    if (this.ambiguousSurah(match, best, text) || !this.canLock(match, best, text, recognized)) return undefined;
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
    // Isolated mysterious-letter ayahs (e.g. 7:1 المص) need that token as a whole
    // word. Use phoneme body tokens: Uthmani الٓمٓصٓ is longer than 5 because of
    // maddahs, and substring hits like المصدر / المدرس must not lock.
    const { words: body } = verseAlignWords(verse);
    if (body.length === 1 && compact(body[0]!).length <= 5) {
      const token = compact(body[0]!);
      const heard = recognized.some((word) => compact(word) === token);
      if (!heard) return false;
    }
    const skip = openingBasmalaWordCount(verse);
    if (skip > 0) {
      const unique = verse.phonemes_joined_no_bsm_ns ?? compact(verse.phonemes_joined_no_bsm ?? '');
      if (unique && fragmentScore(compact(text), unique) < 0.45) return false;
    }
    return match.score >= LOCK_CLEAR_SCORE || !this.closeRival(match) || (verse.ayah > 1 && this.beatsRival(match, verse, text));
  }

  private hasVerseEvidence(text: string, verse: QuranVerse, recognized: string[]): boolean {
    const skip = this.uniqueOpeningSkip(verse);
    const { words, basmala } = verseAlignWords(verse);
    if (!words.length) return false;
    const matched = contiguousAlignFromOpening(recognized, words);
    const bodySkip = Math.max(0, skip - basmala);
    const bodyRef = compact(words.join(' '));
    const query = compact(text);
    if (!bodyRef) return false;
    const openingScore = () => {
      if (bodyRef.length <= query.length) return fragmentScore(bodyRef, query) >= LOCK_SCORE;
      const opening = bodyRef.slice(0, Math.min(bodyRef.length, query.length + 6));
      return Math.max(fragmentScore(query, opening), levRatio(query, opening)) >= LOCK_SCORE;
    };
    if (matched.length && matched[0] === 0) {
      if (!(bodySkip > 0 && words.length > bodySkip && !matched.includes(bodySkip))) {
        if (!openingIsAtStart(recognized, words) && matched.length < Math.min(2, words.length)) return false;
        return openingScore();
      }
    }
    // Opening ASR-garbled (سبحان for انا on 108:1) but unique body tokens are clear.
    const unique = words.slice(Math.max(bodySkip, 1));
    if (!unique.length) return false;
    const hits = unique.filter((token) => recognized.some((word) => wordsMatch(word, token)));
    const need = Math.min(2, unique.length);
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
    const end = Math.min(last, 1 + RIVAL_SCAN);
    let bestRival = 0;
    for (let ayah = 1; ayah <= end; ayah++) {
      const candidate = this.db.getVerse(rival.surah, ayah);
      if (candidate) bestRival = Math.max(bestRival, explainScore(text, candidate));
    }
    return explainScore(text, verse) >= Math.max(LOCK_SCORE, bestRival + SURAH_MARGIN);
  }

  private ambiguousSurah(match: QuranChampionMatch, verse: QuranVerse, text: string): boolean {
    const rival = match.runners_up?.[0];
    if (!rival || rival.surah === match.surah) return false;
    if (match.score - rival.score >= SURAH_MARGIN) return false;
    // Was `ayah <= 1 || !beatsRival` which made EVERY ayah-1 lock ambiguous whenever
    // any close cross-surah rival existed (Kawthar/Asr/Quraysh skipped to ayah 2+).
    return !this.beatsRival(match, verse, text);
  }

  private closeRival(match: QuranChampionMatch): boolean {
    const rival = match.runners_up?.[0];
    return Boolean(rival && match.score - rival.score < SURAH_MARGIN);
  }

  private locateAyah(match: QuranChampionMatch, text: string, recognized: string[]): QuranVerse | undefined {
    const span = this.ayahInSpan(match, text, recognized, !this.closeRival(match));
    if (span && !this.ambiguousSurah(match, span, text)) return span;
    const rival = match.runners_up?.[0];
    if (!rival || rival.surah === match.surah) return span;
    const pool = [
      ...this.scanOpenings(match.surah, 1, recognized, text),
      ...this.scanOpenings(rival.surah, 1, recognized, text),
    ];
    let best: QuranVerse | undefined;
    let bestScore = -1;
    for (const verse of pool) {
      const score = this.locationScore(text, verse);
      if (!best || score > bestScore + 0.03) {
        best = verse;
        bestScore = score;
      }
    }
    if (!best) return span;
    const otherBest = pool
      .filter((verse) => verse.surah !== best.surah)
      .reduce((max, verse) => Math.max(max, this.locationScore(text, verse)), 0);
    if (otherBest > 0 && bestScore < otherBest + SURAH_MARGIN) return span;
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
    const spanEnd = match.ayah_end && match.ayah_end > match.ayah ? match.ayah_end : match.ayah;
    const last = this.db.getSurah(match.surah).at(-1)?.ayah ?? spanEnd;
    const end = Math.min(last, Math.max(spanEnd, match.ayah + 3));
    let best: QuranVerse | undefined;
    let bestScore = -1;
    for (let ayah = match.ayah; ayah <= end; ayah++) {
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
      if (preferEarliest) {
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
    const last = this.db.getSurah(surah).at(-1)?.ayah ?? fromAyah;
    const end = Math.min(last, fromAyah + RIVAL_SCAN);
    const found: QuranVerse[] = [];
    for (let ayah = fromAyah; ayah <= end; ayah++) {
      const verse = this.db.getVerse(surah, ayah);
      if (!verse || skipUnusableLock(verse) || !heardDistinct(recognized, verse, this.uniqueOpeningSkip(verse))) continue;
      if (this.locationScore(text, verse) < LOCK_SCORE) continue;
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

  private lockFromNextSurahPool(text: string, recognized: string[], fromSurah: number): QuranVerse | undefined {
    const pool: { verse: QuranVerse; score: number; bonus: number }[] = [];
    for (const surah of remainingAfter(fromSurah)) {
      for (const verse of this.scanPoolOpenings(surah, recognized, text)) {
        if (this.sameRef(verse, this.lock ?? undefined)) continue;
        if (surah === fromSurah && verse.ayah > 1) continue;
        if (!this.hasOpeningEvidence(recognized, text, verse)) continue;
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
