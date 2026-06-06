import type {Task} from '../../../shared/domain/entities';
import type {TaskStatus} from '../../../shared/domain/status';

export interface TaskFilters {
  userId: number;
  plannedDate?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: TaskStatus;
  categoryId?: number;
}

export interface CreateTaskInput {
  userId: number;
  categoryId: number;
  title: string;
  plannedDate: string;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay?: boolean;
}

export interface UpdateTaskScheduleInput {
  taskId: number;
  userId: number;
  plannedDate: string;
  plannedEndDate?: string;
  startAt?: string;
  endAt?: string;
  allDay: boolean;
}

export interface TaskRepository {
  listByFilters(filters: TaskFilters): Task[];
  getById(taskId: number, userId: number): Task | undefined;
  create(input: CreateTaskInput): Task;
  updateStatus(taskId: number, userId: number, status: TaskStatus): Task | undefined;
  updateSchedule(input: UpdateTaskScheduleInput): Task | undefined;
  remove(taskId: number, userId: number): boolean;
}
