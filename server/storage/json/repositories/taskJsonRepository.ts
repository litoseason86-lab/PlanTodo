import type {
  CreateTaskInput,
  TaskFilters,
  TaskRepository,
} from '../../../modules/tasks/repository';
import type {Task} from '../../../../shared/domain/entities';
import type {TaskStatus} from '../../../../shared/domain/status';
import {JsonFileStore} from '../fileStore';

export class TaskJsonRepository implements TaskRepository {
  constructor(private readonly store: JsonFileStore) {}

  listByFilters(filters: TaskFilters): Task[] {
    return this.store
      .read()
      .tasks.filter((task) => {
        if (task.userId !== filters.userId) return false;
        if (filters.plannedDate && task.plannedDate !== filters.plannedDate) return false;
        if (filters.status && task.status !== filters.status) return false;
        if (filters.categoryId && task.categoryId !== filters.categoryId) return false;
        return true;
      })
      .sort((left, right) => {
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      });
  }

  getById(taskId: number, userId: number): Task | undefined {
    return this.store.read().tasks.find((task) => task.id === taskId && task.userId === userId);
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
      return task;
    });
  }
}

