import type {
  Category,
  DailyReport,
  Task,
  TaskExecutionSession,
  User,
  WeeklyReview,
} from '../../shared/domain/entities';

export interface DatabaseSequences {
  categories: number;
  tasks: number;
  taskExecutionSessions: number;
  dailyReports: number;
  weeklyReviews: number;
}

export interface DatabaseSchema {
  users: User[];
  categories: Category[];
  tasks: Task[];
  taskExecutionSessions: TaskExecutionSession[];
  dailyReports: DailyReport[];
  weeklyReviews: WeeklyReview[];
  sequences: DatabaseSequences;
}

export function createEmptyDatabaseSchema(): DatabaseSchema {
  return {
    users: [],
    categories: [],
    tasks: [],
    taskExecutionSessions: [],
    dailyReports: [],
    weeklyReviews: [],
    sequences: {
      categories: 0,
      tasks: 0,
      taskExecutionSessions: 0,
      dailyReports: 0,
      weeklyReviews: 0,
    },
  };
}

