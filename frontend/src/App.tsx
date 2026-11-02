import { useEffect, useState } from 'react';
import {
  Activity, ArrowDownWideNarrow, ArrowUpWideNarrow, CalendarDays, ChartNoAxesCombined,
  Check, CircleAlert, Clock3, LayoutDashboard, Menu, Play, Plus, Square, Users, X,
} from 'lucide-react';
import { api } from './api';
import type { Employee, Page, ReportSummary, TimeEntry } from './types';
import { dateInputValue, elapsedSeconds, formatDateTime, formatDuration, overlapsCalendarDay } from './utils';

const navigation: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Обзор', icon: LayoutDashboard },
  { id: 'employees', label: 'Сотрудники', icon: Users },
  { id: 'tracking', label: 'Учет времени', icon: Clock3 },
  { id: 'reports', label: 'Отчеты', icon: ChartNoAxesCombined },
];

const pageTitles: Record<Page, string> = {
  dashboard: 'Обзор команды',
  employees: 'Сотрудники',
  tracking: 'Учет времени',
  reports: 'Отчеты',
};

function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [activeTimers, setActiveTimers] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  async function refresh() {
    const [employeeList, activeList, entryList] = await Promise.all([
      api.employees(), api.activeTimers(), api.entries({ sort: 'newest' }),
    ]);
    setEmployees(employeeList);
    setActiveTimers(activeList);
    setEntries(entryList);
  }

  useEffect(() => {
    refresh()
      .catch((cause: unknown) => setLoadError(cause instanceof Error ? cause.message : 'Не удалось загрузить данные'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(''), 3500);
    return () => window.clearTimeout(timeout);
  }, [message]);

  async function perform(action: () => Promise<unknown>, successText: string): Promise<boolean> {
    setError('');
    setMessage('');
    try {
      await action();
      await refresh();
      setMessage(successText);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось выполнить действие');
      return false;
    }
  }

  function navigate(nextPage: Page) {
    setPage(nextPage);
    setMobileNavOpen(false);
    setError('');
  }

  const dateLabel = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(now));

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Activity size={19} strokeWidth={2.2} /></div>
          <span>смена<span className="brand-period">.</span></span>
          <button className="icon-button mobile-close" aria-label="Закрыть меню" onClick={() => setMobileNavOpen(false)}><X size={19} /></button>
        </div>
        <div className="workspace-label">Рабочее пространство</div>
        <nav className="side-nav" aria-label="Основная навигация">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${page === id ? 'nav-item-active' : ''}`} onClick={() => navigate(id)}>
              <Icon size={18} strokeWidth={1.8} /> <span>{label}</span>
              {id === 'tracking' && activeTimers.length > 0 && <span className="nav-count">{activeTimers.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-date"><CalendarDays size={15} /><span>{dateLabel}</span></div>
          <div className="profile-row">
            <div className="profile-avatar">К</div>
            <div><strong>Команда</strong><span>Администратор</span></div>
            <span className="online-dot" aria-label="Онлайн" />
          </div>
        </div>
      </aside>

      {mobileNavOpen && <button className="nav-scrim" aria-label="Закрыть меню" onClick={() => setMobileNavOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Открыть меню" onClick={() => setMobileNavOpen(true)}><Menu size={21} /></button>
          <div className="breadcrumb"><span>Рабочее пространство</span><span className="crumb-slash">/</span><strong>{pageTitles[page]}</strong></div>
          <div className="topbar-date"><span className="date-dot" />{dateLabel}</div>
        </header>

        <div className="content-wrap">
          <div className="page-heading">
            <div><h1>{pageTitles[page]}</h1><p>{page === 'dashboard' ? 'Рабочее время и активность команды' : page === 'employees' ? 'Управление командой и рабочими профилями' : page === 'tracking' ? 'Запускайте задачи и следите за рабочим временем' : 'Сводка по учтенному времени за выбранный период'}</p></div>
            {page === 'employees' && <button className="button button-primary" onClick={() => document.getElementById('employee-name')?.focus()}><Plus size={17} /> Новый сотрудник</button>}
          </div>

          {loadError && <div className="notice notice-error" role="alert"><CircleAlert size={18} /><span>{loadError}</span><button className="button button-quiet" onClick={() => { setLoading(true); setLoadError(''); refresh().catch((cause: unknown) => setLoadError(cause instanceof Error ? cause.message : 'Ошибка загрузки')).finally(() => setLoading(false)); }}>Повторить</button></div>}
          {error && <div className="notice notice-error" role="alert"><CircleAlert size={18} /><span>{error}</span><button className="notice-close" aria-label="Закрыть" onClick={() => setError('')}><X size={16} /></button></div>}
          {message && <div className="notice notice-success" role="status"><Check size={18} /><span>{message}</span></div>}

          {loading ? <div className="loading-state"><span className="spinner" />Загружаем данные</div> : (
            <>
              {page === 'dashboard' && <DashboardPage employees={employees} entries={entries} activeTimers={activeTimers} now={now} navigate={navigate} onStop={(id) => perform(() => api.stopTimer(id), 'Таймер остановлен')} />}
              {page === 'employees' && <EmployeesPage employees={employees} onCreate={(fullName, position) => perform(() => api.createEmployee({ fullName, position: position || undefined }), 'Сотрудник добавлен')} />}
              {page === 'tracking' && <TrackingPage employees={employees} entries={entries} activeTimers={activeTimers} now={now} onStart={(employeeId, taskDescription) => perform(() => api.startTimer({ employeeId, taskDescription }), 'Таймер запущен')} onStop={(id) => perform(() => api.stopTimer(id), 'Таймер остановлен')} />}
              {page === 'reports' && <ReportsPage employees={employees} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function DashboardPage({ employees, entries, activeTimers, now, navigate, onStop }: {
  employees: Employee[]; entries: TimeEntry[]; activeTimers: TimeEntry[]; now: number;
  navigate: (page: Page) => void; onStop: (id: number) => void;
}) {
  const today = dateInputValue(new Date(now));
  const todayEntries = entries.filter((entry) => entry.startedAt.slice(0, 10) === today && entry.durationSeconds !== null);
  const secondsToday = todayEntries.reduce((total, entry) => total + (entry.durationSeconds ?? 0), 0)
    + activeTimers.filter((entry) => entry.startedAt.slice(0, 10) === today).reduce((total, entry) => total + elapsedSeconds(entry.startedAt, now), 0);

  return (
    <>
      <section className="stats-grid" aria-label="Показатели команды">
        <StatCard label="Сотрудники" value={String(employees.length).padStart(2, '0')} detail="в рабочем пространстве" icon={<Users size={18} />} />
        <StatCard label="В работе" value={String(activeTimers.length).padStart(2, '0')} detail="активных таймера" icon={<Activity size={18} />} accent />
        <StatCard label="Учтено сегодня" value={formatDuration(secondsToday)} detail="часы : минуты" icon={<Clock3 size={18} />} />
        <StatCard label="Задачи сегодня" value={String(todayEntries.length).padStart(2, '0')} detail="завершено" icon={<Check size={18} />} />
      </section>

      <div className="dashboard-grid">
        <section className="panel active-panel">
          <div className="panel-heading"><div><h2>Сейчас в работе</h2><p>Активность команды в реальном времени</p></div><span className="live-indicator"><i /> LIVE</span></div>
          {activeTimers.length === 0 ? <EmptyState icon={<Clock3 size={20} />} title="Пока нет активных задач" detail="Запустите таймер, чтобы начать учитывать время." action={<button className="button button-secondary" onClick={() => navigate('tracking')}><Play size={15} /> К учету времени</button>} /> : (
            <div className="active-list">{activeTimers.map((entry) => <ActiveTimerRow key={entry.id} entry={entry} now={now} onStop={() => onStop(entry.id)} />)}</div>
          )}
        </section>

        <section className="panel team-panel">
          <div className="panel-heading"><div><h2>Команда</h2><p>{employees.length} рабочих профиля</p></div><button className="text-button" onClick={() => navigate('employees')}>Все сотрудники</button></div>
          {employees.length === 0 ? <EmptyState title="Добавьте первого сотрудника" detail="Профили нужны для запуска и учета задач." /> : (
            <div className="team-list">{employees.slice(0, 5).map((employee, index) => <div className="team-row" key={employee.id}><Avatar name={employee.fullName} index={index} /><div className="team-person"><strong>{employee.fullName}</strong><span>{employee.position || 'Должность не указана'}</span></div><span className={`status-pill ${employee.activeTimer ? 'status-running' : 'status-idle'}`}><i />{employee.activeTimer ? 'В работе' : 'Не активен'}</span></div>)}</div>
          )}
        </section>
      </div>

      <section className="panel recent-panel">
        <div className="panel-heading"><div><h2>Последние записи</h2><p>Недавно учтенное время</p></div><button className="text-button" onClick={() => navigate('tracking')}>К учету времени</button></div>
        {entries.length === 0 ? <EmptyState title="Записей пока нет" detail="Завершенные задачи появятся здесь." /> : <EntryTable entries={entries.slice(0, 5)} now={now} />}
      </section>
    </>
  );
}

function EmployeesPage({ employees, onCreate }: { employees: Employee[]; onCreate: (name: string, position: string) => Promise<boolean> }) {
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fullName.trim()) { setFormError('Укажите имя сотрудника'); return; }
    setSaving(true);
    setFormError('');
    try {
      if (await onCreate(fullName.trim(), position.trim())) {
        setFullName('');
        setPosition('');
      }
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Не удалось добавить сотрудника');
    } finally { setSaving(false); }
  }

  return (
    <div className="employees-layout">
      <section className="panel employee-form-panel">
        <div className="panel-heading"><div><h2>Новый сотрудник</h2><p>Добавьте профиль в команду</p></div><div className="panel-icon"><Plus size={18} /></div></div>
        <form className="employee-form" onSubmit={submit}>
          <label htmlFor="employee-name">Полное имя <span className="required-mark">*</span></label>
          <input id="employee-name" autoComplete="name" maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Например, Мария Иванова" />
          <label htmlFor="employee-position">Должность <span className="optional-mark">необязательно</span></label>
          <input id="employee-position" maxLength={120} value={position} onChange={(event) => setPosition(event.target.value)} placeholder="Например, дизайнер продукта" />
          {formError && <p className="field-error" role="alert">{formError}</p>}
          <button className="button button-primary form-submit" type="submit" disabled={saving}>{saving ? <><span className="button-spinner" />Сохраняем</> : <><Plus size={16} />Добавить сотрудника</>}</button>
        </form>
      </section>

      <section className="panel employee-list-panel">
        <div className="panel-heading"><div><h2>Все сотрудники</h2><p>Создано профилей: {employees.length}</p></div><span className="count-badge">{employees.length}</span></div>
        {employees.length === 0 ? <EmptyState title="Список сотрудников пуст" detail="Добавьте профиль через форму." /> : (
          <div className="employee-list">{employees.map((employee, index) => <div className="employee-row" key={employee.id}><Avatar name={employee.fullName} index={index} /><div className="employee-person"><strong>{employee.fullName}</strong><span>{employee.position || 'Должность не указана'}</span><small>В команде с {new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(employee.createdAt))}</small></div><span className={`status-pill ${employee.activeTimer ? 'status-running' : 'status-idle'}`}><i />{employee.activeTimer ? 'Таймер запущен' : 'Нет таймера'}</span></div>)}</div>
        )}
      </section>
    </div>
  );
}

function TrackingPage({ employees, entries, activeTimers, now, onStart, onStop }: {
  employees: Employee[]; entries: TimeEntry[]; activeTimers: TimeEntry[]; now: number;
  onStart: (employeeId: number, task: string) => Promise<boolean>; onStop: (id: number) => void;
}) {
  const [employeeId, setEmployeeId] = useState('');
  const [task, setTask] = useState('');
  const [starting, setStarting] = useState(false);
  const [formError, setFormError] = useState('');
  const selectedEmployee = employees.find((employee) => employee.id === Number(employeeId));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!employeeId) { setFormError('Выберите сотрудника'); return; }
    if (!task.trim()) { setFormError('Укажите описание задачи'); return; }
    setStarting(true);
    setFormError('');
    try { if (await onStart(Number(employeeId), task.trim())) setTask(''); }
    catch (cause) { setFormError(cause instanceof Error ? cause.message : 'Не удалось запустить таймер'); }
    finally { setStarting(false); }
  }

  return (
    <>
      <div className="tracking-grid">
        <section className="panel start-panel">
          <div className="panel-heading"><div><h2>Новая задача</h2><p>Выберите сотрудника и начните учет</p></div><div className="panel-icon panel-icon-green"><Play size={17} /></div></div>
          {employees.length === 0 ? <EmptyState title="Сначала добавьте сотрудника" detail="Без профиля нельзя запустить учет времени." /> : (
            <form className="tracking-form" onSubmit={submit}>
              <label htmlFor="tracking-employee">Сотрудник</label>
              <select id="tracking-employee" value={employeeId} onChange={(event) => { setEmployeeId(event.target.value); setFormError(''); }}>
                <option value="">Выберите сотрудника</option>
                {employees.map((employee) => <option value={employee.id} key={employee.id} disabled={employee.activeTimer}>{employee.fullName}{employee.activeTimer ? ' · таймер активен' : ''}</option>)}
              </select>
              <label htmlFor="tracking-task">Описание задачи</label>
              <input id="tracking-task" maxLength={500} value={task} onChange={(event) => setTask(event.target.value)} placeholder="Например, подготовка еженедельного отчета" />
              {formError && <p className="field-error" role="alert">{formError}</p>}
              <button className="button button-primary start-button" type="submit" disabled={starting || !selectedEmployee || selectedEmployee.activeTimer}>{starting ? <><span className="button-spinner" />Запускаем</> : <><Play size={16} fill="currentColor" />Запустить таймер</>}</button>
            </form>
          )}
          <div className="form-footnote"><CircleAlert size={14} /><span>У сотрудника может быть только одна активная задача.</span></div>
        </section>

        <section className="panel running-panel">
          <div className="panel-heading"><div><h2>Активные таймеры</h2><p>Время обновляется автоматически</p></div><span className="count-badge count-badge-green">{activeTimers.length}</span></div>
          {activeTimers.length === 0 ? <EmptyState icon={<Clock3 size={19} />} title="Активных таймеров нет" detail="Запущенные задачи появятся в этом списке." /> : <div className="active-list">{activeTimers.map((entry) => <ActiveTimerRow key={entry.id} entry={entry} now={now} onStop={() => onStop(entry.id)} />)}</div>}
        </section>
      </div>

      <section className="panel history-panel">
        <div className="panel-heading"><div><h2>История времени</h2><p>Все задачи команды</p></div><span className="count-badge">{entries.length}</span></div>
        <EntryTable entries={entries} now={now} />
      </section>
    </>
  );
}

function ReportsPage({ employees }: { employees: Employee[] }) {
  const today = dateInputValue(new Date());
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [employeeId, setEmployeeId] = useState('');
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (startDate > endDate) { setError('Дата начала должна быть не позже даты окончания'); return; }
    setLoading(true);
    setError('');
    try { setReport(await api.report({ startDate, endDate, employeeId: employeeId ? Number(employeeId) : undefined })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось сформировать отчет'); setReport(null); }
    finally { setLoading(false); }
  }

  return (
    <>
      <section className="panel report-filters">
        <form className="report-form" onSubmit={generate}>
          <div className="date-field"><label htmlFor="report-start">Начало периода</label><input id="report-start" type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} required /></div>
          <div className="date-field"><label htmlFor="report-end">Конец периода</label><input id="report-end" type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} required /></div>
          <div className="date-field employee-filter"><label htmlFor="report-employee">Сотрудник</label><select id="report-employee" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="">Вся команда</option>{employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.fullName}</option>)}</select></div>
          <button className="button button-primary report-button" type="submit" disabled={loading}>{loading ? <><span className="button-spinner" />Считаем</> : <><ChartNoAxesCombined size={16} />Сформировать</>}</button>
        </form>
        {error && <p className="field-error report-error" role="alert">{error}</p>}
      </section>

      {!report ? <section className="panel report-placeholder"><EmptyState icon={<ChartNoAxesCombined size={20} />} title="Выберите период для отчета" detail="Укажите даты и сформируйте сводку по команде." /></section> : (
        <>
          <section className="report-summary-grid" aria-label="Итоги отчета">
            <StatCard label="Всего учтено" value={formatDuration(report.totalTrackedSeconds)} detail={`${report.totalMinutes} минут`} icon={<Clock3 size={18} />} accent />
            <StatCard label="Завершено задач" value={String(report.completedEntries).padStart(2, '0')} detail="записей за период" icon={<Check size={18} />} />
            <StatCard label="Сотрудники" value={String(report.employeesWithTrackedTime).padStart(2, '0')} detail="с учтенным временем" icon={<Users size={18} />} />
          </section>
          <section className="panel report-results">
            <div className="panel-heading"><div><h2>Задачи по сотрудникам</h2><p>{formatRange(report.startDate, report.endDate)}</p></div><span className="count-badge">{report.employees.reduce((total, employee) => total + employee.entries.length, 0)}</span></div>
            {report.employees.length === 0 ? <EmptyState icon={<CalendarDays size={19} />} title="За этот период записей нет" detail="Попробуйте изменить даты или выбрать другого сотрудника." /> : report.employees.map((employee, index) => <div className="report-employee" key={employee.employeeId}>
              <div className="report-employee-heading"><Avatar name={employee.employeeName} index={index} /><div className="employee-person"><strong>{employee.employeeName}</strong><span>{employee.completedTasks} завершено · {formatDuration(employee.trackedSeconds)} всего</span></div></div>
              <div className="report-task-list">{employee.entries.map((entry) => <div className="report-task" key={entry.id}><div className="report-task-copy"><span>{entry.taskDescription}</span><small>{formatDateTime(entry.startedAt)} – {formatDateTime(entry.stoppedAt)}{entry.status === 'active' ? ' · выполняется' : ''}</small></div><strong>{formatDuration(entry.trackedSeconds)}</strong></div>)}</div>
            </div>)}
          </section>
        </>
      )}
    </>
  );
}

function formatRange(start: string, end: string): string {
  const formatter = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  return start === end ? formatter.format(new Date(`${start}T12:00:00`)) : `${formatter.format(new Date(`${start}T12:00:00`))} — ${formatter.format(new Date(`${end}T12:00:00`))}`;
}

function StatCard({ label, value, detail, icon, accent = false }: { label: string; value: string; detail: string; icon: React.ReactNode; accent?: boolean }) {
  return <article className={`stat-card ${accent ? 'stat-card-accent' : ''}`}><div className="stat-top"><span>{label}</span><span className="stat-icon">{icon}</span></div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></article>;
}

function ActiveTimerRow({ entry, now, onStop }: { entry: TimeEntry; now: number; onStop: () => void }) {
  return <div className="active-row"><div className="timer-status-mark"><i /></div><div className="active-copy"><strong>{entry.employeeName}</strong><span>{entry.taskDescription}</span><small>Начато {formatDateTime(entry.startedAt)}</small></div><div className="active-duration"><strong>{formatDuration(elapsedSeconds(entry.startedAt, now))}</strong><span>часы : минуты</span></div><button className="button button-stop" onClick={onStop}><Square size={13} fill="currentColor" />Остановить</button></div>;
}

function EntryTable({ entries, now }: { entries: TimeEntry[]; now: number }) {
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const filtered = entries
    .filter((entry) => !employeeFilter || entry.employeeId === Number(employeeFilter))
    .filter((entry) => !dateFilter || overlapsCalendarDay(entry.startedAt, entry.stoppedAt, dateFilter, now))
    .sort((left, right) => (sort === 'newest' ? right.startedAt.localeCompare(left.startedAt) : left.startedAt.localeCompare(right.startedAt)));
  const employees = [...new Map(entries.map((entry) => [entry.employeeId, entry.employeeName])).entries()];

  return (
    <>
      <div className="table-toolbar"><label className="filter-select"><span className="sr-only">Фильтр по сотруднику</span><Users size={15} /><select aria-label="Фильтр по сотруднику" value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}><option value="">Все сотрудники</option>{employees.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select></label><label className="filter-date"><span className="sr-only">Фильтр по дате</span><CalendarDays size={15} /><input aria-label="Фильтр по дате" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></label><button className="sort-button" onClick={() => setSort(sort === 'newest' ? 'oldest' : 'newest')} aria-label={sort === 'newest' ? 'Сначала старые' : 'Сначала новые'} title={sort === 'newest' ? 'Сначала старые' : 'Сначала новые'}>{sort === 'newest' ? <ArrowDownWideNarrow size={16} /> : <ArrowUpWideNarrow size={16} />}<span>{sort === 'newest' ? 'Сначала новые' : 'Сначала старые'}</span></button></div>
      {filtered.length === 0 ? <EmptyState title={entries.length ? 'По фильтрам ничего не найдено' : 'Записей пока нет'} detail={entries.length ? 'Измените фильтры, чтобы увидеть другие записи.' : 'Запущенные и завершенные задачи появятся здесь.'} /> : (
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Сотрудник</th><th>Задача</th><th>Начало</th><th>Окончание</th><th>Длительность</th><th>Статус</th></tr></thead><tbody>{filtered.map((entry, index) => <tr key={entry.id}><td><div className="table-person"><Avatar name={entry.employeeName} index={index} small /><span>{entry.employeeName}</span></div></td><td className="task-cell">{entry.taskDescription}</td><td>{formatDateTime(entry.startedAt)}</td><td>{formatDateTime(entry.stoppedAt)}</td><td className="duration-cell">{formatDuration(entry.durationSeconds ?? elapsedSeconds(entry.startedAt, now))}</td><td><span className={`status-pill ${entry.stoppedAt ? 'status-complete' : 'status-running'}`}><i />{entry.stoppedAt ? 'Завершена' : 'В работе'}</span></td></tr>)}</tbody></table></div>
      )}
    </>
  );
}

function Avatar({ name, index, small = false }: { name: string; index: number; small?: boolean }) {
  const colors = ['avatar-green', 'avatar-blue', 'avatar-yellow', 'avatar-pink', 'avatar-slate'];
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('ru-RU');
  return <span className={`avatar ${colors[index % colors.length]} ${small ? 'avatar-small' : ''}`}>{initials}</span>;
}

function EmptyState({ icon, title, detail, action }: { icon?: React.ReactNode; title: string; detail: string; action?: React.ReactNode }) {
  return <div className="empty-state">{icon && <div className="empty-icon">{icon}</div>}<strong>{title}</strong><p>{detail}</p>{action}</div>;
}

export default App;