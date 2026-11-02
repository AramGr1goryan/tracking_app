export function formatDuration(seconds: number): string {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function elapsedSeconds(startedAt: string, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
}

export function formatDateTime(value: string | null): string {
  if (!value) return 'Идет';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

export function dateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function overlapsCalendarDay(startedAt: string, stoppedAt: string | null, date: string, now: number): boolean {
  const dayStart = Date.parse(`${date}T00:00:00.000Z`);
  const dayEnd = dayStart + 86_400_000;
  const end = stoppedAt ? Date.parse(stoppedAt) : now;
  return Date.parse(startedAt) < dayEnd && end > dayStart;
}