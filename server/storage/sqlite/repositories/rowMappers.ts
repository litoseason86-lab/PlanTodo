import type {Category, DailyReport, Task, TaskExecutionSession, WeeklyReview} from '../../../../shared/domain/entities';
import type {ReportGeneratorType, SessionStatus, TaskStatus} from '../../../../shared/domain/status';

export interface CategoryRow {
  id: number;
  user_id: number;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TaskRow {
  id: number;
  user_id: number;
  category_id: number;
  title: string;
  planned_date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SessionRow {
  id: number;
  task_id: number;
  user_id: number;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: string;
  created_at: string;
  task_title: string | null;
}

export interface DailyReportRow {
  id: number;
  user_id: number;
  report_date: string;
  content: string;
  generator_type: string;
  created_at: string;
  updated_at: string;
}

export interface WeeklyReviewRow {
  id: number;
  user_id: number;
  week_start_date: string;
  week_end_date: string;
  content: string;
  generator_type: string;
  created_at: string;
  updated_at: string;
}

export function mapCategoryRow(row: CategoryRow): Category {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTaskRow(row: TaskRow): Task {
  return {
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    title: row.title,
    plannedDate: row.planned_date,
    status: row.status as TaskStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSessionRow(row: SessionRow): TaskExecutionSession {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    durationSeconds: row.duration_seconds ?? undefined,
    status: row.status as SessionStatus,
    createdAt: row.created_at,
    taskTitle: row.task_title ?? undefined,
  };
}

export function mapDailyReportRow(row: DailyReportRow): DailyReport {
  return {
    id: row.id,
    userId: row.user_id,
    reportDate: row.report_date,
    content: row.content,
    generatorType: row.generator_type as ReportGeneratorType,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapWeeklyReviewRow(row: WeeklyReviewRow): WeeklyReview {
  return {
    id: row.id,
    userId: row.user_id,
    weekStartDate: row.week_start_date,
    weekEndDate: row.week_end_date,
    content: row.content,
    generatorType: row.generator_type as ReportGeneratorType,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
