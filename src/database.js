import { join } from "node:path";
import Database from "better-sqlite3";
import { settings } from "./config.js";

export const db = new Database(join(settings.dataDirectory, "tasks.db"));

db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course TEXT NOT NULL,
    title TEXT NOT NULL,
    due_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    completed_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_pending
  ON tasks (completed_at, due_at);

  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    weekday INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '-',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_schedules_weekday
  ON schedules (weekday, start_time);

  CREATE TABLE IF NOT EXISTS sent_notifications (
    notification_key TEXT PRIMARY KEY,
    sent_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS processed_messages (
    message_id TEXT PRIMARY KEY,
    processed_at INTEGER NOT NULL
  );
`);
