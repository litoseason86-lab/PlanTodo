// API Client for Plan Management System

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'NOT_DONE';
export type SessionStatus = 'RUNNING' | 'COMPLETED' | 'CANCELLED';

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
  plannedDate: string; // YYYY-MM-DD
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaskExecutionSession {
  id: number;
  taskId: number;
  userId: number;
  startedAt: string; // ISO String
  endedAt?: string; // ISO String
  durationSeconds?: number;
  status: SessionStatus;
  createdAt: string;
  taskTitle?: string; // enriched
}

export interface DailyReport {
  id: number;
  userId: number;
  reportDate: string; // YYYY-MM-DD
  content: string;
  generatorType: 'RULE_BASED';
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyReview {
  id: number;
  userId: number;
  weekStartDate: string; // YYYY-MM-DD
  weekEndDate: string; // YYYY-MM-DD
  content: string;
  generatorType: 'RULE_BASED';
  createdAt: string;
  updatedAt: string;
}

// Custom API Error Handler
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    let errMsg = `Request failed: ${response.statusText}`;
    try {
      const data = await response.json();
      if (data && data.message) {
        errMsg = data.message;
      }
    } catch {
      // ignore
    }
    throw new ApiError(response.status, errMsg);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Category Management
  getCategories(): Promise<Category[]> {
    return request<Category[]>('/api/categories');
  },
  
  createCategory(category: { name: string; color: string; sortOrder: number }): Promise<Category> {
    return request<Category>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(category),
    });
  },

  updateCategory(id: number, category: { name: string; color: string; sortOrder: number }): Promise<Category> {
    return request<Category>(`/api/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(category),
    });
  },

  deleteCategory(id: number): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(`/api/categories/${id}`, {
      method: 'DELETE',
    });
  },

  // Task Management
  getTasks(filters?: { date?: string; status?: TaskStatus; categoryId?: number }): Promise<Task[]> {
    const params = new URLSearchParams();
    if (filters?.date) params.append('date', filters.date);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.categoryId) params.append('categoryId', filters.categoryId.toString());
    
    const query = params.toString();
    const url = `/api/tasks${query ? `?${query}` : ''}`;
    return request<Task[]>(url);
  },

  createTask(task: { title: string; categoryId: number; plannedDate: string }): Promise<Task> {
    return request<Task>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
  },

  updateTaskStatus(id: number, status: TaskStatus): Promise<Task> {
    return request<Task>(`/api/tasks/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // Focus Session Timers
  getSessions(filters?: { date?: string }): Promise<TaskExecutionSession[]> {
    const params = new URLSearchParams();
    if (filters?.date) params.append('date', filters.date);
    const query = params.toString();
    return request<TaskExecutionSession[]>(`/api/task-sessions${query ? `?${query}` : ''}`);
  },

  getRunningSession(): Promise<{ session: TaskExecutionSession | null }> {
    return request<{ session: TaskExecutionSession | null }>('/api/task-sessions/running');
  },

  startSession(taskId: number): Promise<TaskExecutionSession> {
    return request<TaskExecutionSession>(`/api/tasks/${taskId}/sessions/start`, {
      method: 'POST',
    });
  },

  stopSession(sessionId: number): Promise<TaskExecutionSession> {
    return request<TaskExecutionSession>(`/api/task-sessions/${sessionId}/stop`, {
      method: 'POST',
    });
  },

  getSessionsByTask(taskId: number): Promise<TaskExecutionSession[]> {
    return request<TaskExecutionSession[]>(`/api/tasks/${taskId}/sessions`);
  },

  // Daily Reports
  getDailyReport(date: string): Promise<DailyReport> {
    return request<DailyReport>(`/api/daily-reports?date=${date}`);
  },

  generateDailyReport(date: string): Promise<DailyReport> {
    return request<DailyReport>('/api/daily-reports/generate', {
      method: 'POST',
      body: JSON.stringify({ date }),
    });
  },

  // Weekly Reviews
  getWeeklyReview(weekStart: string): Promise<WeeklyReview> {
    return request<WeeklyReview>(`/api/weekly-reviews?weekStart=${weekStart}`);
  },

  generateWeeklyReview(weekStart: string): Promise<WeeklyReview> {
    return request<WeeklyReview>('/api/weekly-reviews/generate', {
      method: 'POST',
      body: JSON.stringify({ weekStart }),
    });
  }
};
