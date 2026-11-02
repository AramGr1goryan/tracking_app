import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import request from 'supertest';
import { createApp } from '../backend/src/app.js';
import { createServices } from '../backend/src/services.js';
import { openDatabase } from '../backend/src/database.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

function setup(initialTime = '2026-11-02T09:00:00.000Z') {
  const database = new Database(':memory:');
  database.pragma('foreign_keys = ON');
  database.exec(`
    CREATE TABLE employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      position TEXT,
      created_at TEXT NOT NULL DEFAULT '2026-11-02T00:00:00.000Z'
    );
    CREATE TABLE time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      task_description TEXT NOT NULL CHECK (length(trim(task_description)) > 0),
      started_at TEXT NOT NULL,
      stopped_at TEXT,
      duration_seconds INTEGER,
      created_at TEXT NOT NULL DEFAULT '2026-11-02T00:00:00.000Z',
      CHECK ((stopped_at IS NULL AND duration_seconds IS NULL) OR (stopped_at IS NOT NULL AND duration_seconds >= 0))
    );
    CREATE UNIQUE INDEX one_active_timer_per_employee ON time_entries(employee_id) WHERE stopped_at IS NULL;
  `);
  let now = new Date(initialTime);
  const services = createServices(database, () => new Date(now));
  const app = createApp(services);
  const employee = services.createEmployee('Тестовый сотрудник', null);
  return { app, database, services, employee, setNow: (value: string) => { now = new Date(value); } };
}

let current: ReturnType<typeof setup> | undefined;

beforeEach(() => { current = setup(); });
afterEach(() => { current?.database.close(); });

describe('employee API', () => {
  it('creates an employee and returns the employee list', async () => {
    const created = await request(current!.app).post('/api/employees').send({ fullName: '  Ирина Белова  ', position: 'Бухгалтер' });
    expect(created.status).toBe(201);
    expect(created.body.data.fullName).toBe('Ирина Белова');
    const listed = await request(current!.app).get('/api/employees');
    expect(listed.body.data).toHaveLength(2);
  });

  it('rejects empty names and duplicate employees', async () => {
    expect((await request(current!.app).post('/api/employees').send({ fullName: '  ' })).status).toBe(400);
    expect((await request(current!.app).post('/api/employees').send({ fullName: 'Тестовый сотрудник' })).status).toBe(409);
  });

  it('returns a meaningful error for an unknown employee', async () => {
    const response = await request(current!.app).post('/api/time-entries/start').send({ employeeId: 999, taskDescription: 'Задача' });
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('EMPLOYEE_NOT_FOUND');
  });

  it('rejects malformed JSON without exposing parser details', async () => {
    const response = await request(current!.app)
      .post('/api/employees')
      .set('Content-Type', 'application/json')
      .send('{"fullName":');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
    expect(JSON.stringify(response.body)).not.toContain('SyntaxError');
  });

  it('returns 404 when history is filtered by an unknown employee', async () => {
    const response = await request(current!.app).get('/api/time-entries?employeeId=999');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('EMPLOYEE_NOT_FOUND');
  });

  it('returns a consistent JSON error for unknown API routes', async () => {
    const response = await request(current!.app).get('/api/unknown-route');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('timer business rules', () => {
  it('starts and stops a timer with server-calculated duration', async () => {
    const started = await request(current!.app).post('/api/time-entries/start').send({ employeeId: current!.employee.id, taskDescription: 'Подготовить отчет' });
    expect(started.status).toBe(201);
    current!.setNow('2026-11-02T10:15:42.000Z');
    const stopped = await request(current!.app).post(`/api/time-entries/${started.body.data.id}/stop`);
    expect(stopped.body.data.durationSeconds).toBe(4542);
  });

  it('rejects empty tasks, duplicate active timers, and nonexistent timers', async () => {
    expect((await request(current!.app).post('/api/time-entries/start').send({ employeeId: current!.employee.id, taskDescription: '  ' })).status).toBe(400);
    await current!.services.startTimer(current!.employee.id, 'Первая задача');
    const duplicate = await request(current!.app).post('/api/time-entries/start').send({ employeeId: current!.employee.id, taskDescription: 'Вторая задача' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('TIMER_ALREADY_RUNNING');
    expect((await request(current!.app).post('/api/time-entries/999/stop')).status).toBe(404);
  });

  it('allows different employees to run timers simultaneously', () => {
    const other = current!.services.createEmployee('Второй сотрудник', null);
    current!.services.startTimer(current!.employee.id, 'Задача 1');
    expect(() => current!.services.startTimer(other.id, 'Задача 2')).not.toThrow();
  });

  it('retains active and completed entries after reopening the SQLite file', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'time-tracker-'));
    const databasePath = path.join(directory, 'test.sqlite');
    try {
      let database = openDatabase(databasePath);
      let services = createServices(database, () => new Date('2026-11-02T09:00:00.000Z'));
      const employee = services.listEmployees()[0]!;
      const active = services.startTimer(employee.id, 'Сохраняемый таймер');
      database.close();

      database = openDatabase(databasePath);
      services = createServices(database, () => new Date('2026-11-02T09:10:00.000Z'));
      expect(services.listActiveTimers()).toHaveLength(1);
      services.stopTimer(active.id);
      database.close();

      database = openDatabase(databasePath);
      services = createServices(database);
      expect(services.listActiveTimers()).toHaveLength(0);
      expect(services.listTimeEntries({ sort: 'newest' })).toHaveLength(1);
      database.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('report calculations', () => {
  it('clips crossing-midnight entries to inclusive selected dates and filters employee', () => {
    current!.setNow('2026-11-02T23:00:00.000Z');
    const first = current!.services.startTimer(current!.employee.id, 'Ночная задача');
    current!.setNow('2026-11-03T02:00:00.000Z');
    current!.services.stopTimer(first.id);
    const secondEmployee = current!.services.createEmployee('Другой сотрудник', null);
    current!.setNow('2026-11-03T08:00:00.000Z');
    const second = current!.services.startTimer(secondEmployee.id, 'Другая задача');
    current!.setNow('2026-11-03T09:00:00.000Z');
    current!.services.stopTimer(second.id);

    const report = current!.services.buildReport('2026-11-03', '2026-11-03');
    expect(report.totalTrackedSeconds).toBe(10800);
    expect(report.employeesWithTrackedTime).toBe(2);
    expect(current!.services.buildReport('2026-11-03', '2026-11-03', current!.employee.id).totalTrackedSeconds).toBe(7200);
  });

  it('includes active timer time only through now and returns a valid empty report', () => {
    current!.services.startTimer(current!.employee.id, 'Активная задача');
    current!.setNow('2026-11-02T09:30:00.000Z');
    expect(current!.services.buildReport('2026-11-02', '2026-11-02').totalTrackedSeconds).toBe(1800);
    const empty = current!.services.buildReport('2026-11-01', '2026-11-01');
    expect(empty.totalTrackedSeconds).toBe(0);
    expect(empty.employees).toEqual([]);
  });

  it('filters history by actual UTC-day overlap and excludes an entry ending at midnight', () => {
    current!.setNow('2026-11-02T23:00:00.000Z');
    const endingAtMidnight = current!.services.startTimer(current!.employee.id, 'Закончилась до полуночи');
    current!.setNow('2026-11-03T00:00:00.000Z');
    current!.services.stopTimer(endingAtMidnight.id);
    current!.setNow('2026-11-03T00:00:00.000Z');
    const nextTask = current!.services.startTimer(current!.employee.id, 'Началась после полуночи');
    current!.setNow('2026-11-03T00:30:00.000Z');
    current!.services.stopTimer(nextTask.id);

    const entries = current!.services.listTimeEntries({ date: '2026-11-03', sort: 'newest' });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.taskDescription).toBe('Началась после полуночи');
  });
});