import type {Task} from '../../../shared/domain/entities';
import type {TaskStatus} from '../../../shared/domain/status';

export interface TaskFilters {
  userId: number;
  plannedDate?: string;
  status?: TaskStatus;
  categoryId?: number;
}

export interface CreateTaskInput {
  userId: number;
  categoryId: number;
  title: string;
  plannedDate: string;
}

export interface TaskRepository {
  listByFilters(filters: TaskFilters): Task[];
  getById(taskId: number, userId: number): Task | undefined;
  create(input: CreateTaskInput): Task;
  updateStatus(taskId: number, userId: number, status: TaskStatus): Task | undefined;
  remove(taskId: number, userId: number): boolean;
}
