// SQLite via Node's built-in driver (node:sqlite), so there's nothing native to compile on deploy.
// Everything persistent (database + uploaded photos) lives under DATA_DIR; mount a volume there in production.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'phanie.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  -- Admin accounts. An invited account has no password until its owner opens the invite link.
  CREATE TABLE IF NOT EXISTS users (
    id                INTEGER PRIMARY KEY,
    email             TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name              TEXT NOT NULL DEFAULT '',
    password_hash     TEXT NOT NULL DEFAULT '',
    invite_token_hash TEXT,
    invite_expires_at INTEGER,
    created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- Only a SHA-256 of each session token is stored, so a leaked database can't be used to log in.
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  -- "Forgot password" links: one live link per account, 60 minutes, single use.
  CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );

  -- Site texts/photos that differ from the defaults in content-schema.js. No row = default.
  CREATE TABLE IF NOT EXISTS content (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT
  );
`);

// node:sqlite has no transaction helper; this keeps multi-statement writes all-or-nothing.
export function tx(fn) {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
