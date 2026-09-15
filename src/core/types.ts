export type Language = 'en' | 'ur';
export type FollowerPhase = 'acquiring' | 'following' | 'reacquiring';
export type VerseRef = { surah: number; ayah: number };
export type Translation = { translation: string; footnotes: string };
export type DisplayVerse = VerseRef & Translation & { arabic: string; name: string; nameArabic: string; basmala: string | null };
export type Settings = { language: Language | null };
export type Occurrence = VerseRef & {
  index: number; confirmedAtMs: number; audioOffsetMs: number; score: number;
  segment: number; matchedWords: number; totalWords: number;
};
export const refKey = (ref: VerseRef) => `${ref.surah}:${ref.ayah}`;
