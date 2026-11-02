export interface Employee {
  id: number;
  fullName: string;
  position: string | null;
  createdAt: string;
  activeTimer: boolean;
}

export interface TimeEntry {
  id: number;
  employeeId: number;
  employeeName: string;
  taskDescription: string;
  startedAt: string;
  stoppedAt: string | null;
  durationSeconds: number | null;
  createdAt: string;
}

export interface ReportEntry extends TimeEntry {
  status: 'active' | 'completed';
  trackedSeconds: number;
}

export interface EmployeeReport {
  employeeId: number;
  employeeName: string;
  completedTasks: number;
  trackedSeconds: number;
  entries: ReportEntry[];
}

export interface ReportSummary {
  startDate: string;
  endDate: string;
  totalTrackedSeconds: number;
  totalMinutes: number;
  totalHours: number;
  completedEntries: number;
  employeesWithTrackedTime: number;
  employees: EmployeeReport[];
}