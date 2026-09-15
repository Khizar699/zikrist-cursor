import type { VerseRef } from './types';

/** Tanzil Uthmani opening Basmala, prepended to ayah 1 of every surah except
 * Al-Fatihah (where it *is* 1:1) and At-Tawbah. Not the in-verse phrase at 27:30. */
export const OPENING_BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
export const OPENING_BASMALA_WORDS = 4;

export function isFatihaBasmala(ref: VerseRef): boolean {
  return ref.surah === 1 && ref.ayah === 1;
}

/** 1:3 is only the shared Basmala tail. It is not enough to first-lock Al-Fatihah. */
export function isFatihaBasmalaTail(ref: VerseRef): boolean {
  return ref.surah === 1 && ref.ayah === 3;
}

export function openingBasmalaWordCount(ref: VerseRef): number {
  if (ref.surah === 9 || ref.ayah !== 1) return 0;
  return OPENING_BASMALA_WORDS;
}

export function splitOpeningBasmala(arabic: string, ref: VerseRef): { header: string | null; ayah: string } {
  if (ref.ayah !== 1 || ref.surah === 1 || ref.surah === 9) return { header: null, ayah: arabic };
  const text = arabic.replace(/^\uFEFF/, '');
  if (!text.startsWith(OPENING_BASMALA)) return { header: null, ayah: arabic };
  const rest = text.slice(OPENING_BASMALA.length).replace(/^[\s\u00A0]+/, '');
  if (!rest) return { header: null, ayah: arabic };
  return { header: OPENING_BASMALA, ayah: rest };
}
