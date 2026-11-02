// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../frontend/src/App';
import { dateInputValue, overlapsCalendarDay } from '../frontend/src/utils';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mockApi() {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const data = url.includes('/api/employees')
      ? [{ id: 1, fullName: 'Анна Смирнова', position: 'Дизайнер продукта', createdAt: '2026-11-02T00:00:00.000Z', activeTimer: false }]
      : [];
    return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
  return calls;
}

describe('application navigation', () => {
  it('loads live employee data and opens the time tracking view', async () => {
    const calls = mockApi();
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText('Анна Смирнова')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Учет времени/ }));
    expect(await screen.findByRole('heading', { name: 'Учет времени' })).toBeInTheDocument();
    expect(screen.getByLabelText('Сотрудник')).toBeInTheDocument();
    expect(calls.some((url) => url === '/api/time-entries/active')).toBe(true);
  });

  it('shows a useful error when the API is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    render(<App />);
    expect(await screen.findByText(/Сервер недоступен/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });
});

describe('UTC calendar dates', () => {
  it('uses UTC date values and excludes entries ending exactly at day start', () => {
    expect(dateInputValue(new Date('2026-11-02T23:30:00-05:00'))).toBe('2026-11-03');
    expect(overlapsCalendarDay('2026-11-02T23:00:00.000Z', '2026-11-03T00:00:00.000Z', '2026-11-03', Date.now())).toBe(false);
    expect(overlapsCalendarDay('2026-11-02T23:00:00.000Z', null, '2026-11-03', Date.parse('2026-11-03T01:00:00.000Z'))).toBe(true);
  });
});