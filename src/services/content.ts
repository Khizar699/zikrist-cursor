import { Directory, File, Paths } from 'expo-file-system';
import { CryptoDigestAlgorithm, digest } from 'expo-crypto';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import catalog from '../../assets/content/languages.json';
import canonical from '../../assets/content/quran-display.json';
import { packsToEvict } from '../core/pack-policy';
import { splitOpeningBasmala } from '../core/basmala';
import { neighborhoodSurahs } from '../core/sequential';
import { passageWindow } from '../core/passage';
import { refKey, type DisplayVerse, type Language, type Translation, type VerseRef } from '../core/types';
import { storage } from './storage';

const arabicText: Record<string, string> = canonical.verses;
type PackRow = { language: string; file_name: string; version: string; last_used_at: number };
type VerseMetadata = VerseRef & { surah_name: string; surah_name_en: string };
type TranslationRow = Translation & { sura: number; aya: number };

export class Content {
  private directory = new Directory(Paths.document, 'languages');
  private db: SQLiteDatabase | null = null;
  private metadata = new Map<string, VerseMetadata>();
  private cache = new Map<string, DisplayVerse>();
  private loadedSurahs = new Set<number>();
  private preload: { key: string; promise: Promise<void> } | null = null;
  private preloadGeneration = 0;
  language: Language | null = null;

  setMetadata(verses: VerseMetadata[]): void { this.metadata = new Map(verses.map((verse) => [refKey(verse), verse])); }
  installed(): Promise<PackRow[]> { return storage.db.getAllAsync<PackRow>('SELECT * FROM language_packs ORDER BY last_used_at DESC'); }

  async activate(language: Language, progress: (message: string) => void = () => undefined): Promise<void> {
    const edition = catalog.find((item) => item.language === language)!;
    this.directory.create({ idempotent: true, intermediates: true });
    const filename = `${edition.key}-${edition.version}.sqlite`;
    const target = new File(this.directory, filename);
    let verified = false;
    if (target.exists) {
      progress('Checking your offline translation');
      try { await this.verifyFile(target, edition.sha256); await this.validateDatabase(filename); verified = true; }
      catch { /* Restore a corrupt installed file through a verified staging copy. */ }
    }
    if (!verified) {
      progress(`Downloading ${language === 'en' ? 'English' : 'Urdu'} · ${(edition.bytes / 1_000_000).toFixed(1)} MB`);
      const stage = new File(this.directory, `${filename}.partial`);
      try {
        await File.downloadFileAsync(edition.url, stage, { idempotent: true, headers: { 'User-Agent': 'Zikrist/0.1 (evaluation)' } });
        await this.verifyFile(stage, edition.sha256);
        await this.validateDatabase(stage.name);
        await stage.move(target, { overwrite: true });
      } finally { if (stage.exists && stage.uri !== target.uri) stage.delete(); }
    }
    const next = await openDatabaseAsync(filename, { useNewConnection: true }, this.directory.uri);
    await next.execAsync('PRAGMA query_only = ON');
    const old = this.db;
    try {
      await storage.db.runAsync('INSERT OR REPLACE INTO language_packs VALUES (?, ?, ?, ?)', language, filename, edition.version, Date.now());
    } catch (error) { await next.closeAsync(); throw error; }
    this.db = next;
    this.language = language;
    this.cache.clear();
    this.loadedSurahs.clear();
    this.preload = null;
    this.preloadGeneration += 1;
    await old?.closeAsync();
    const installed = await this.installed();
    for (const languageToRemove of packsToEvict(installed.map((item) => ({ language: item.language, lastUsedAt: item.last_used_at })), language)) {
      const row = installed.find((item) => item.language === languageToRemove)!;
      const file = new File(this.directory, row.file_name);
      if (file.exists) file.delete();
      await storage.db.runAsync('DELETE FROM language_packs WHERE language = ?', row.language);
    }
    const keptFiles = new Set((await this.installed()).map((pack) => pack.file_name));
    for (const file of this.directory.list()) {
      if (file instanceof File && !keptFiles.has(file.name)) file.delete();
    }
  }

  private async verifyFile(file: File, expected: string): Promise<void> {
    const hash = await digest(CryptoDigestAlgorithm.SHA256, await file.bytes());
    const actual = [...new Uint8Array(hash)].map((value) => value.toString(16).padStart(2, '0')).join('');
    if (actual !== expected) throw new Error('Translation verification failed. The provider may have updated this edition. Your previous pack is preserved; update the pack manifest before retrying.');
  }
  private async validateDatabase(filename: string): Promise<void> {
    const db = await openDatabaseAsync(filename, { useNewConnection: true }, this.directory.uri);
    try {
      await db.execAsync('PRAGMA query_only = ON');
      const rows = await db.getAllAsync<{ sura: number; aya: number; translation: string; footnotes: string }>('SELECT sura, aya, translation, footnotes FROM translations');
      const keys = new Set<string>();
      for (const row of rows) {
        const key = `${row.sura}:${row.aya}`;
        if (!arabicText[key] || keys.has(key) || !row.translation?.trim() || typeof row.footnotes !== 'string') throw new Error('Translation verse mapping is invalid.');
        keys.add(key);
      }
      if (keys.size !== 6236) throw new Error('Translation pack is incomplete.');
    } finally { await db.closeAsync(); }
  }
  hasVerse(ref: VerseRef): boolean { return Boolean(arabicText[refKey(ref)]); }
  peek(ref: VerseRef): DisplayVerse | undefined { return this.cache.get(refKey(ref)); }
  cachedNeighborhood(focus: DisplayVerse): DisplayVerse[] {
    return passageWindow(focus, (ref) => this.peek(ref), (ref) => this.hasVerse(ref));
  }
  async verse(ref: VerseRef): Promise<DisplayVerse> {
    const cached = this.peek(ref);
    if (cached) return cached;
    if (!this.db) throw new Error('Choose a translation language first.');
    const row = await this.db.getFirstAsync<Translation>('SELECT translation, footnotes FROM translations WHERE sura = ? AND aya = ?', ref.surah, ref.ayah);
    const verse = this.buildVerse(ref, row);
    this.cache.set(refKey(ref), verse);
    return verse;
  }
  /** Load this surah and the following surah. The passage lists read this
   * cache; sequential scrolling must not query SQLite again. */
  async preloadNeighborhood(ref: VerseRef): Promise<void> {
    const surahs = neighborhoodSurahs(ref.surah);
    if (surahs.length === 0) return;
    const key = surahs.join(',');
    if (surahs.every((surah) => this.loadedSurahs.has(surah))) return;
    if (this.preload?.key === key) return this.preload.promise;
    const generation = ++this.preloadGeneration;
    const promise = this.loadSurahs(surahs, generation).finally(() => {
      if (this.preload?.key === key) this.preload = null;
    });
    this.preload = { key, promise };
    return promise;
  }

  private async loadSurahs(surahs: number[], generation: number): Promise<void> {
    if (!this.db) throw new Error('Choose a translation language first.');
    const placeholders = surahs.map(() => '?').join(', ');
    const rows = await this.db.getAllAsync<TranslationRow>(
      `SELECT sura, aya, translation, footnotes FROM translations WHERE sura IN (${placeholders})`,
      ...surahs,
    );
    if (generation !== this.preloadGeneration) return;
    const nextCache = new Map<string, DisplayVerse>();
    for (const row of rows) {
      const ref = { surah: row.sura, ayah: row.aya };
      nextCache.set(refKey(ref), this.buildVerse(ref, row));
    }
    this.cache = nextCache;
    this.loadedSurahs = new Set(surahs);
  }

  private buildVerse(ref: VerseRef, row: Translation | TranslationRow | null): DisplayVerse {
    const key = refKey(ref);
    const meta = this.metadata.get(key);
    if (!row || !arabicText[key] || !meta) throw new Error(`Verse ${key} is unavailable in the installed pack.`);
    const { header, ayah } = splitOpeningBasmala(arabicText[key], ref);
    return { ...ref, translation: row.translation, footnotes: row.footnotes, arabic: ayah, basmala: header, name: meta.surah_name_en, nameArabic: meta.surah_name };
  }
}
export const content = new Content();
