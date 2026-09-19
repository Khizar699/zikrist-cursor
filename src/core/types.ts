import type { VerseMatchMessage, WorkerOutbound } from '@tilawa/core';

/** Follower-owned display commit flag. False = tentative jump; gate holds pending. */
export type ZikristVerseMatch = VerseMatchMessage & { locationCommit?: boolean };

export type Language = 'en' | 'ur';
export type FollowerPhase = 'acquiring' | 'following' | 'reacquiring';
export type VerseRef = { surah: number; ayah: number };
export type Translation = { translation: string; footnotes: string };
export type DisplayVerse = VerseRef & Translation & { arabic: string; name: string; nameArabic: string; basmala: string | null };
export type Settings = { language: Language | null; debugHud?: boolean };
export type Occurrence = VerseRef & {
  index: number; confirmedAtMs: number; audioOffsetMs: number; score: number;
  segment: number; matchedWords: number; totalWords: number;
};
/** Live word cursor. Not a translation and not a history claim. */
export type WordProgress = { surah: number; ayah: number; wordIndex: number; totalWords: number };
/** Unconfirmed Arabic prefix. Not a translation and not a verse claim. */
export type HeardWordsMessage = { type: 'heard_words'; words: string[] };
export type RecognitionMessage = WorkerOutbound | HeardWordsMessage;
export const refKey = (ref: VerseRef) => `${ref.surah}:${ref.ayah}`;
