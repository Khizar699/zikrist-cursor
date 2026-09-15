export const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS language_packs (
 language TEXT PRIMARY KEY, file_name TEXT NOT NULL,
 version TEXT NOT NULL, last_used_at INTEGER NOT NULL
);
PRAGMA user_version = 2;
`;
