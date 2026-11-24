import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

const DB_PATH = path.join(process.cwd(), "data", "notes.sqlite");

// App-owned schema (SPEC §5.3–5.4). Better Auth's tables are created by its own
// migrator in lib/auth.ts. SQLite allows the FK to "user" before that table exists;
// it is enforced on writes, which only happen after auth migrations have run.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS notes (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  title       TEXT NOT NULL DEFAULT 'Untitled',
  content     TEXT NOT NULL,
  is_public   INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1)),
  share_token TEXT UNIQUE,
  revision    INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE,
  CHECK (
    (is_public = 0 AND share_token IS NULL)
    OR (is_public = 1 AND share_token IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_updated ON notes(user_id, updated_at DESC);
`;

function open(): Database {
  mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const conn = new Database(DB_PATH, { create: true, strict: true });
  conn.run("PRAGMA journal_mode = WAL;");
  conn.run("PRAGMA foreign_keys = ON;");
  conn.run("PRAGMA busy_timeout = 5000;");
  conn.run(SCHEMA);
  return conn;
}

// One shared connection, reused across dev hot reloads.
const globalForDb = globalThis as unknown as { __notesDb?: Database };
export const db: Database = globalForDb.__notesDb ?? open();
globalForDb.__notesDb = db;
