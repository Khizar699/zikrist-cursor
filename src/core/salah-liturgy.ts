/** Offline salah liturgy pack schema. Data only — not a matcher. */

export const SALAH_LITURGY_KIND = 'salah_liturgy';
export const SALAH_LITURGY_ENGLISH_KIND = 'liturgy_gloss';
export const SALAH_LITURGY_PACK_VERSION = 1;

export const SALAH_LITURGY_CATEGORIES = [
  'takbeer',
  'thana',
  'istiadha',
  'ruku_tasbih',
  'sujood_tasbih',
  'jami_bayn',
  'tashahhud',
  'darood_ibrahim',
  'amin',
  'tasleem',
] as const;

export type SalahLiturgyCategory = (typeof SALAH_LITURGY_CATEGORIES)[number];

/** Phrase ids the v1 pack must ship. Matcher/UI are later sessions. */
export const REQUIRED_SALAH_LITURGY_IDS = [
  'takbeer',
  'thana',
  'istiadha',
  'ruku_tasbih',
  'sujood_tasbih',
  'sami_allahu_liman_hamidah',
  'rabbana_wa_lakal_hamd',
  'tashahhud',
  'darood_ibrahim',
  'amin',
  'assalamu_alaikum_warahmatullah',
] as const;

export const DEFERRED_SALAH_LITURGY_IDS = [
  'basmala_liturgy',
  'dua_qunoot',
  'sitting_between_sujood',
  'istiftah_wajjahtu',
  'darood_ibrahim_fil_alamin',
  'istiadha_samee_aleem',
] as const;

/** Stable UTF-8 payload hashed into `sha256`. Keep in sync with scripts/verify-salah-liturgy.mjs. */
export const SALAH_LITURGY_HASH_FIELDS = [
  'id',
  'category',
  'arabic_uthmani',
  'arabic_recognition_normalized',
  'english',
  'source_note',
  'license_status',
] as const;

export type SalahLiturgyHashField = (typeof SALAH_LITURGY_HASH_FIELDS)[number];

export type SalahLiturgyPhrase = {
  id: string;
  category: SalahLiturgyCategory;
  arabic_uthmani: string;
  arabic_recognition_normalized: string;
  english: string;
  source_note: string;
  license_status: string;
  sha256: string;
};

export type SalahLiturgyDeferred = {
  id: string;
  reason: string;
};

export type SalahLiturgyPack = {
  pack_id: string;
  version: number;
  kind: typeof SALAH_LITURGY_KIND;
  english_kind: typeof SALAH_LITURGY_ENGLISH_KIND;
  english_label: string;
  license_status: string;
  edition: {
    id: string;
    label: string;
    madhhab_basis: string;
    tashahhud: string;
    thana: string;
    darood: string;
    corpus_assumption: string;
  };
  deferred: SalahLiturgyDeferred[];
  phrases: SalahLiturgyPhrase[];
};

const HASH_FIELD_SET = new Set<string>(SALAH_LITURGY_HASH_FIELDS);
const CATEGORY_SET = new Set<string>(SALAH_LITURGY_CATEGORIES);

/** Harakat, dagger alef, Quranic annotation, and tatweel. Not hamza letters. */
const ARABIC_MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF\u0640]/g;

/** Display Arabic → recognition key. Explicit alefs (not Tanzil dagger-alef). */
export function normalizeLiturgyArabic(uthmani: string): string {
  return uthmani
    .normalize('NFC')
    .replace(ARABIC_MARKS, '')
    .replace(/ٱ/g, 'ا')
    .replace(/[\s\u00A0\u2000-\u200B]+/g, ' ')
    .trim();
}

export function phraseHashPayload(phrase: Pick<SalahLiturgyPhrase, SalahLiturgyHashField>): string {
  return SALAH_LITURGY_HASH_FIELDS.map((field) => phrase[field]).join('\n');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, label: string, errors: string[]): string {
  if (typeof value !== 'string' || !value.trim()) {
    errors.push(`${label} must be a non-empty string`);
    return '';
  }
  return value;
}

/** Structural checks only. Callers recompute SHA-256 with their platform hasher. */
export function collectSalahLiturgyErrors(data: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(data)) return ['pack must be an object'];
  if (data.pack_id !== 'salah-liturgy') errors.push('pack_id must be salah-liturgy');
  if (data.version !== SALAH_LITURGY_PACK_VERSION) errors.push(`version must be ${SALAH_LITURGY_PACK_VERSION}`);
  if (data.kind !== SALAH_LITURGY_KIND) errors.push(`kind must be ${SALAH_LITURGY_KIND}`);
  if (data.english_kind !== SALAH_LITURGY_ENGLISH_KIND) {
    errors.push(`english_kind must be ${SALAH_LITURGY_ENGLISH_KIND} (liturgy/prayer gloss, not Quran translation)`);
  }
  asString(data.english_label, 'english_label', errors);
  asString(data.license_status, 'license_status', errors);
  if (!isRecord(data.edition)) errors.push('edition must be an object');
  else {
    for (const key of ['id', 'label', 'madhhab_basis', 'tashahhud', 'thana', 'darood', 'corpus_assumption'] as const) {
      asString(data.edition[key], `edition.${key}`, errors);
    }
  }
  if (!Array.isArray(data.deferred)) errors.push('deferred must be an array');
  else {
    const deferredIds = new Set<string>();
    for (const [index, row] of data.deferred.entries()) {
      if (!isRecord(row)) {
        errors.push(`deferred[${index}] must be an object`);
        continue;
      }
      const id = asString(row.id, `deferred[${index}].id`, errors);
      asString(row.reason, `deferred[${index}].reason`, errors);
      if (id) deferredIds.add(id);
    }
    for (const id of DEFERRED_SALAH_LITURGY_IDS) {
      if (!deferredIds.has(id)) errors.push(`deferred must include ${id}`);
    }
  }
  if (!Array.isArray(data.phrases) || data.phrases.length === 0) {
    errors.push('phrases must be a non-empty array');
    return errors;
  }
  const ids = new Set<string>();
  for (const [index, row] of data.phrases.entries()) {
    if (!isRecord(row)) {
      errors.push(`phrases[${index}] must be an object`);
      continue;
    }
    const extra = Object.keys(row).filter((key) => (
      !HASH_FIELD_SET.has(key) && key !== 'sha256'
    ));
    if (extra.length) errors.push(`phrases[${index}] unknown fields: ${extra.join(', ')}`);
    const id = asString(row.id, `phrases[${index}].id`, errors);
    if (id) {
      if (!/^[a-z][a-z0-9_]*$/.test(id)) errors.push(`phrases[${index}].id is not snake_case: ${id}`);
      if (ids.has(id)) errors.push(`duplicate phrase id ${id}`);
      ids.add(id);
    }
    const category = asString(row.category, `phrases[${index}].category`, errors);
    if (category && !CATEGORY_SET.has(category)) errors.push(`phrases[${index}].category is not a v1 category: ${category}`);
    const uthmani = asString(row.arabic_uthmani, `phrases[${index}].arabic_uthmani`, errors);
    const normalized = asString(row.arabic_recognition_normalized, `phrases[${index}].arabic_recognition_normalized`, errors);
    if (uthmani && normalized && normalized !== normalizeLiturgyArabic(uthmani)) {
      errors.push(`phrases[${index}] arabic_recognition_normalized does not match normalizeLiturgyArabic`);
    }
    if (normalized && ARABIC_MARKS.test(normalized)) {
      errors.push(`phrases[${index}] recognition text still contains Arabic marks`);
    }
    const english = asString(row.english, `phrases[${index}].english`, errors);
    if (english && /quran translation/i.test(english)) {
      errors.push(`phrases[${index}].english must not claim to be a Quran translation`);
    }
    asString(row.source_note, `phrases[${index}].source_note`, errors);
    asString(row.license_status, `phrases[${index}].license_status`, errors);
    const sha = asString(row.sha256, `phrases[${index}].sha256`, errors);
    if (sha && !/^[a-f0-9]{64}$/.test(sha)) errors.push(`phrases[${index}].sha256 must be lowercase hex SHA-256`);
  }
  for (const id of REQUIRED_SALAH_LITURGY_IDS) {
    if (!ids.has(id)) errors.push(`missing required phrase id ${id}`);
  }
  return errors;
}

export function assertSalahLiturgyPack(data: unknown): asserts data is SalahLiturgyPack {
  const errors = collectSalahLiturgyErrors(data);
  if (errors.length) throw new Error(`salah liturgy pack invalid:\n${errors.join('\n')}`);
}
