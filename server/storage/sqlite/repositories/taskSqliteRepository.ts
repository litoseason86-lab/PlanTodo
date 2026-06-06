import type Database from 'better-sqlite3';

import type {
  CreateTaskInput,
  TaskFilters,
  TaskRepository,
  UpdateTaskScheduleInput,
} from '../../../modules/tasks/repository';
import type {Task} from '../../../../shared/domain/entities';
import type {TaskStatus} from '../../../../shared/domain/status';
import {mapTaskRow, type TaskRow} from './rowMappers';

export class TaskSqliteRepository implements TaskRepository {
  constructor(private readonly db: Database.Database) {}

  listByFilters(filters: TaskFilters): Task[] {
    const clauses = ['user_id = ?'];
    const values: Array<string | number> = [filters.userId];
    if (filters.plannedDate) {
      clauses.push('planned_date = ?');
      values.push(filters.plannedDate);
    }
    if (filters.status) {
      clauses.push('status = ?');
      values.push(filters.status);
    }
    if (filters.categoryId) {
      clauses.push('category_id = ?');
      values.push(filters.categoryId);
    }

    return (this.db
      .prepare(`select * from tasks where ${clauses.join(' and ')} order by created_at asc`)
      .all(...values) as TaskRow[]).map(mapTaskRow);
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
      .prepare('insert into tasks (user_id, category_id, title, planned_date, status, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)')
      .run(input.userId, input.categoryId, input.title.trim(), input.plannedDate, 'TODO', now, now);
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

  updateSchedule(_input: UpdateTaskScheduleInput): Task | undefined {
    return undefined;
  }

  remove(taskId: number, userId: number): boolean {
    const removeTask = this.db.transaction(() => {
      this.db.prepare('delete from task_execution_sessions where task_id = ? and user_id = ?').run(taskId, userId);
      return this.db.prepare('delete from tasks where id = ? and user_id = ?').run(taskId, userId).changes > 0;
    });

    return removeTask();
  }
}
