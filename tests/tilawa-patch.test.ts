import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { QuranDB, TextCTCDecoder, adaptQuranTextData, type QuranVerse } from '@tilawa/core';

// Regression contract for the pinned upstream memory + inverted-index patch.
// Packed n-grams must agree with the Set path on the champion shortlist head;
// inverted postings may reorder tied tails versus a full corpus scan.
test('packed search has the same shortlist as the original Set path on real Quran text', () => {
  const read = (name: string) => JSON.parse(fs.readFileSync(`assets/model/${name}.json`, 'utf8'));
  const verses = adaptQuranTextData(read('quran'), read('quran_ctc_tokens'), new TextCTCDecoder(read('vocab'), 1024));
  type Internals = { _ngramCharIdsBuilt: boolean; _ngramCharIds: Int32Array | null; _jointCandidateVerses(query: string): QuranVerse[] };
  const packed = new QuranDB(verses) as unknown as Internals;
  const reference = new QuranDB(verses) as unknown as Internals;
  reference._ngramCharIdsBuilt = true; reference._ngramCharIds = null;
  const queries = [verses[0]!, verses[200]!, verses[1111]!, verses[5000]!, verses[6221]!].flatMap((verse) => {
    const text = verse.phonemes_joined.replace(/\s/g, '');
    return [text, text.slice(4), `${text.slice(0, 9)}?${text.slice(10)}`];
  });
  let narrowed = false;
  for (const query of queries) {
    const candidates = packed._jointCandidateVerses(query);
    const baseline = reference._jointCandidateVerses(query);
    if (candidates.length === 0 && baseline.length === 0) continue;
    if (candidates.length < verses.length) narrowed = true;
    assert.ok(candidates.length > 0, 'packed shortlist must not be empty when Set path finds hits');
    assert.ok(candidates.length <= 320);
    assert.equal(
      `${candidates[0]!.surah}:${candidates[0]!.ayah}`,
      `${baseline[0]!.surah}:${baseline[0]!.ayah}`,
      'packed and Set paths must agree on the top shortlist hit',
    );
    const head = 48;
    const packedHead = new Set(candidates.slice(0, head).map((verse) => `${verse.surah}:${verse.ayah}`));
    const baselineHead = new Set(baseline.slice(0, head).map((verse) => `${verse.surah}:${verse.ayah}`));
    let overlap = 0;
    for (const ref of packedHead) if (baselineHead.has(ref)) overlap += 1;
    assert.ok(
      overlap >= Math.floor(Math.min(head, candidates.length, baseline.length) * 0.75),
      `shortlist head overlap too low: ${overlap}/${head}`,
    );
  }
  assert.ok(narrowed, 'The comparison must exercise an actual shortlist');
});

test('short or thin queries do not score the entire Quran', () => {
  const read = (name: string) => JSON.parse(fs.readFileSync(`assets/model/${name}.json`, 'utf8'));
  const verses = adaptQuranTextData(read('quran'), read('quran_ctc_tokens'), new TextCTCDecoder(read('vocab'), 1024));
  type Internals = { _jointCandidateVerses(query: string): QuranVerse[] };
  const packed = new QuranDB(verses) as unknown as Internals;
  const reference = new QuranDB(verses) as unknown as Internals;
  assert.equal(packed._jointCandidateVerses('abc').length, 0);
  assert.ok(packed._jointCandidateVerses('abc').length < verses.length);
  const unique = verses[5000]!.phonemes_joined.replace(/\s/g, '');
  const shortlist = packed._jointCandidateVerses(unique);
  assert.ok(shortlist.length > 0);
  assert.ok(shortlist.length <= 320);
  assert.ok(shortlist.length < verses.length);
  assert.deepEqual(
    shortlist.map((verse) => `${verse.surah}:${verse.ayah}`),
    (reference as unknown as Internals)._jointCandidateVerses(unique).map((verse) => `${verse.surah}:${verse.ayah}`),
  );
});
