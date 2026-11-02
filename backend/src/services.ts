import type { AppDatabase } from './database.js';
import { AppError } from './errors.js';
import type { Employee, EmployeeReport, ReportEntry, ReportSummary, TimeEntry } from './types.js';

type Clock = () => Date;

interface EmployeeRow {
  id: number;
  full_name: string;
  position: string | null;
  created_at: string;
  active_timer: number;
}

interface TimeEntryRow {
  id: number;
  employee_id: number;
  employee_name: string;
  task_description: string;
  started_at: string;
  stopped_at: string | null;
  duration_seconds: number | null;
  created_at: string;
}

const mapEmployee = (row: EmployeeRow): Employee => ({
  id: row.id,
  fullName: row.full_name,
  position: row.position,
  createdAt: row.created_at,
  activeTimer: row.active_timer === 1,
});

const mapEntry = (row: TimeEntryRow): TimeEntry => ({
  id: row.id,
  employeeId: row.employee_id,
  employeeName: row.employee_name,
  taskDescription: row.task_description,
  startedAt: row.started_at,
  stoppedAt: row.stopped_at,
  durationSeconds: row.duration_seconds,
  createdAt: row.created_at,
});

export function createServices(database: AppDatabase, clock: Clock = () => new Date()) {
  function getEmployee(id: number): EmployeeRow {
    const employee = database.prepare(`
      SELECT e.id, e.full_name, e.position, e.created_at,
        EXISTS(SELECT 1 FROM time_entries t WHERE t.employee_id = e.id AND t.stopped_at IS NULL) AS active_timer
      FROM employees e WHERE e.id = ?
    `).get(id) as EmployeeRow | undefined;
    if (!employee) throw new AppError(404, 'EMPLOYEE_NOT_FOUND', 'Сотрудник не найден');
    return employee;
  }

  function listEmployees(): Employee[] {
    const rows = database.prepare(`
      SELECT e.id, e.full_name, e.position, e.created_at,
        EXISTS(SELECT 1 FROM time_entries t WHERE t.employee_id = e.id AND t.stopped_at IS NULL) AS active_timer
      FROM employees e ORDER BY e.full_name COLLATE NOCASE
    `).all() as EmployeeRow[];
    return rows.map(mapEmployee);
  }

  function createEmployee(fullName: string, position: string | null): Employee {
    try {
      const result = database.prepare('INSERT INTO employees (full_name, position) VALUES (?, ?)').run(fullName, position);
      return mapEmployee(getEmployee(Number(result.lastInsertRowid)));
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        throw new AppError(409, 'EMPLOYEE_EXISTS', 'Сотрудник с таким именем уже существует');
      }
      throw error;
    }
  }

  function startTimer(employeeId: number, taskDescription: string): TimeEntry {
    getEmployee(employeeId);
    const startedAt = clock().toISOString();
    try {
      const result = database.prepare(`
        INSERT INTO time_entries (employee_id, task_description, started_at) VALUES (?, ?, ?)
      `).run(employeeId, taskDescription, startedAt);
      return getEntry(Number(result.lastInsertRowid));
    } catch (error) {
      if (error instanceof Error && (
        error.message.includes('one_active_timer_per_employee')
        || error.message.includes('UNIQUE constraint failed: time_entries.employee_id')
      )) {
        throw new AppError(409, 'TIMER_ALREADY_RUNNING', 'У сотрудника уже запущен таймер');
      }
      throw error;
    }
  }

  function getEntry(id: number): TimeEntry {
    const row = database.prepare(`
      SELECT t.id, t.employee_id, e.full_name AS employee_name, t.task_description,
        t.started_at, t.stopped_at, t.duration_seconds, t.created_at
      FROM time_entries t JOIN employees e ON e.id = t.employee_id WHERE t.id = ?
    `).get(id) as TimeEntryRow | undefined;
    if (!row) throw new AppError(404, 'TIME_ENTRY_NOT_FOUND', 'Запись учета времени не найдена');
    return mapEntry(row);
  }

  function stopTimer(id: number): TimeEntry {
    const stoppedAt = clock().toISOString();
    const stop = database.transaction(() => {
      const entry = database.prepare('SELECT started_at, stopped_at FROM time_entries WHERE id = ?').get(id) as
        { started_at: string; stopped_at: string | null } | undefined;
      if (!entry) throw new AppError(404, 'TIME_ENTRY_NOT_FOUND', 'Запись учета времени не найдена');
      if (entry.stopped_at) throw new AppError(409, 'TIMER_ALREADY_STOPPED', 'Этот таймер уже остановлен');
      const durationSeconds = Math.max(0, Math.floor((Date.parse(stoppedAt) - Date.parse(entry.started_at)) / 1000));
      database.prepare(`
        UPDATE time_entries SET stopped_at = ?, duration_seconds = ? WHERE id = ? AND stopped_at IS NULL
      `).run(stoppedAt, durationSeconds, id);
    });
    stop();
    return getEntry(id);
  }

  function listActiveTimers(): TimeEntry[] {
    const rows = database.prepare(`
      SELECT t.id, t.employee_id, e.full_name AS employee_name, t.task_description,
        t.started_at, t.stopped_at, t.duration_seconds, t.created_at
      FROM time_entries t JOIN employees e ON e.id = t.employee_id
      WHERE t.stopped_at IS NULL ORDER BY t.started_at DESC
    `).all() as TimeEntryRow[];
    return rows.map(mapEntry);
  }

  function listTimeEntries(filters: { employeeId?: number; date?: string; sort: 'newest' | 'oldest' }): TimeEntry[] {
    if (filters.employeeId !== undefined) getEmployee(filters.employeeId);
    const conditions: string[] = [];
    const params: (number | string)[] = [];
    if (filters.employeeId) {
      conditions.push('t.employee_id = ?');
      params.push(filters.employeeId);
    }
    if (filters.date) {
      const dayStart = Date.parse(`${filters.date}T00:00:00.000Z`);
      conditions.push('t.started_at < ? AND COALESCE(t.stopped_at, ?) > ?');
      params.push(new Date(dayStart + 86_400_000).toISOString(), clock().toISOString(), new Date(dayStart).toISOString());
    }
    const direction = filters.sort === 'oldest' ? 'ASC' : 'DESC';
    const rows = database.prepare(`
      SELECT t.id, t.employee_id, e.full_name AS employee_name, t.task_description,
        t.started_at, t.stopped_at, t.duration_seconds, t.created_at
      FROM time_entries t JOIN employees e ON e.id = t.employee_id
      ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY t.started_at ${direction}, t.id ${direction}
    `).all(...params) as TimeEntryRow[];
    return rows.map(mapEntry);
  }

  function buildReport(startDate: string, endDate: string, employeeId?: number): ReportSummary {
    const periodStart = Date.parse(`${startDate}T00:00:00.000Z`);
    const periodEnd = Date.parse(`${endDate}T00:00:00.000Z`) + 86_400_000;
    if (employeeId) getEmployee(employeeId);
    const filters = employeeId ? 'AND t.employee_id = ?' : '';
    const rows = database.prepare(`
      SELECT t.id, t.employee_id, e.full_name AS employee_name, t.task_description,
        t.started_at, t.stopped_at, t.duration_seconds, t.created_at
      FROM time_entries t JOIN employees e ON e.id = t.employee_id
      WHERE t.started_at < ? AND COALESCE(t.stopped_at, ?) > ? ${filters}
      ORDER BY t.started_at DESC
    `).all(new Date(periodEnd).toISOString(), clock().toISOString(), `${startDate}T00:00:00.000Z`, ...(employeeId ? [employeeId] : [])) as TimeEntryRow[];
    const now = clock().getTime();
    const byEmployee = new Map<number, EmployeeReport>();
    let totalTrackedSeconds = 0;
    let completedEntries = 0;

    for (const row of rows) {
      const start = Date.parse(row.started_at);
      const end = row.stopped_at ? Date.parse(row.stopped_at) : now;
      const trackedSeconds = Math.max(0, Math.floor((Math.min(end, periodEnd) - Math.max(start, periodStart)) / 1000));
      if (trackedSeconds === 0) continue;
      const entry: ReportEntry = {
        ...mapEntry(row),
        status: row.stopped_at ? 'completed' : 'active',
        trackedSeconds,
      };
      const report = byEmployee.get(row.employee_id) ?? {
        employeeId: row.employee_id,
        employeeName: row.employee_name,
        completedTasks: 0,
        trackedSeconds: 0,
        entries: [],
      };
      report.entries.push(entry);
      report.trackedSeconds += trackedSeconds;
      if (entry.status === 'completed') {
        report.completedTasks += 1;
        completedEntries += 1;
      }
      totalTrackedSeconds += trackedSeconds;
      byEmployee.set(row.employee_id, report);
    }

    return {
      startDate,
      endDate,
      totalTrackedSeconds,
      totalMinutes: Math.floor(totalTrackedSeconds / 60),
      totalHours: Math.floor(totalTrackedSeconds / 3600),
      completedEntries,
      employeesWithTrackedTime: byEmployee.size,
      employees: [...byEmployee.values()],
    };
  }

  return { listEmployees, createEmployee, startTimer, stopTimer, listActiveTimers, listTimeEntries, buildReport };
}

export type Services = ReturnType<typeof createServices>;