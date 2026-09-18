import type { Occurrence, RecognitionMessage, VerseRef } from './types';

export type FollowSkip = { from: VerseRef; to: VerseRef; missed: number; segment: number };

/** Confirmed verse_match events only. Do not adopt Tilawa's final_sequence. */
export class Timeline {
  readonly occurrences: Occurrence[] = [];
  readonly skips: FollowSkip[] = [];
  private segment = 0;
  breakSegment(): void { this.segment++; }

  accept(message: RecognitionMessage, audioOffsetMs: number, now = Date.now()): Occurrence | null {
    if (message.type === 'word_progress') {
      const last = this.occurrences.at(-1);
      if (last && last.surah === message.surah && last.ayah === message.ayah && last.segment === this.segment) {
        last.matchedWords = Math.max(last.matchedWords, new Set(message.matched_indices).size);
        last.totalWords = message.total_words;
      }
      return null;
    }
    if (message.type !== 'verse_match') return null;
    const last = this.occurrences.at(-1);
    if (last && last.surah === message.surah && last.ayah === message.ayah && last.segment === this.segment) return null;
    if (last && last.segment === this.segment && last.surah === message.surah && message.ayah > last.ayah + 1) {
      this.skips.push({
        from: { surah: last.surah, ayah: last.ayah },
        to: { surah: message.surah, ayah: message.ayah },
        missed: message.ayah - last.ayah - 1,
        segment: this.segment,
      });
    }
    const occurrence: Occurrence = {
      index: this.occurrences.length, surah: message.surah, ayah: message.ayah,
      confirmedAtMs: now, audioOffsetMs, score: message.confidence,
      segment: this.segment, matchedWords: 0, totalWords: 0,
    };
    this.occurrences.push(occurrence);
    return occurrence;
  }
}
