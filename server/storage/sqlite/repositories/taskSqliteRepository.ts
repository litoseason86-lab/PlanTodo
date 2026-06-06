import type Database from 'better-sqlite3';

import type {
  CreateTaskInput,
  TaskFilters,
  TaskRepository,
  UpdateTaskScheduleInput,
} from '../../../modules/tasks/repository';
import type {Task} from '../../../../shared/domain/entities';
import type {TaskStatus} from '../../../../shared/domain/status';
import {taskIntersectsDateRange} from '../../../../shared/lib/schedule';
import {mapTaskRow, type TaskRow} from './rowMappers';

export class TaskSqliteRepository implements TaskRepository {
  constructor(private readonly db: Database.Database) {}

  listByFilters(filters: TaskFilters): Task[] {
    const clauses = ['user_id = ?'];
    const values: Array<string | number> = [filters.userId];
    if (filters.status) {
      clauses.push('status = ?');
      values.push(filters.status);
    }
    if (filters.categoryId) {
      clauses.push('category_id = ?');
      values.push(filters.categoryId);
    }

    const rangeStart = filters.plannedDate ?? filters.dateFrom;
    const rangeEnd = filters.plannedDate ?? filters.dateTo;
    if (rangeStart && rangeEnd) {
      clauses.push(`(
        (
          all_day = 1
          and planned_date <= ?
          and coalesce(planned_end_date, planned_date) >= ?
        )
        or (
          all_day = 0
          and start_at is not null
          and end_at is not null
          and substr(start_at, 1, 10) <= ?
          and substr(end_at, 1, 10) >= ?
        )
      )`);
      values.push(rangeEnd, rangeStart, rangeEnd, rangeStart);
    }

    const rows = this.db
      .prepare(`select * from tasks where ${clauses.join(' and ')} order by created_at asc`)
      .all(...values) as TaskRow[];

    return rows.map(mapTaskRow).filter((task) => {
      if (filters.plannedDate && !taskIntersectsDateRange(task, filters.plannedDate, filters.plannedDate)) return false;
      if (filters.dateFrom && filters.dateTo && !taskIntersectsDateRange(task, filters.dateFrom, filters.dateTo)) return false;
      return true;
    });
  }

  getById(taskId: number, userId: number): Task | undefined {
    const row = this.db
      .prepare('select * from tasks where id = ? and user_id = ?')
      .get(taskId, userId) as TaskRow | undefined;
    return row ? mapTaskRow(row) : undefined;
  }

  create(input: CreateTaskInput): Task {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(`
        insert into tasks (
          user_id, category_id, title, planned_date, planned_end_date, start_at, end_at, all_day, status, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        input.userId,
        input.categoryId,
        input.title.trim(),
        input.plannedDate,
        input.allDay === false ? null : input.plannedEndDate ?? null,
        input.allDay === false ? input.startAt ?? null : null,
        input.allDay === false ? input.endAt ?? null : null,
        input.allDay === false ? 0 : 1,
        'TODO',
        now,
        now,
      );
    return this.getById(Number(result.lastInsertRowid), input.userId)!;
  }

  updateStatus(taskId: number, userId: number, status: TaskStatus): Task | undefined {
    const now = new Date().toISOString();
    const result = this.db
      .prepare('update tasks set status = ?, updated_at = ? where id = ? and user_id = ?')
      .run(status, now, taskId, userId);
    if (result.changes === 0) {
      return undefined;
    }
    return this.getById(taskId, userId);
  }

  updateSchedule(input: UpdateTaskScheduleInput): Task | undefined {
    const now = new Date().toISOString();
    const result = this.db
      .prepare(`
        update tasks
        set planned_date = ?,
            planned_end_date = ?,
            start_at = ?,
            end_at = ?,
            all_day = ?,
            updated_at = ?
        where id = ? and user_id = ?
      `)
      .run(
        input.plannedDate,
        input.allDay ? input.plannedEndDate ?? null : null,
        input.allDay ? null : input.startAt ?? null,
        input.allDay ? null : input.endAt ?? null,
        input.allDay ? 1 : 0,
        now,
        input.taskId,
        input.userId,
      );

    if (result.changes === 0) {
      return undefined;
    }
    return this.getById(input.taskId, input.userId);
  }

  remove(taskId: number, userId: number): boolean {
    const removeTask = this.db.transaction(() => {
      this.db.prepare('delete from task_execution_sessions where task_id = ? and user_id = ?').run(taskId, userId);
      return this.db.prepare('delete from tasks where id = ? and user_id = ?').run(taskId, userId).changes > 0;
    });

    return removeTask();
  }
}
