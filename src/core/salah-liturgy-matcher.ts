/** Offline salah liturgy detector. Separate from Quran acquire/follow. */

import type { FollowerPhase, RecognitionMessage, VerseRef } from './types';
import {
  assertSalahLiturgyPack,
  normalizeLiturgyArabic,
  type SalahLiturgyCategory,
  type SalahLiturgyPack,
  type SalahLiturgyPhrase,
} from './salah-liturgy';

/** Similarity score, not a calibrated probability. Optional on the event. */
export type SalahLiturgyLockEvent = {
  kind: 'salah_liturgy';
  phraseId: string;
  category: SalahLiturgyCategory;
  atMs: number;
  confidence?: number;
};

export type LiturgyObserveInput = {
  tokens: string[];
  atMs: number;
  quranPhase: FollowerPhase;
  quranLock: VerseRef | null;
  ayahComplete?: boolean;
  voiced?: boolean;
};

const MAX_BUFFER = 80;
const SHORT_REPEAT_MS = 2000;
const LONG_REPEAT_MS = 400;
const QURAN_COMMIT_TYPES = new Set(['verse_match', 'word_progress', 'heard_words']);

const ALLAH_TOKENS = new Set(['الله', 'allahu', 'allah', 'allaha']);
const AKBAR_TOKENS = new Set(['أكبر', 'اكبر', 'akbar', 'akbaru']);
const AMIN_TOKENS = new Set(['آمين', 'امين', 'amin', 'ameen', 'aameen']);

const FATIHA_DISTINCT = new Set([
  'العالمين', 'العلمين', 'alalamin', 'اياك', 'iyyaka', 'مالك', 'maliki',
  'اهدنا', 'ihdina', 'نستعين', 'nastain', 'المستقيم',
]);
const FATIHA_HAMD = new Set(['الحمد', 'alhamdu']);
const FATIHA_LILLAH = new Set(['لله', 'lillahi']);
const IKHLAS_MARKERS = new Set(['هو', 'huwa', 'أحد', 'احد', 'ahad', 'الصمد', 'alsamad']);
const ASR_MARKERS = new Set(['العصر', 'والعصر', 'alasr', 'walasr']);
const BASMALA_LEAD = new Set(['بسم', 'bismi', 'bism']);
const BASMALA_TAIL = new Set(['الرحمن', 'الرحيم', 'alrahman', 'alrahim']);
const QUL = new Set(['قل', 'qul']);
const AUDHU = new Set(['أعوذ', 'اعوذ', 'audhu', 'aoodhu']);
const BIRABBI = new Set(['برب', 'birabbi']);

type PreparedPhrase = {
  phrase: SalahLiturgyPhrase;
  tokens: string[];
};

export class SalahLiturgyMatcher {
  private readonly prepared: PreparedPhrase[];
  private buffer: string[] = [];
  private lastLock: { phraseId: string; atMs: number } | null = null;

  constructor(phrases: readonly SalahLiturgyPhrase[]) {
    this.prepared = [...phrases]
      .map((phrase) => ({ phrase, tokens: tokenize(phrase.arabic_recognition_normalized) }))
      .filter((row) => row.tokens.length > 0)
      .sort((left, right) => right.tokens.length - left.tokens.length);
  }

  reset(): void {
    this.buffer = [];
    this.lastLock = null;
  }

  observe(input: LiturgyObserveInput): SalahLiturgyLockEvent | null {
    if (input.voiced === false) return null;
    const incoming = tokenizeAll(input.tokens);
    if (!incoming.length) return null;
    this.buffer = mergeHeard(this.buffer, incoming);

    const midAyah = isMidAyahFollow(input);
    const quranish = quranLikeWindow(incoming);
    let best: { event: SalahLiturgyLockEvent; end: number; length: number } | null = null;

    for (const row of this.prepared) {
      const windowLocal = row.tokens.length <= 5;
      const heard = windowLocal ? incoming : this.buffer;
      if (windowLocal && midAyah) continue;
      if (windowLocal && quranish.fatihaIkhlasAsr) continue;
      if (windowLocal && quranish.basmala) continue;
      if (row.phrase.id === 'istiadha' && quranish.quranIstadha) continue;
      if (row.phrase.id === 'amin' && (incoming.length > 2 || quranish.fatihaIkhlasAsr)) continue;
      const aligned = alignPhrase(heard, row.tokens, windowLocal);
      if (!aligned) continue;
      const coverage = aligned.matched / row.tokens.length;
      if (coverage + 1e-9 < minCoverage(row.tokens.length, windowLocal)) continue;
      if (windowLocal && extraTokens(heard.length, aligned.matched, row.tokens.length) > maxExtra(row)) continue;
      if (!hasDistinctiveOpening(heard, row)) continue;
      if (this.inCooldown(row.phrase.id, input.atMs, windowLocal)) continue;
      const confidence = Math.round(Math.min(1, coverage) * 1000) / 1000;
      const event: SalahLiturgyLockEvent = {
        kind: 'salah_liturgy',
        phraseId: row.phrase.id,
        category: row.phrase.category,
        atMs: input.atMs,
        confidence,
      };
      const length = row.tokens.length;
      if (
        !best
        || coverage > (best.event.confidence ?? 0) + 1e-9
        || (Math.abs(coverage - (best.event.confidence ?? 0)) < 1e-9 && length > best.length)
      ) {
        best = { event, end: aligned.end, length };
      }
    }

    if (!best) return null;
    if (best.length > 5) this.buffer = this.buffer.slice(best.end);
    this.lastLock = { phraseId: best.event.phraseId, atMs: input.atMs };
    if (process.env.ZIKRIST_TRACE === '1') {
      console.log(JSON.stringify(best.event));
    }
    return best.event;
  }

  private inCooldown(phraseId: string, atMs: number, short: boolean): boolean {
    if (!this.lastLock || this.lastLock.phraseId !== phraseId) return false;
    return atMs - this.lastLock.atMs < (short ? SHORT_REPEAT_MS : LONG_REPEAT_MS);
  }
}

export function matcherFromPack(data: unknown): SalahLiturgyMatcher {
  assertSalahLiturgyPack(data);
  return new SalahLiturgyMatcher(data.phrases);
}

export function liturgyOverridesQuran(liturgy: SalahLiturgyLockEvent | null): boolean {
  return liturgy !== null;
}

/** Drop Quran commits when a liturgy lock owns the window. Does not retune follower thresholds. */
export function filterQuranMessagesForLiturgy(messages: RecognitionMessage[]): RecognitionMessage[] {
  return messages.filter((message) => !QURAN_COMMIT_TYPES.has(message.type));
}

export function runLiturgyAgainstQuran(
  matcher: SalahLiturgyMatcher,
  input: LiturgyObserveInput,
  quranMessages: RecognitionMessage[],
): { liturgy: SalahLiturgyLockEvent | null; quran: RecognitionMessage[] } {
  const liturgy = matcher.observe(input);
  const quran = liturgyOverridesQuran(liturgy)
    ? filterQuranMessagesForLiturgy(quranMessages)
    : quranMessages;
  return { liturgy, quran };
}

/** Follow state from before `feed()`. Short liturgy must see the same hop as a first false Quran lock. */
export function liturgyFollowContextBeforeFeed(follower: {
  phase: FollowerPhase;
  lockedRef: VerseRef | null;
  lockedAyahComplete?: boolean;
}): Pick<LiturgyObserveInput, 'quranPhase' | 'quranLock' | 'ayahComplete'> {
  return {
    quranPhase: follower.phase,
    quranLock: follower.lockedRef,
    ayahComplete: follower.lockedAyahComplete,
  };
}

export function packFromUnknown(data: unknown): SalahLiturgyPack {
  assertSalahLiturgyPack(data);
  return data;
}

function isMidAyahFollow(input: LiturgyObserveInput): boolean {
  return input.quranPhase === 'following' && input.quranLock !== null && input.ayahComplete !== true;
}

function minCoverage(length: number, windowLocal: boolean): number {
  if (windowLocal || length <= 5) return 1;
  return 0.72;
}

function maxExtra(row: PreparedPhrase): number {
  if (row.phrase.id === 'amin' || row.tokens.length <= 2) return 1;
  return 2;
}

function extraTokens(heardLength: number, matched: number, phraseLength: number): number {
  return Math.max(0, heardLength - Math.max(matched, phraseLength));
}

function tokenizeAll(tokens: string[]): string[] {
  const out: string[] = [];
  for (const token of tokens) {
    const parts = tokenize(token);
    if (parts.length) out.push(...parts);
  }
  return out;
}

function tokenize(text: string): string[] {
  return normalizeLiturgyArabic(text).split(/\s+/).filter(Boolean).map(foldToken);
}

function foldToken(token: string): string {
  return token
    .normalize('NFC')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

function mergeHeard(previous: string[], incoming: string[]): string[] {
  if (!previous.length) return incoming.slice(-MAX_BUFFER);
  if (containsWindow(previous, incoming)) return previous.slice(-MAX_BUFFER);
  const overlap = Math.min(previous.length, incoming.length);
  for (let count = overlap; count > 0; count--) {
    if (sameTokens(previous.slice(-count), incoming.slice(0, count))) {
      return [...previous, ...incoming.slice(count)].slice(-MAX_BUFFER);
    }
  }
  return [...previous, ...incoming].slice(-MAX_BUFFER);
}

function containsWindow(haystack: string[], needle: string[]): boolean {
  if (needle.length > haystack.length) return false;
  for (let start = 0; start <= haystack.length - needle.length; start++) {
    if (sameTokens(haystack.slice(start, start + needle.length), needle)) return true;
  }
  return false;
}

function sameTokens(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((token, index) => token === right[index]);
}

function alignPhrase(
  heard: string[],
  phrase: string[],
  consecutive: boolean,
): { start: number; end: number; matched: number } | null {
  if (!heard.length || !phrase.length) return null;
  if (phrase.length === 2 && isTakbeerPair(phrase) && joinedTakbeer(heard)) {
    return { start: 0, end: heard.length, matched: 2 };
  }
  let best: { start: number; end: number; matched: number } | null = null;
  for (let start = 0; start < heard.length; start++) {
    let index = 0;
    let cursor = start;
    let skips = 0;
    while (index < phrase.length && cursor < heard.length) {
      if (tokensMatch(heard[cursor]!, phrase[index]!)) {
        index += 1;
        cursor += 1;
        continue;
      }
      if (!consecutive && phrase.length >= 6 && skips < 2) {
        skips += 1;
        cursor += 1;
        continue;
      }
      break;
    }
    if (index === 0) continue;
    const candidate = { start, end: cursor, matched: index };
    if (!best || candidate.matched > best.matched || (candidate.matched === best.matched && start < best.start)) {
      best = candidate;
    }
    if (index === phrase.length) break;
  }
  return best;
}

function isTakbeerPair(phrase: string[]): boolean {
  return phrase.length === 2 && ALLAH_TOKENS.has(phrase[0]!) && AKBAR_TOKENS.has(phrase[1]!);
}

function joinedTakbeer(heard: string[]): boolean {
  return heard.some((token) => {
    const compact = token.replace(/\s+/g, '');
    return compact === 'اللهأكبر' || compact === 'allahuakbar';
  });
}

function tokensMatch(heard: string, ref: string): boolean {
  if (heard === ref) return true;
  if (ALLAH_TOKENS.has(heard) && ALLAH_TOKENS.has(ref)) return true;
  if (AKBAR_TOKENS.has(heard) && AKBAR_TOKENS.has(ref)) return true;
  if (AMIN_TOKENS.has(heard) && AMIN_TOKENS.has(ref)) return true;
  if (heard.length < 4 || ref.length < 4) return false;
  const n = Math.max(heard.length, ref.length);
  return 1 - levenshtein(heard, ref) / n >= 0.82;
}

function hasDistinctiveOpening(heard: string[], row: PreparedPhrase): boolean {
  if (row.tokens.length < 6) return true;
  const first = row.tokens[0]!;
  const second = row.tokens[1];
  const start = heard.findIndex((token) => tokensMatch(token, first));
  if (start < 0) return false;
  if (!second) return true;
  return heard.slice(start + 1).some((token) => tokensMatch(token, second));
}

function quranLikeWindow(tokens: string[]): {
  fatihaIkhlasAsr: boolean;
  basmala: boolean;
  quranIstadha: boolean;
} {
  const fatiha = tokens.some((token) => FATIHA_DISTINCT.has(token))
    || (tokens.some((token) => FATIHA_HAMD.has(token)) && tokens.some((token) => FATIHA_LILLAH.has(token)));
  const ikhlas = tokens.filter((token) => IKHLAS_MARKERS.has(token)).length >= 2
    || tokens.some((token) => token === 'الصمد' || token === 'alsamad');
  const asr = tokens.some((token) => ASR_MARKERS.has(token));
  const basmala = tokens.some((token) => BASMALA_LEAD.has(token))
    && tokens.some((token) => BASMALA_TAIL.has(token));
  const quranIstadha = tokens.some((token) => AUDHU.has(token))
    && tokens.some((token) => BIRABBI.has(token) || QUL.has(token));
  return {
    fatihaIkhlasAsr: fatiha || ikhlas || asr,
    basmala,
    quranIstadha,
  };
}

function levenshtein(left: string, right: string): number {
  if (left === right) return 0;
  const cols = left.length + 1;
  const rows = right.length + 1;
  const dp = new Uint16Array(cols * rows);
  for (let i = 0; i < cols; i++) dp[i] = i;
  for (let j = 0; j < rows; j++) dp[j * cols] = j;
  for (let j = 1; j < rows; j++) {
    for (let i = 1; i < cols; i++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      dp[j * cols + i] = Math.min(
        dp[j * cols + i - 1]! + 1,
        dp[(j - 1) * cols + i]! + 1,
        dp[(j - 1) * cols + i - 1]! + cost,
      );
    }
  }
  return dp[(rows - 1) * cols + (cols - 1)]!;
}
