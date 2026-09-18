import assert from 'node:assert/strict';
import { test } from 'node:test';
import { remainingAfter, handoffCandidateSurahs, rerankChampion, surahBonus, TIE_BREAK_MARGIN, salahPrior } from '../src/core/salah-prior';
import type { QuranChampionMatch } from '@tilawa/core';

function match(surah: number, ayah: number, score: number, rival?: { surah: number; ayah: number; score: number }): QuranChampionMatch {
  return {
    surah, ayah, text: '', phonemes_joined: '', score, raw_score: score, bonus: 0,
    runners_up: rival ? [{
      surah: rival.surah, ayah: rival.ayah, raw_score: rival.score, bonus: 0, score: rival.score, phonemes_joined: '',
    }] : undefined,
  };
}

test('remaining after Kawthar prefers later short surahs and always includes Al-Fatihah', () => {
  const next = remainingAfter(108);
  assert.equal(next[0], 1);
  assert.ok(next.indexOf(109) < next.indexOf(105));
  assert.ok(next.includes(112));
  assert.ok(next.includes(108));
  assert.ok(next.includes(36));
  assert.ok(!next.includes(2));
});

test('Al-Fatihah outranks last-10 for a cold-start tie', () => {
  assert.ok(surahBonus(1) > surahBonus(112));
  assert.ok(surahBonus(112, 108) > surahBonus(36, 108));
});

test('a prior tie-break cannot beat an acoustic gap at the configured margin', () => {
  const ranked = rerankChampion(match(114, 4, 0.7, { surah: 2, ayah: 109, score: 0.7 + TIE_BREAK_MARGIN }), null);
  assert.equal(ranked.surah, 2);
  assert.equal(ranked.ayah, 109);
  assert.equal(ranked.score, 0.7 + TIE_BREAK_MARGIN);
});

test('within the margin, remaining-after Kawthar prefers Ikhlas over Al-Baqarah', () => {
  const ranked = rerankChampion(match(2, 1, 0.7, { surah: 112, ayah: 1, score: 0.69 }), 108);
  assert.equal(ranked.surah, 112);
  assert.equal(ranked.score, 0.69);
});

test('the famous list is data, not a closed identity of the product', () => {
  assert.deepEqual(salahPrior.famous, [55, 36, 27, 18, 67, 12, 4]);
  assert.equal(salahPrior.tieBreakMax, TIE_BREAK_MARGIN);
});

test('handoff candidates include famous Naml and mushaf-next without making 2 the default', () => {
  const afterFatiha = handoffCandidateSurahs(1, 2);
  assert.ok(afterFatiha.includes(27));
  assert.ok(afterFatiha.includes(36));
  assert.ok(afterFatiha.includes(55));
  assert.ok(afterFatiha.includes(2));
  assert.ok(afterFatiha.includes(114));
  assert.ok(afterFatiha.indexOf(114) < afterFatiha.indexOf(2));
});
