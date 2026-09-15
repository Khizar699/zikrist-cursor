/** On-screen liturgy from pack rows. Does not retune the matcher. */

import type { DisplayVerse } from './types';
import {
  SALAH_LITURGY_ENGLISH_KIND,
  type SalahLiturgyCategory,
  type SalahLiturgyPack,
} from './salah-liturgy';

/** Light label so a locked phrase is not presented as a Quran ayah. */
export const LITURGY_DISPLAY_LABEL = 'Prayer / liturgy';

export type LiturgyDisplay = {
  kind: 'salah_liturgy';
  phraseId: string;
  category: SalahLiturgyCategory;
  arabic: string;
  english: string;
  englishKind: typeof SALAH_LITURGY_ENGLISH_KIND;
  label: typeof LITURGY_DISPLAY_LABEL;
  categoryLabel: string;
};

export type ListeningDisplayState = {
  liturgy: LiturgyDisplay | null;
  current: DisplayVerse | null;
  passage: DisplayVerse[];
  draftWords: string[];
};

export type ListeningSurface =
  | { mode: 'empty' }
  | { mode: 'heard_words'; words: string[] }
  | { mode: 'liturgy'; liturgy: LiturgyDisplay }
  | { mode: 'passage'; current: DisplayVerse; passage: DisplayVerse[] };

export type ListeningDisplayEvent =
  | { type: 'salah_liturgy'; pack: SalahLiturgyPack; phraseId: string }
  | { type: 'verse_match'; verse: DisplayVerse; passage?: DisplayVerse[] }
  | { type: 'heard_words'; words: string[] }
  | { type: 'neighborhood_refresh'; passage: DisplayVerse[] };

const CATEGORY_LABELS: Record<SalahLiturgyCategory, string> = {
  takbeer: 'Takbeer',
  thana: 'Opening thana',
  istiadha: 'Istiʿadha',
  ruku_tasbih: 'Ruku',
  sujood_tasbih: 'Sujood',
  jami_bayn: 'After ruku',
  tashahhud: 'Tashahhud',
  darood_ibrahim: 'Salawat',
  amin: 'Amin',
  tasleem: 'Tasleem',
};

export function liturgyDisplayForLock(
  pack: SalahLiturgyPack,
  lock: { phraseId: string },
): LiturgyDisplay | null {
  const phrase = pack.phrases.find((row) => row.id === lock.phraseId);
  if (!phrase) return null;
  if (!phrase.arabic_uthmani.trim() || !phrase.english.trim()) return null;
  return {
    kind: 'salah_liturgy',
    phraseId: phrase.id,
    category: phrase.category,
    arabic: phrase.arabic_uthmani,
    english: phrase.english,
    englishKind: pack.english_kind,
    label: LITURGY_DISPLAY_LABEL,
    categoryLabel: CATEGORY_LABELS[phrase.category],
  };
}

/** Same precedence as the live listening screen. Liturgy is never an ayah pane. */
export function listeningSurface(state: ListeningDisplayState): ListeningSurface {
  if (state.liturgy) return { mode: 'liturgy', liturgy: state.liturgy };
  if (state.current) {
    return {
      mode: 'passage',
      current: state.current,
      passage: state.passage.length ? state.passage : [state.current],
    };
  }
  if (state.draftWords.length) return { mode: 'heard_words', words: state.draftWords };
  return { mode: 'empty' };
}

export const emptyListeningDisplay = (): ListeningDisplayState => ({
  liturgy: null, current: null, passage: [], draftWords: [],
});

/** Display-only reducer. Neighborhood refresh must not clear a liturgy lock. */
export function reduceListeningDisplay(
  state: ListeningDisplayState,
  event: ListeningDisplayEvent,
): ListeningDisplayState {
  if (event.type === 'salah_liturgy') {
    const liturgy = liturgyDisplayForLock(event.pack, { phraseId: event.phraseId });
    if (!liturgy) return state;
    return { ...state, liturgy, draftWords: [] };
  }
  if (event.type === 'verse_match') {
    const passage = event.passage ?? [event.verse];
    return { liturgy: null, current: event.verse, passage, draftWords: [] };
  }
  if (event.type === 'heard_words') {
    if (state.liturgy || state.current) return state;
    return { ...state, draftWords: event.words };
  }
  return { ...state, passage: event.passage };
}
