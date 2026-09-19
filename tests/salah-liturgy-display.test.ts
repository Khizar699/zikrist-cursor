import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  LITURGY_DISPLAY_LABEL,
  emptyListeningDisplay,
  listeningSurface,
  liturgyDisplayForLock,
  reduceListeningDisplay,
} from '../src/core/salah-liturgy-display';
import { SALAH_LITURGY_ENGLISH_KIND, assertSalahLiturgyPack, type SalahLiturgyPack } from '../src/core/salah-liturgy';
import type { DisplayVerse } from '../src/core/types';

const packData: unknown = JSON.parse(readFileSync('assets/content/salah-liturgy.json', 'utf8'));
assertSalahLiturgyPack(packData);
const pack: SalahLiturgyPack = packData;

function phrase(id: string) {
  const row = pack.phrases.find((item) => item.id === id);
  assert.ok(row, id);
  return row;
}

function ayah(surah: number, ayahNumber: number): DisplayVerse {
  return {
    surah,
    ayah: ayahNumber,
    translation: `In the Name of Allah, the Entirely Merciful, the Especially Merciful.`,
    footnotes: '',
    arabic: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
    name: 'Al-Fatihah',
    nameArabic: 'الفاتحة',
    basmala: null,
  };
}

test('takbeer, thana, and ruku show pack Arabic plus liturgy-gloss English', () => {
  for (const id of ['takbeer', 'thana', 'ruku_tasbih'] as const) {
    const row = phrase(id);
    const display = liturgyDisplayForLock(pack, { phraseId: id });
    assert.ok(display, id);
    assert.equal(display.kind, 'salah_liturgy');
    assert.equal(display.phraseId, id);
    assert.equal(display.arabic, row.arabic_uthmani);
    assert.equal(display.english, row.english);
    assert.equal(display.englishKind, SALAH_LITURGY_ENGLISH_KIND);
    assert.equal(display.englishKind, 'liturgy_gloss');
    assert.equal(display.label, LITURGY_DISPLAY_LABEL);
    assert.match(display.label, /prayer/i);
    assert.match(display.label, /liturgy/i);
    assert.doesNotMatch(display.label, /ayah|surah|verse|quran translation/i);
    assert.doesNotMatch(display.english, /madhhab|imam-ready|every school/i);
    assert.equal('confidence' in display, false);
  }
  assert.equal(liturgyDisplayForLock(pack, { phraseId: 'takbeer' })?.categoryLabel, 'Takbeer');
  assert.equal(liturgyDisplayForLock(pack, { phraseId: 'thana' })?.categoryLabel, 'Opening thana');
  assert.equal(liturgyDisplayForLock(pack, { phraseId: 'ruku_tasbih' })?.categoryLabel, 'Ruku');
});

test('an unknown phrase id does not invent English or a liturgy pane', () => {
  assert.equal(liturgyDisplayForLock(pack, { phraseId: 'dua_qunoot' }), null);
  const state = reduceListeningDisplay(emptyListeningDisplay(), {
    type: 'salah_liturgy', pack, phraseId: 'not_a_phrase',
  });
  assert.equal(listeningSurface(state).mode, 'empty');
});

test('heard Arabic words display before a lock, then a Fatiha lock keeps upcoming ayahs', () => {
  let state = reduceListeningDisplay(emptyListeningDisplay(), {
    type: 'heard_words', words: ['الحمد', 'لله'],
  });
  assert.deepEqual(listeningSurface(state), { mode: 'heard_words', words: ['الحمد', 'لله'] });

  const passage = [ayah(1, 1), ayah(1, 2), ayah(1, 3), ayah(1, 4), ayah(1, 5), ayah(1, 6), ayah(1, 7)];
  state = reduceListeningDisplay(state, { type: 'verse_match', verse: ayah(1, 2), passage });
  const surface = listeningSurface(state);
  assert.equal(surface.mode, 'passage');
  if (surface.mode !== 'passage') throw new Error('expected passage');
  assert.equal(surface.current.ayah, 2);
  assert.deepEqual(surface.passage.map((item) => item.ayah), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(state.draftWords, []);
});

test('a liturgy lock takes over a held ayah, then a verse_match restores passage UI', () => {
  const fatiha = ayah(1, 2);
  const nextAyah = ayah(1, 3);
  let state = reduceListeningDisplay(emptyListeningDisplay(), {
    type: 'verse_match', verse: fatiha, passage: [fatiha, nextAyah],
  });
  assert.equal(listeningSurface(state).mode, 'passage');

  state = reduceListeningDisplay(state, { type: 'salah_liturgy', pack, phraseId: 'takbeer' });
  const liturgy = listeningSurface(state);
  assert.equal(liturgy.mode, 'liturgy');
  if (liturgy.mode !== 'liturgy') throw new Error('expected liturgy');
  assert.equal(liturgy.liturgy.arabic, phrase('takbeer').arabic_uthmani);
  assert.equal(liturgy.liturgy.english, phrase('takbeer').english);
  assert.equal(state.current?.surah, 1);
  assert.equal(state.current?.ayah, 2);

  state = reduceListeningDisplay(state, { type: 'heard_words', words: ['الحمد'] });
  assert.equal(listeningSurface(state).mode, 'liturgy');
  assert.deepEqual(state.draftWords, []);

  state = reduceListeningDisplay(state, { type: 'neighborhood_refresh', passage: [fatiha, nextAyah] });
  assert.equal(listeningSurface(state).mode, 'liturgy');

  state = reduceListeningDisplay(state, {
    type: 'verse_match', verse: nextAyah, passage: [fatiha, nextAyah],
  });
  const passage = listeningSurface(state);
  assert.equal(passage.mode, 'passage');
  if (passage.mode !== 'passage') throw new Error('expected passage');
  assert.equal(passage.current.surah, 1);
  assert.equal(passage.current.ayah, 3);
  assert.equal(passage.passage.length, 2);
  assert.equal(state.liturgy, null);
});

test('the same ayah confirmed after liturgy still restores the Quran passage surface', () => {
  const fatiha = ayah(1, 2);
  let state = reduceListeningDisplay(emptyListeningDisplay(), { type: 'verse_match', verse: fatiha });
  state = reduceListeningDisplay(state, { type: 'salah_liturgy', pack, phraseId: 'thana' });
  assert.equal(listeningSurface(state).mode, 'liturgy');
  state = reduceListeningDisplay(state, { type: 'verse_match', verse: fatiha, passage: [fatiha] });
  const surface = listeningSurface(state);
  assert.equal(surface.mode, 'passage');
  if (surface.mode !== 'passage') throw new Error('expected passage');
  assert.equal(surface.current.ayah, 2);
  assert.equal(state.liturgy, null);
});
