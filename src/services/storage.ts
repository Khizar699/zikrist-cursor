import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { SCHEMA } from '../core/schema';
import type { Settings } from '../core/types';

export class Storage {
  db!: SQLiteDatabase;
  async init(): Promise<void> {
    this.db = await openDatabaseAsync('zikrist.sqlite');
    await this.db.execAsync('PRAGMA foreign_keys = OFF; DROP TABLE IF EXISTS occurrences; DROP TABLE IF EXISTS sessions; PRAGMA foreign_keys = ON;');
    await this.db.execAsync(SCHEMA);
  }
  async settings(): Promise<Settings> {
    const row = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', 'preferences');
    const data = row ? JSON.parse(row.value) as Partial<Settings> : {};
    return { language: data.language === 'en' || data.language === 'ur' ? data.language : null };
  }
  async saveSettings(settings: Settings): Promise<void> {
    await this.db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', 'preferences', JSON.stringify(settings));
  }
}
export const storage = new Storage();
