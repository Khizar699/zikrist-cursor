import { fragmentScore, ratio as levRatio } from '../../node_modules/@tilawa/core/dist/levenshtein.js';

/** Align a CTC token stream to leftover current-ayah words plus mushaf-next.
 * Follow scores this tape; it does not re-search the mushaf on every hop. */

const LOOKAHEAD = 5;

const FORMULA_OPENINGS = new Set([
  'رب', 'الله', 'الحمد', 'قل', 'بسم',
  'allah', 'allahu', 'alhamdu', 'qul', 'bismi',
]);

export type TapeScore = {
  remainderHits: number;
  remainderTotal: number;
  remainderLast: number;
  nextHits: number;
  nextTotal: number;
  leftover: string[];
  unexplainedDistinctive: string[];
  nextHeard: boolean;
  holdsLock: boolean;
  remainderCoverage: number;
  nextCoverage: number;
  phonemeScore: number;
};

function compact(text: string): string {
  return text.replace(/\s+/g, '');
}

/** CTC madd / elongation: ييي، ااا → one letter so leftover is not "unexplained". */
export function collapseMaddRuns(text: string): string {
  return text.replace(/([\u0621-\u064A])\1{2,}/gu, '$1');
}

function normalizeToken(token: string): string {
  return collapseMaddRuns(compact(token));
}

function wordsMatch(left: string, right: string, minRatio = 0.8): boolean {
  if (left === right) return true;
  if (left.length <= 2 || right.length <= 2) return false;
  return levRatio(left, right) >= minRatio;
}

function relatedStem(left: string, right: string): boolean {
  if (left === right) return true;
  if (left.length <= 2 || right.length <= 2) return false;
  const longer = left.length >= right.length ? left : right;
  const shorter = left.length >= right.length ? right : left;
  return longer.endsWith(shorter) || longer.startsWith(shorter);
}

function softTokenMatch(left: string, right: string): boolean {
  if (wordsMatch(left, right) || relatedStem(left, right)) return true;
  const strip = (word: string) => compact(word).replace(/^ال/, '').replace(/^[وف]/, '');
  const a = strip(left);
  const b = strip(right);
  if (a.length < 3 || b.length < 3) return false;
  if (a.includes(b) || b.includes(a)) return true;
  return levRatio(a, b) >= 0.72;
}

/** Short CTC cousins such as الله / اله. Not a stem/substring hit of الصرط / صرط
 * or العلمين containing لام. Used to decide whether leftover is already explained. */
function explainedCousin(left: string, right: string): boolean {
  if (left === right || wordsMatch(left, right)) return true;
  const a = compact(left);
  const b = compact(right);
  if (a.length < 3 || b.length < 3 || a.length > 5 || b.length > 5) return false;
  if (Math.abs(a.length - b.length) > 1) return false;
  return levRatio(a, b) >= 0.7;
}

/** Next-ayah opening cousins, including 2-letter CTC لم / لام. Do not use this
 * to mark leftover as explained by the current ayah. */
export function openingCousin(left: string, right: string): boolean {
  if (explainedCousin(left, right)) return true;
  const a = compact(left);
  const b = compact(right);
  if (a.length < 2 || b.length < 2 || a.length > 5 || b.length > 5) return false;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (Math.min(a.length, b.length) < 3) return levRatio(a, b) >= 0.66;
  return false;
}

function isFormulaOpening(word: string): boolean {
  const token = compact(word);
  if (FORMULA_OPENINGS.has(token)) return true;
  const lower = token.toLowerCase();
  return /^rabb/.test(lower) || lower === 'allah' || lower === 'allahu'
    || /^alhamd/.test(lower) || lower === 'qul' || lower === 'bismi';
}

function tokenExplainedBy(token: string, words: string[]): boolean {
  const heard = normalizeToken(token);
  if (!heard) return false;
  return words.some((word) => {
    const expected = normalizeToken(word);
    if (!expected) return false;
    if (wordsMatch(heard, expected) || relatedStem(heard, expected) || explainedCousin(heard, expected)) {
      return true;
    }
    const a = heard.replace(/^ال/, '').replace(/^[وف]/, '');
    const b = expected.replace(/^ال/, '').replace(/^[وف]/, '');
    if (a.length < 3 || b.length < 3) return false;
    return a.startsWith(b) || b.startsWith(a) || a.endsWith(b) || b.endsWith(a);
  });
}

export function currentRemainder(body: string[], wordIndex: number): string[] {
  if (!body.length) return [];
  if (wordIndex < 0) return [...body];
  if (wordIndex >= body.length - 1) return [];
  return body.slice(wordIndex + 1);
}

function alignRemainder(recognized: string[], remainder: string[]): { verse: number; spoken: number }[] {
  const matched: { verse: number; spoken: number }[] = [];
  let cursor = 0;
  for (let spoken = 0; spoken < recognized.length; spoken++) {
    if (cursor >= remainder.length) break;
    const limit = Math.min(cursor + LOOKAHEAD, remainder.length);
    for (let index = cursor; index < limit; index++) {
      const expected = remainder[index]!;
      const heard = recognized[spoken]!;
      if (wordsMatch(heard, expected) || softTokenMatch(heard, expected)) {
        matched.push({ verse: index, spoken });
        cursor = index + 1;
        break;
      }
    }
  }
  return matched;
}

function alignNextFromOpening(recognized: string[], next: string[]): { indices: number[]; start: number } {
  if (!recognized.length || !next.length) return { indices: [], start: -1 };
  let start = -1;
  for (let index = 0; index < recognized.length; index++) {
    if (openingCousin(recognized[index]!, next[0]!)) {
      start = index;
      break;
    }
  }
  if (start < 0) return { indices: [], start: -1 };
  const indices = [0];
  let expected = 1;
  for (let spoken = start + 1; spoken < recognized.length && expected < next.length; spoken++) {
    if (wordsMatch(recognized[spoken]!, next[expected]!) || softTokenMatch(recognized[spoken]!, next[expected]!)) {
      indices.push(expected);
      expected += 1;
    }
  }
  return { indices, start };
}

/** Expected remainder+next phonemes vs the CTC decode string. Cheaper than a mushaf locate. */
export function expectedPhonemeScore(decoded: string, remainder: string[], next: string[]): number {
  const expected = compact([...remainder, ...next].join(' '));
  const query = compact(decoded);
  if (!expected || !query) return 0;
  return expected.length <= query.length ? fragmentScore(expected, query) : fragmentScore(query, expected);
}

function distinctiveUnexplained(tokens: string[], currentBody: string[], next: string[]): string[] {
  return tokens.filter((token) => {
    const text = normalizeToken(token);
    if (text.length < 4 || isFormulaOpening(text)) return false;
    if (tokenExplainedBy(text, currentBody)) return false;
    if (tokenExplainedBy(text, next)) return false;
    return true;
  });
}

function nextHasUniqueEvidence(next: string[], matched: number[], currentBody: string[]): boolean {
  if (!matched.length || !next.length) return false;
  const unique = matched.filter((index) => !tokenExplainedBy(next[index]!, currentBody));
  if (!unique.length) return false;
  if (isFormulaOpening(next[0]!)) {
    return unique.some((index) => index > 0 && next[index]!.length >= 4 && !isFormulaOpening(next[index]!));
  }
  return true;
}

export function scoreExpectedTape(
  recognized: string[],
  remainder: string[],
  next: string[],
  currentBody: string[] = remainder,
): TapeScore {
  const heard = recognized.map((token) => collapseMaddRuns(token));
  const remainderAligned = alignRemainder(heard, remainder);
  let leftover: string[];
  if (remainder.length === 0) leftover = heard;
  else if (remainderAligned.length) leftover = heard.slice(remainderAligned[remainderAligned.length - 1]!.spoken + 1);
  else leftover = heard.filter((token) => !tokenExplainedBy(token, remainder));

  const nextAligned = alignNextFromOpening(leftover, next);
  const leftoverAfterNext = nextAligned.start >= 0
    ? leftover.slice(nextAligned.start + nextAligned.indices.length)
    : leftover;
  const unexplainedDistinctive = distinctiveUnexplained(leftoverAfterNext, currentBody, next);
  const nextHeard = nextHasUniqueEvidence(next, nextAligned.indices, currentBody);
  const remainderTotal = remainder.length;
  const remainderHits = remainderAligned.length;
  const nextHits = nextAligned.indices.length;

  return {
    remainderHits,
    remainderTotal,
    remainderLast: remainderAligned.at(-1)?.verse ?? -1,
    nextHits,
    nextTotal: next.length,
    leftover: leftoverAfterNext,
    unexplainedDistinctive,
    nextHeard,
    holdsLock: unexplainedDistinctive.length === 0,
    remainderCoverage: remainderTotal === 0 ? 0 : remainderHits / remainderTotal,
    nextCoverage: next.length ? nextHits / next.length : 0,
    phonemeScore: expectedPhonemeScore(heard.join(' '), remainder, next),
  };
}
