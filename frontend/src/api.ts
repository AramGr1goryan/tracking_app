import type { Employee, ReportSummary, TimeEntry } from './types';

interface ApiError {
  error?: { message?: string };
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new Error('Сервер недоступен. Проверьте подключение и повторите попытку');
  }
  const body: unknown = await response.json();
  if (!response.ok) {
    const message = (body as ApiError).error?.message;
    throw new Error(message ?? 'Не удалось выполнить запрос');
  }
  return (body as { data: T }).data;
}

export const api = {
  employees: () => request<Employee[]>('/api/employees'),
  createEmployee: (body: { fullName: string; position?: string }) => request<Employee>('/api/employees', {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  entries: (filters: { employeeId?: number; date?: string; sort: 'newest' | 'oldest' }) => {
    const query = new URLSearchParams({ sort: filters.sort });
    if (filters.employeeId) query.set('employeeId', String(filters.employeeId));
    if (filters.date) query.set('date', filters.date);
    return request<TimeEntry[]>(`/api/time-entries?${query}`);
  },
  activeTimers: () => request<TimeEntry[]>('/api/time-entries/active'),
  startTimer: (body: { employeeId: number; taskDescription: string }) => request<TimeEntry>('/api/time-entries/start', {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  stopTimer: (id: number) => request<TimeEntry>(`/api/time-entries/${id}/stop`, { method: 'POST' }),
  report: (filters: { startDate: string; endDate: string; employeeId?: number }) => {
    const query = new URLSearchParams({ startDate: filters.startDate, endDate: filters.endDate });
    if (filters.employeeId) query.set('employeeId', String(filters.employeeId));
    return request<ReportSummary>(`/api/reports/summary?${query}`);
  },
};