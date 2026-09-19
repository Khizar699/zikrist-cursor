import type { QuranDB, QuranVerse } from '@tilawa/core';
import { openingBasmalaWordCount } from '../basmala';

const EPS = 1e-6;

function compact(text: string): string {
  return text.replace(/\s+/g, '');
}

function verseBodyTokens(verse: QuranVerse): string[] {
  const declared = openingBasmalaWordCount(verse);
  const words = verse.phoneme_words;
  const body = declared > 0 && words[0] === 'بسم' && words.length > declared
    ? words.slice(declared)
    : words;
  return body.map((w) => compact(w)).filter(Boolean);
}

/** Quran-wide token document frequency for IDF weighting. */
export class TokenDocumentStats {
  private readonly df = new Map<string, number>();
  readonly passageCount: number;

  constructor(db: QuranDB) {
    const seenPerPassage = new Map<number, Set<string>>();
    for (const verse of db.verses) {
      const key = verse.surah * 1000 + verse.ayah;
      let set = seenPerPassage.get(key);
      if (!set) {
        set = new Set<string>();
        seenPerPassage.set(key, set);
      }
      for (const token of verseBodyTokens(verse)) {
        set.add(token);
      }
    }
    this.passageCount = seenPerPassage.size;
    for (const tokens of seenPerPassage.values()) {
      for (const token of tokens) {
        this.df.set(token, (this.df.get(token) ?? 0) + 1);
      }
    }
  }

  idf(token: string): number {
    const t = compact(token);
    if (!t) return 0;
    const df = this.df.get(t) ?? 0;
    return Math.log((this.passageCount + EPS) / (df + EPS));
  }

  /** Normalized to ~0..1 for combining with fuzzy scores. */
  idfNorm(token: string): number {
    const raw = this.idf(token);
    const max = Math.log(this.passageCount + EPS);
    if (max <= 0) return 0;
    return Math.min(1, Math.max(0, raw / max));
  }
}
