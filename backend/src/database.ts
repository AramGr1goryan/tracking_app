import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

export function openDatabase(databasePath = process.env.DATABASE_PATH ?? path.resolve('backend/data/time-tracker.sqlite')) {
  mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new Database(databasePath);
  database.pragma('foreign_keys = ON');
  database.pragma('journal_mode = WAL');
  database.exec(`
  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    position TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS time_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    task_description TEXT NOT NULL CHECK (length(trim(task_description)) > 0),
    started_at TEXT NOT NULL,
    stopped_at TEXT,
    duration_seconds INTEGER,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CHECK (
      (stopped_at IS NULL AND duration_seconds IS NULL)
      OR (stopped_at IS NOT NULL AND duration_seconds IS NOT NULL AND duration_seconds >= 0)
    )
  );

  CREATE UNIQUE INDEX IF NOT EXISTS one_active_timer_per_employee
    ON time_entries(employee_id) WHERE stopped_at IS NULL;
  CREATE INDEX IF NOT EXISTS time_entries_started_at ON time_entries(started_at);
  CREATE INDEX IF NOT EXISTS time_entries_employee_started ON time_entries(employee_id, started_at);
  `);

  const employeeCount = database.prepare('SELECT COUNT(*) AS count FROM employees').get() as { count: number };
  if (employeeCount.count === 0) {
    const seed = database.prepare('INSERT INTO employees (full_name, position) VALUES (?, ?)');
    const seedEmployees = database.transaction(() => {
      seed.run('Анна Смирнова', 'Дизайнер продукта');
      seed.run('Михаил Волков', 'Инженер разработки');
      seed.run('Елена Кузнецова', 'Менеджер проектов');
      seed.run('Дмитрий Орлов', 'Аналитик');
    });
    seedEmployees();
  }
  return database;
}

export type AppDatabase = Database.Database;