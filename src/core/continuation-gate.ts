import type { VerseMatchMessage, WordProgressMessage } from '@tilawa/core';
import { isFatihaBasmala, openingBasmalaWordCount } from './basmala';
import { refKey, type RecognitionMessage, type VerseRef } from './types';

/** Extra guard around an upstream commit. Shared Basmala openings, unexpected
 * jumps and silence-flush first locations need subsequent unique evidence. */
export class ContinuationGate {
  private current: VerseRef | null = null;
  private pending: { message: VerseMatchMessage; voicedMs: number } | null = null;
  constructor(private readonly nextVerse: (ref: VerseRef) => VerseRef | undefined) {}
  reset(): void { this.current = null; this.pending = null; }
  /** Drop jump evidence from discarded audio. Keep the last accepted verse so
   * sequential following can resume after a tracker reset. */
  dropPending(): void { this.pending = null; }
  get isCheckingJump(): boolean { return this.pending !== null; }
  get isAmbiguousOpening(): boolean {
    return this.pending !== null && this.current === null && openingBasmalaWordCount(this.pending.message) > 0;
  }

  accept(messages: RecognitionMessage[], voicedMs: number, voiced = false): RecognitionMessage[] {
    const accepted: RecognitionMessage[] = [];
    for (const message of messages) {
      if (message.type === 'verse_match') {
        const next = this.current ? this.nextVerse(this.current) : undefined;
        const expected = this.current && (refKey(this.current) === refKey(message) || (next && refKey(next) === refKey(message)));
        const holdNextSurahBasmala = Boolean(
          expected
          && this.current
          && this.current.surah !== message.surah
          && openingBasmalaWordCount(message) > 0
        );
        if (expected && !holdNextSurahBasmala) {
          this.current = message; this.pending = null; accepted.push(message);
        } else if (!this.current && this.pending && isFatihaBasmala(this.pending.message) && message.surah === 1 && message.ayah === 2) {
          accepted.push(this.pending.message, message);
          this.current = message;
          this.pending = null;
        } else if (
          !this.current
          && this.pending
          && this.pending.message.ayah === 1
          && !isFatihaBasmala(this.pending.message)
          && message.surah === this.pending.message.surah
          && message.ayah === 2
        ) {
          // Ayah-1 body was held; mushaf-next of the same surah disambiguates it.
          accepted.push(this.pending.message, message);
          this.current = message;
          this.pending = null;
        } else if (!this.current && voiced && openingBasmalaWordCount(message) === 0) {
          this.current = message; this.pending = null; accepted.push(message);
        } else if (!this.pending || refKey(this.pending.message) !== refKey(message)) {
          this.pending = { message, voicedMs };
        }
      } else if (message.type === 'word_progress' && this.pending && refKey(message) === refKey(this.pending.message)) {
        if (this.canConfirmPending(message, voicedMs, voiced)) {
          this.current = this.pending.message;
          accepted.push(this.pending.message, message);
          this.pending = null;
        }
      } else { accepted.push(message); }
    }
    return accepted;
  }

  private canConfirmPending(message: WordProgressMessage, voicedMs: number, voiced: boolean): boolean {
    if (!this.pending) return false;
    if (isFatihaBasmala(this.pending.message)) return false;
    const skip = openingBasmalaWordCount(this.pending.message);
    const unique = [...new Set(message.matched_indices)];
    if (skip > 0) {
      const bodyHits = unique.filter((index) => index >= skip);
      if (!bodyHits.length) return false;
      // A one-word ayah-1 body (العصر, الم) has no later index to wait for.
      // Longer bodies still need a word after the first post-Basmala token
      // because that first token is often shared (قُلْ, إِنَّ).
      const bodyLen = Math.max(0, message.total_words - skip);
      if (bodyLen <= 1) return true;
      return unique.some((index) => index > skip);
    }
    if (!unique.includes(0)) return false;
    const lastAyah = this.current !== null && this.nextVerse(this.current) === undefined;
    const needed = lastAyah
      ? Math.min(2, message.total_words)
      : Math.min(
        message.total_words,
        message.total_words >= 8 ? Math.max(3, Math.ceil(message.total_words * 0.15)) : 2,
      );
    if (message.total_words <= 0 || unique.length < needed) return false;
    if (lastAyah && voiced) return true;
    return voiced && voicedMs - this.pending.voicedMs >= 500;
  }
}
