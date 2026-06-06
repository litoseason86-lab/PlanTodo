import type {
  CreateTaskInput,
  TaskFilters,
  TaskRepository,
  UpdateTaskScheduleInput,
} from '../../../modules/tasks/repository';
import type {Task} from '../../../../shared/domain/entities';
import type {TaskStatus} from '../../../../shared/domain/status';
import {taskIntersectsDateRange, toCanonicalTask} from '../../../../shared/lib/schedule';
import {JsonFileStore} from '../fileStore';

function matchesScheduledFilter(task: Task, scheduled: TaskFilters['scheduled']): boolean {
  if (!scheduled) return true;
  if (scheduled === 'unscheduled') return !task.plannedDate;
  if (scheduled === 'scheduled') return Boolean(task.plannedDate);
  return Boolean(task.plannedDate && task.allDay && !task.plannedEndDate && !task.startAt && !task.endAt);
}

function matchesQuery(task: Task, query: string | undefined): boolean {
  if (!query) return true;
  return task.title.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}

function applyScheduleToTask(task: Task, input: UpdateTaskScheduleInput): void {
  task.plannedDate = input.plannedDate;
  task.plannedEndDate = input.plannedDate && input.allDay ? input.plannedEndDate : undefined;
  task.startAt = input.plannedDate && !input.allDay ? input.startAt : undefined;
  task.endAt = input.plannedDate && !input.allDay ? input.endAt : undefined;
  task.allDay = input.plannedDate ? input.allDay : true;
  task.updatedAt = new Date().toISOString();
}

export class TaskJsonRepository implements TaskRepository {
  constructor(private readonly store: JsonFileStore) {}

  listByFilters(filters: TaskFilters): Task[] {
    return this.store
      .read()
      .tasks.map(toCanonicalTask)
      .filter((task) => {
        if (task.userId !== filters.userId) return false;
        if (filters.plannedDate && !taskIntersectsDateRange(task, filters.plannedDate, filters.plannedDate)) return false;
        if (filters.dateFrom && filters.dateTo && !taskIntersectsDateRange(task, filters.dateFrom, filters.dateTo)) return false;
        if (filters.status && task.status !== filters.status) return false;
        if (filters.categoryId && task.categoryId !== filters.categoryId) return false;
        if (!matchesScheduledFilter(task, filters.scheduled)) return false;
        if (!matchesQuery(task, filters.query)) return false;
        return true;
      })
      .sort((left, right) => {
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      });
  }

  getById(taskId: number, userId: number): Task | undefined {
    const task = this.store.read().tasks.find((item) => item.id === taskId && item.userId === userId);
    return task ? toCanonicalTask(task) : undefined;
  }

  create(input: CreateTaskInput): Task {
    return this.store.update((data) => {
      data.sequences.tasks += 1;
      const now = new Date().toISOString();
      const task: Task = {
        id: data.sequences.tasks,
        userId: input.userId,
        categoryId: input.categoryId,
        title: input.title.trim(),
        plannedDate: input.plannedDate,
        plannedEndDate: input.plannedDate && (input.allDay ?? true) ? input.plannedEndDate : undefined,
        startAt: input.plannedDate && input.allDay === false ? input.startAt : undefined,
        endAt: input.plannedDate && input.allDay === false ? input.endAt : undefined,
        allDay: input.plannedDate ? input.allDay ?? true : true,
        status: 'TODO',
        createdAt: now,
        updatedAt: now,
      };
      data.tasks.push(task);
      return task;
    });
  }

  updateStatus(taskId: number, userId: number, status: TaskStatus): Task | undefined {
    return this.store.update((data) => {
      const task = data.tasks.find((item) => item.id === taskId && item.userId === userId);
      if (!task) {
        return undefined;
      }
      task.status = status;
      task.updatedAt = new Date().toISOString();
      return toCanonicalTask(task);
    });
  }

  updateSchedule(input: UpdateTaskScheduleInput): Task | undefined {
    return this.store.update((data) => {
      const task = data.tasks.find((item) => item.id === input.taskId && item.userId === input.userId);
      if (!task) {
        return undefined;
      }

      applyScheduleToTask(task, input);

      return toCanonicalTask(task);
    });
  }

  batchUpdateSchedules(inputs: UpdateTaskScheduleInput[]): Task[] {
    return this.store.update((data) => {
      const targets = inputs.map((input) => {
        const task = data.tasks.find((item) => item.id === input.taskId && item.userId === input.userId);
        if (!task) {
          throw new Error('Task not found');
        }
        return {task, input};
      });

      for (const {task, input} of targets) {
        applyScheduleToTask(task, input);
      }

      return targets.map(({task}) => toCanonicalTask(task));
    });
  }

  remove(taskId: number, userId: number): boolean {
    return this.store.update((data) => {
      const index = data.tasks.findIndex((task) => task.id === taskId && task.userId === userId);
      if (index === -1) {
        return false;
      }

      data.tasks.splice(index, 1);
      data.taskExecutionSessions = data.taskExecutionSessions.filter((session) => {
        return !(session.taskId === taskId && session.userId === userId);
      });
      return true;
    });
  }
}
