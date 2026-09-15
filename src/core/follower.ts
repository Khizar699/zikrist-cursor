import type { QuranChampionMatch, QuranDB, QuranVerse, TilawaSession, TranscribeResult, VerseMatchMessage, WorkerOutbound } from '@tilawa/core';
import { fragmentScore, ratio as levRatio } from '../../node_modules/@tilawa/core/dist/levenshtein.js';
import { isFatihaBasmala, isFatihaBasmalaTail, openingBasmalaWordCount } from './basmala';
import { recordRecognitionCycle } from './recognition-clocks';
import { remainingAfter, rerankChampion, surahBonus, acousticChampion, TIE_BREAK_MARGIN } from './salah-prior';
import { TRACKING_COMPLETION_COVERAGE } from './sequential';
import type { FollowerPhase, VerseRef } from './types';

export type { FollowerPhase };
export type TranscribeFn = (audio: Float32Array, locate: boolean) => Promise<TranscribeResult>;
export type FeedTimings = { queueWaitMs?: number; stallMs?: number };

const SAMPLE_RATE = 16000;
const ACQUIRE_MIN_SEC = 0.9;
const ACQUIRE_MAX_SEC = 4;
export const FOLLOW_WINDOW_SEC = 1.2;
export const FOLLOW_TRIGGER_SEC = 0.4;
const KEEP_AFTER_COMMIT_SEC = 0.5;
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

function openingWordMatch(left: string, right: string): boolean {
  return left === right || relatedStem(left, right);
}

/** Find the ayah opening anywhere in the window. The first word must be the
 * same stem, not a 0.8 hit like الله / لله or الرحمن / الحمد. */
function alignFromOpening(recognized: string[], verseWords: string[]): number[] {
  if (!verseWords.length) return [];
  for (let start = 0; start < recognized.length; start++) {
    if (!openingWordMatch(recognized[start]!, verseWords[0]!)) continue;
    const matched = alignWords(recognized.slice(start), verseWords);
    if (matched.length > 0 && matched[0] === 0) return matched;
  }
  return [];
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

function heardDistinct(recognized: string[], verse: QuranVerse, skip: number): boolean {
  const matched = alignFromOpening(recognized, verse.phoneme_words);
  if (!matched.length || matched[0] !== 0) return false;
  if (skip > 0 && verse.phoneme_words.length > skip) return matched.some((index) => index >= skip);
  return true;
}

function skipUnusableLock(verse: QuranVerse): boolean {
  return isFatihaBasmala(verse) || isFatihaBasmalaTail(verse);
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
  }

  async feed(samples: Float32Array, timings: FeedTimings = {}): Promise<WorkerOutbound[]> {
    if (!samples.length) return [];
    this.queueTimings = timings;
    this.window = concatAudio(this.window, samples);
    this.fresh += samples.length;
    const maxSec = this.phase === 'following' ? FOLLOW_WINDOW_SEC : ACQUIRE_MAX_SEC;
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

  private async acquire(): Promise<WorkerOutbound[]> {
    if (this.window.length < samplesFor(ACQUIRE_MIN_SEC) || this.fresh < samplesFor(ACQUIRE_MIN_SEC)) return [];
    this.fresh = 0;
    const result = await this.transcribe(this.window, true);
    this.noteCycle(result, true);
    return this.lockFromTranscript(result, false);
  }

  private lockFromTranscript(result: TranscribeResult, allowSearch: boolean): WorkerOutbound[] {
    const text = result.text.trim();
    if (compact(text).length < 6) return [];
    const raw = this.rawMatch(result, allowSearch);
    if (!raw) return [];
    const recognized = text.split(/\s+/).filter(Boolean);
    const ranked = rerankChampion(raw, this.priorSurah);
    const acoustic = acousticChampion(raw);
    const attempts = [ranked];
    if (ranked.surah !== acoustic.surah || ranked.ayah !== acoustic.ayah) attempts.push(acoustic);
    let candidates: WorkerOutbound[] | undefined;
    for (const match of attempts) {
      const verse = this.locateAyah(match, text, recognized);
      if (!verse || this.ambiguousSurah(match, verse, text)) {
        candidates ??= [{
          type: 'verse_candidate',
          candidates: this.candidateList(match),
          stable: false,
          final_flush: false,
        }];
        continue;
      }
      if (!this.canLock(match, verse, text, recognized)) continue;
      return this.commit(verse, match.score, alignFromOpening(recognized, verse.phoneme_words));
    }
    const alternative = this.alternativeHeardVerse(recognized, text, ranked);
    if (alternative) {
      return this.commit(alternative, this.locationScore(text, alternative), alignFromOpening(recognized, alternative.phoneme_words));
    }
    return candidates ?? [];
  }

  private async follow(): Promise<WorkerOutbound[]> {
    if (!this.lock || this.fresh < samplesFor(FOLLOW_TRIGGER_SEC)) return [];
    this.fresh = 0;
    const current = this.lock;
    const next = this.db.getNextVerse(current.surah, current.ayah);
    const coverage = current.phoneme_words.length
      ? (this.wordIndex + 1) / current.phoneme_words.length
      : 0;
    const alreadyComplete = current.phoneme_words.length > 0 && (
      this.wordIndex >= current.phoneme_words.length - 1
      || coverage >= TRACKING_COMPLETION_COVERAGE
    );
    const atSurahBoundary = Boolean(alreadyComplete && next && next.surah !== current.surah);
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
    const matched = alignWords(recognized, current.phoneme_words);
    const wordIndex = matched.length ? matched[matched.length - 1]! : this.wordIndex;
    const advanced = wordIndex > this.wordIndex;
    const sharedPrefixOnly = this.onlySharedOpening(recognized, current);
    const neighborhood = Math.max(
      sharedPrefixOnly ? 0 : currentScore,
      previousScore,
      heardNext ? nextScore : 0,
    );
    if (advanced) this.wordIndex = wordIndex;
    if (advanced && !sharedPrefixOnly) this.mismatches = 0;
    const complete = current.phoneme_words.length > 0 && (
      this.wordIndex >= current.phoneme_words.length - 1
      || (this.wordIndex + 1) / current.phoneme_words.length >= TRACKING_COMPLETION_COVERAGE
    );

    const messages: WorkerOutbound[] = [];
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
      const pooled = this.lockFromNextSurahPool(text, recognized, current.surah);
      if (pooled) {
        return [...messages, ...this.commit(pooled, this.locationScore(text, pooled), alignFromOpening(recognized, pooled.phoneme_words))];
      }
    }

    const located = locate || atSurahBoundary ? this.matchFromTranscript(result, atSurahBoundary && !locate) : null;
    const locatedVerse = located ? this.locateAyah(located, text, recognized) : undefined;
    const locatedScore = locatedVerse ? this.locationScore(text, locatedVerse) : 0;
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
    );

    if (jump && located && locatedVerse) {
      return [...messages, ...this.commit(locatedVerse, located.score, alignFromOpening(recognized, locatedVerse.phoneme_words))];
    }

    if (next && this.shouldAdvance(recognized, next, current)) {
      return [...messages, ...this.commit(next, Math.max(nextScore, currentScore), alignFromOpening(recognized, next.phoneme_words))];
    }

    if (complete && !next) {
      const pooled = this.lockFromNextSurahPool(text, recognized, current.surah);
      if (pooled) {
        return [...messages, ...this.commit(pooled, this.locationScore(text, pooled), alignFromOpening(recognized, pooled.phoneme_words))];
      }
      this.startReacquire();
      return messages;
    }

    if ((!advanced || sharedPrefixOnly) && neighborhood < NEIGHBORHOOD_KEEP) {
      this.mismatches++;
      if (this.mismatches >= MISMATCH_LIMIT) {
        this.startReacquire(false);
        const acquired = this.lockFromTranscript(result, false);
        if (!acquired.some((message) => message.type === 'verse_match')) this.fresh = this.window.length;
        return [...messages, ...acquired];
      }
    } else if ((advanced && !sharedPrefixOnly) || neighborhood >= NEIGHBORHOOD_KEEP) {
      this.mismatches = 0;
    }
    return messages;
  }

  /** Unique leftover opening of mushaf-next. Overlapping current-ayah audio in
   * the follow window must not veto that evidence with a mixed-window score. */
  private shouldAdvance(recognized: string[], next: QuranVerse, current: QuranVerse): boolean {
    return heardDistinct(remainingAfterCurrent(recognized, current.phoneme_words), next, this.distinctSkip(next, current));
  }

  private commit(verse: QuranVerse, score: number, matched: number[]): WorkerOutbound[] {
    this.lock = verse;
    this.priorSurah = verse.surah;
    this.phase = 'following';
    this.mismatches = 0;
    this.wordIndex = matched.length ? matched[matched.length - 1]! : -1;
    this.window = keepLast(this.window, KEEP_AFTER_COMMIT_SEC);
    this.fresh = 0;
    const messages: WorkerOutbound[] = [this.matchMessage(verse, score)];
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
    if (skip <= 0 || verse.phoneme_words.length <= skip) return false;
    const matched = alignFromOpening(recognized, verse.phoneme_words);
    return matched.length > 0 && matched[0] === 0 && matched.every((index) => index < skip);
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

  private canLock(match: QuranChampionMatch, verse: QuranVerse, text: string, recognized: string[]): boolean {
    if (skipUnusableLock(verse) || match.score < LOCK_SCORE) return false;
    if (!this.hasVerseEvidence(text, verse, recognized)) return false;
    const skip = openingBasmalaWordCount(verse);
    if (skip > 0) {
      const unique = verse.phonemes_joined_no_bsm_ns ?? compact(verse.phonemes_joined_no_bsm ?? '');
      if (unique && fragmentScore(compact(text), unique) < 0.45) return false;
    }
    return match.score >= LOCK_CLEAR_SCORE || !this.closeRival(match) || (verse.ayah > 1 && this.beatsRival(match, verse, text));
  }

  private hasVerseEvidence(text: string, verse: QuranVerse, recognized: string[]): boolean {
    const skip = this.uniqueOpeningSkip(verse);
    const head = recognized.slice(0, 2);
    const matched = alignFromOpening(head, verse.phoneme_words);
    if (!matched.length || matched[0] !== 0) return false;
    const full = alignFromOpening(recognized, verse.phoneme_words);
    if (skip > 0 && verse.phoneme_words.length > skip && !full.some((index) => index >= skip)) return false;
    const ref = verseText(verse);
    if (ref.length <= compact(text).length) return explainScore(text, verse) >= LOCK_SCORE;
    return openingScore(text, verse) >= LOCK_SCORE;
  }

  private locationScore(text: string, verse: QuranVerse): number {
    const ref = verseText(verse);
    return ref.length <= compact(text).length ? explainScore(text, verse) : openingScore(text, verse);
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
    return verse.ayah <= 1 || !this.beatsRival(match, verse, text);
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
      if (recognized.length && !heardDistinct(recognized, verse, this.uniqueOpeningSkip(verse))) continue;
      if (ayah > spanEnd && !heardDistinct(recognized, verse, this.uniqueOpeningSkip(verse))) continue;
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

  private scanPoolOpenings(surah: number, recognized: string[], text: string): QuranVerse[] {
    const first = this.db.getVerse(surah, 1);
    const fromAyah = first && skipUnusableLock(first) ? 2 : 1;
    const verse = this.db.getVerse(surah, fromAyah);
    if (!verse || skipUnusableLock(verse) || !heardDistinct(recognized, verse, this.uniqueOpeningSkip(verse))) return [];
    if (this.locationScore(text, verse) < LOCK_SCORE) return [];
    return [verse];
  }

  private lockFromNextSurahPool(text: string, recognized: string[], fromSurah: number): QuranVerse | undefined {
    const pool: { verse: QuranVerse; score: number; bonus: number }[] = [];
    for (const surah of remainingAfter(fromSurah)) {
      for (const verse of this.scanPoolOpenings(surah, recognized, text)) {
        if (this.sameRef(verse, this.lock ?? undefined)) continue;
        if (surah === fromSurah && verse.ayah > 1) continue;
        if (!heardDistinct(recognized, verse, this.distinctSkip(verse))) continue;
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
