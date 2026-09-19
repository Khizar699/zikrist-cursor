import { splitOpeningBasmala } from './basmala';
import type { DisplayVerse, VerseRef } from './types';

/** Canonical Arabic row for the listening stage. Translation stays empty
 * until a later MVP paints an approved pack. */
export function mushafDisplayVerse(
  ref: VerseRef,
  arabicFull: string | undefined,
  meta: { surah_name: string; surah_name_en: string } | undefined,
): DisplayVerse | undefined {
  if (!arabicFull || !meta) return undefined;
  const { header, ayah } = splitOpeningBasmala(arabicFull, ref);
  return {
    ...ref,
    translation: '',
    footnotes: '',
    arabic: ayah,
    basmala: header,
    name: meta.surah_name_en,
    nameArabic: meta.surah_name,
  };
}
