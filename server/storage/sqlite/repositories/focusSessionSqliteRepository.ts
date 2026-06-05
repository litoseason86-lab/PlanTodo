import type Database from 'better-sqlite3';

import type {
  CreateRunningSessionInput,
  FocusSessionRepository,
  PauseSessionInput,
  ResumeSessionInput,
  StopSessionInput,
} from '../../../modules/focus/repository';
import type {TaskExecutionSession} from '../../../../shared/domain/entities';
import {mapSessionRow, type SessionRow} from './rowMappers';

function secondsBetween(startAt: string, endAt: string): number {
  return Math.max(0, Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 1000));
}

function calculateDurationSeconds(row: SessionRow, endedAt: string): number {
  const activePauseSeconds =
    row.status === 'PAUSED' && row.paused_at ? secondsBetween(row.paused_at, endedAt) : 0;
  return Math.max(0, secondsBetween(row.started_at, endedAt) - (row.accumulated_pause_seconds ?? 0) - activePauseSeconds);
}

export class FocusSessionSqliteRepository implements FocusSessionRepository {
  constructor(private readonly db: Database.Database) {}

  getRunningByUser(userId: number): TaskExecutionSession | undefined {
    const row = this.db
      .prepare("select * from task_execution_sessions where user_id = ? and status in ('RUNNING', 'PAUSED') limit 1")
      .get(userId) as SessionRow | undefined;
    return row ? mapSessionRow(row) : undefined;
  }

  listByTask(taskId: number, userId: number): TaskExecutionSession[] {
    return (this.db
      .prepare('select * from task_execution_sessions where task_id = ? and user_id = ? order by started_at desc')
      .all(taskId, userId) as SessionRow[]).map(mapSessionRow);
  }

  listByDateRange(userId: number, startAt: string, endAt: string): TaskExecutionSession[] {
    return (this.db
      .prepare('select * from task_execution_sessions where user_id = ? and started_at >= ? and started_at <= ? order by started_at asc')
      .all(userId, startAt, endAt) as SessionRow[]).map(mapSessionRow);
  }

  createRunning(input: CreateRunningSessionInput): TaskExecutionSession {
    const startedAt = input.startedAt ?? new Date().toISOString();
    const result = this.db
      .prepare('insert into task_execution_sessions (task_id, user_id, started_at, status, created_at) values (?, ?, ?, ?, ?)')
      .run(input.taskId, input.userId, startedAt, 'RUNNING', startedAt);
    const row = this.db
      .prepare('select * from task_execution_sessions where id = ?')
      .get(Number(result.lastInsertRowid)) as SessionRow;
    return mapSessionRow(row);
  }

  pause(input: PauseSessionInput): TaskExecutionSession | undefined {
    const pausedAt = input.pausedAt ?? new Date().toISOString();
    const result = this.db
      .prepare("update task_execution_sessions set status = 'PAUSED', paused_at = ?, accumulated_pause_seconds = coalesce(accumulated_pause_seconds, 0) where id = ? and user_id = ? and status = 'RUNNING'")
      .run(pausedAt, input.sessionId, input.userId);
    if (result.changes === 0) {
      return undefined;
    }

    const row = this.db.prepare('select * from task_execution_sessions where id = ?').get(input.sessionId) as SessionRow;
    return mapSessionRow(row);
  }

  resume(input: ResumeSessionInput): TaskExecutionSession | undefined {
    const row = this.db
      .prepare("select * from task_execution_sessions where id = ? and user_id = ? and status = 'PAUSED'")
      .get(input.sessionId, input.userId) as SessionRow | undefined;
    if (!row || !row.paused_at) {
      return undefined;
    }

    const resumedAt = input.resumedAt ?? new Date().toISOString();
    const accumulatedPauseSeconds = (row.accumulated_pause_seconds ?? 0) + secondsBetween(row.paused_at, resumedAt);
    this.db
      .prepare("update task_execution_sessions set status = 'RUNNING', paused_at = null, accumulated_pause_seconds = ? where id = ? and user_id = ?")
      .run(accumulatedPauseSeconds, input.sessionId, input.userId);

    const updated = this.db.prepare('select * from task_execution_sessions where id = ?').get(input.sessionId) as SessionRow;
    return mapSessionRow(updated);
  }

  stop(input: StopSessionInput): TaskExecutionSession | undefined {
    const row = this.db
      .prepare("select * from task_execution_sessions where id = ? and user_id = ? and status in ('RUNNING', 'PAUSED')")
      .get(input.sessionId, input.userId) as SessionRow | undefined;
    if (!row) {
      return undefined;
    }

    const endedAt = input.endedAt ?? new Date().toISOString();
    const activePauseSeconds =
      row.status === 'PAUSED' && row.paused_at ? secondsBetween(row.paused_at, endedAt) : 0;
    const accumulatedPauseSeconds = (row.accumulated_pause_seconds ?? 0) + activePauseSeconds;
    const durationSeconds = calculateDurationSeconds(row, endedAt);
    this.db
      .prepare("update task_execution_sessions set ended_at = ?, duration_seconds = ?, paused_at = null, accumulated_pause_seconds = ?, status = 'COMPLETED' where id = ? and user_id = ?")
      .run(endedAt, durationSeconds, accumulatedPauseSeconds, input.sessionId, input.userId);

    const updated = this.db.prepare('select * from task_execution_sessions where id = ?').get(input.sessionId) as SessionRow;
    return mapSessionRow(updated);
  }
}
