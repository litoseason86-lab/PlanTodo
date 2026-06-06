import type { ReportGeneratorType, SessionStatus, TaskStatus } from './status';

export interface User {
  id: number;
  username: string;
  displayName: string;
  createdAt: string;
}

export interface Category {
  id: number;
  userId: number;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: number;
  userId: number;
  categoryId: number;
  title: string;
  plannedDate?: string;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay: boolean;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaskExecutionSession {
  id: number;
  taskId: number;
  userId: number;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  pausedAt?: string;
  accumulatedPauseSeconds?: number;
  status: SessionStatus;
  createdAt: string;
  taskTitle?: string;
}

export interface DailyReport {
  id: number;
  userId: number;
  reportDate: string;
  content: string;
  generatorType: ReportGeneratorType;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyReview {
  id: number;
  userId: number;
  weekStartDate: string;
  weekEndDate: string;
  content: string;
  generatorType: ReportGeneratorType;
  createdAt: string;
  updatedAt: string;
}
