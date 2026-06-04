import fs from 'fs';
import path from 'path';

export interface User {
  id: number;
  username: string;
  displayName: string;
  createdAt: string;
}

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
  status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'NOT_DONE';
  createdAt: string;
  updatedAt: string;
}

export interface TaskExecutionSession {
  id: number;
  taskId: number;
  userId: number;
  startedAt: string; // ISO string
  endedAt?: string; // ISO string
  durationSeconds?: number;
  status: 'RUNNING' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
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

interface DatabaseSchema {
  users: User[];
  categories: Category[];
  tasks: Task[];
  taskExecutionSessions: TaskExecutionSession[];
  dailyReports: DailyReport[];
  weeklyReviews: WeeklyReview[];
  sequences: {
    categories: number;
    tasks: number;
    taskExecutionSessions: number;
    dailyReports: number;
    weeklyReviews: number;
  };
}

const DB_DIR = path.resolve('data');
const DB_FILE = path.join(DB_DIR, 'db.json');

class LocalDB {
  private data: DatabaseSchema;

  constructor() {
    this.data = {
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
        weeklyReviews: 0
      }
    };
    this.init();
  }

  private init() {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(fileContent);
        // Ensure structure is up to date (for schema evolution)
        if (!this.data.users) this.data.users = [];
        if (!this.data.categories) this.data.categories = [];
        if (!this.data.tasks) this.data.tasks = [];
        if (!this.data.taskExecutionSessions) this.data.taskExecutionSessions = [];
        if (!this.data.dailyReports) this.data.dailyReports = [];
        if (!this.data.weeklyReviews) this.data.weeklyReviews = [];
        if (!this.data.sequences) {
          this.data.sequences = {
            categories: Math.max(0, ...this.data.categories.map(c => c.id)),
            tasks: Math.max(0, ...this.data.tasks.map(t => t.id)),
            taskExecutionSessions: Math.max(0, ...this.data.taskExecutionSessions.map(s => s.id)),
            dailyReports: Math.max(0, ...this.data.dailyReports.map(r => r.id)),
            weeklyReviews: Math.max(0, ...this.data.weeklyReviews.map(w => w.id))
          };
        }
      } catch (err) {
        console.error('Failed to parse database file, resetting', err);
        this.seed();
      }
    } else {
      this.seed();
    }
  }

  private save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save to database file', err);
    }
  }

  private seed() {
    const now = new Date().toISOString();
    const todayStr = now.slice(0, 10);

    // Default demo user
    this.data.users = [{
      id: 1,
      username: 'demo',
      displayName: 'Demo User',
      createdAt: now
    }];

    // Seed default categories
    this.data.categories = [
      { id: 1, userId: 1, name: '工作与项目', color: '#ef4444', sortOrder: 1, createdAt: now, updatedAt: now },
      { id: 2, userId: 1, name: '自我提升与学习', color: '#3b82f6', sortOrder: 2, createdAt: now, updatedAt: now },
      { id: 3, userId: 1, name: '日常生活', color: '#10b981', sortOrder: 3, createdAt: now, updatedAt: now },
      { id: 4, userId: 1, name: '健康与运动', color: '#f59e0b', sortOrder: 4, createdAt: now, updatedAt: now }
    ];

    // Seed default tasks for today
    this.data.tasks = [
      { id: 1, userId: 1, categoryId: 1, title: '编写系统核心API设计', plannedDate: todayStr, status: 'DONE', createdAt: now, updatedAt: now },
      { id: 2, userId: 1, categoryId: 2, title: '阅读一章 Vue 与 TypeScript 实战', plannedDate: todayStr, status: 'IN_PROGRESS', createdAt: now, updatedAt: now },
      { id: 3, userId: 1, categoryId: 3, title: '去外面的超市买水果和牛奶', plannedDate: todayStr, status: 'TODO', createdAt: now, updatedAt: now },
      { id: 4, userId: 1, categoryId: 4, title: '慢跑 3 公里并拉伸', plannedDate: todayStr, status: 'TODO', createdAt: now, updatedAt: now }
    ];

    // Seed brief historical timings to allow meaningful statistics out of the box
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    this.data.tasks.push(
      { id: 5, userId: 1, categoryId: 2, title: '复习 JavaScript 核心基础', plannedDate: yesterday, status: 'DONE', createdAt: now, updatedAt: now },
      { id: 6, userId: 1, categoryId: 1, title: '重构老项目代码结构', plannedDate: yesterday, status: 'DONE', createdAt: now, updatedAt: now }
    );

    const yesterdayStarted = new Date(Date.now() - 24 * 60 * 60 * 1000 - 45 * 60 * 1000).toISOString();
    const yesterdayEnded = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    this.data.taskExecutionSessions = [
      {
        id: 1,
        taskId: 5,
        userId: 1,
        startedAt: yesterdayStarted,
        endedAt: yesterdayEnded,
        durationSeconds: 2700, // 45 mins
        status: 'COMPLETED',
        createdAt: yesterdayStarted
      }
    ];

    this.data.sequences = {
      categories: 4,
      tasks: 6,
      taskExecutionSessions: 1,
      dailyReports: 0,
      weeklyReviews: 0
    };

    this.save();
    console.log('Seeded the database with default categories, tasks, and historical timing datas.');
  }

  // --- Category APIs ---
  getCategories(userId: number): Category[] {
    return this.data.categories
      .filter(c => c.userId === userId)
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name);
      });
  }

  getCategoryByIdAndUserId(id: number, userId: number): Category | undefined {
    return this.data.categories.find(c => c.id === id && c.userId === userId);
  }

  existsCategoryByName(userId: number, name: string): boolean {
    const trimmedName = name.trim().toLowerCase();
    return this.data.categories.some(c => c.userId === userId && c.name.trim().toLowerCase() === trimmedName);
  }

  createCategory(userId: number, name: string, color: string, sortOrder: number): Category {
    const now = new Date().toISOString();
    this.data.sequences.categories += 1;
    const newCategory: Category = {
      id: this.data.sequences.categories,
      userId,
      name: name.trim(),
      color: color || '#64748b',
      sortOrder: sortOrder || 0,
      createdAt: now,
      updatedAt: now
    };
    this.data.categories.push(newCategory);
    this.save();
    return newCategory;
  }

  updateCategory(id: number, userId: number, name: string, color: string, sortOrder: number): Category | undefined {
    const cat = this.getCategoryByIdAndUserId(id, userId);
    if (!cat) return undefined;
    cat.name = name.trim();
    cat.color = color || '#64748b';
    cat.sortOrder = sortOrder;
    cat.updatedAt = new Date().toISOString();
    this.save();
    return cat;
  }

  deleteCategory(id: number, userId: number): boolean {
    const index = this.data.categories.findIndex(c => c.id === id && c.userId === userId);
    if (index === -1) return false;

    // Check if category is used by any task
    const isUsed = this.data.tasks.some(t => t.categoryId === id);
    if (isUsed) {
      throw new Error('Cannot delete category: Tasks are currently referencing it.');
    }

    this.data.categories.splice(index, 1);
    this.save();
    return true;
  }

  // --- Task APIs ---
  getTasks(userId: number, dateStr?: string, status?: string, categoryId?: number): Task[] {
    return this.data.tasks.filter(t => {
      if (t.userId !== userId) return false;
      if (dateStr && t.plannedDate !== dateStr) return false;
      if (status && t.status !== status) return false;
      if (categoryId && t.categoryId !== categoryId) return false;
      return true;
    }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  getTaskByIdAndUserId(id: number, userId: number): Task | undefined {
    return this.data.tasks.find(t => t.id === id && t.userId === userId);
  }

  createTask(userId: number, categoryId: number, title: string, plannedDate: string): Task {
    const now = new Date().toISOString();
    this.data.sequences.tasks += 1;
    const newTask: Task = {
      id: this.data.sequences.tasks,
      userId,
      categoryId,
      title: title.trim(),
      plannedDate,
      status: 'TODO',
      createdAt: now,
      updatedAt: now
    };
    this.data.tasks.push(newTask);
    this.save();
    return newTask;
  }

  updateTaskStatus(id: number, userId: number, status: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'NOT_DONE'): Task | undefined {
    const task = this.getTaskByIdAndUserId(id, userId);
    if (!task) return undefined;
    task.status = status;
    task.updatedAt = new Date().toISOString();
    this.save();
    return task;
  }

  // --- Task Execution Session APIs ---
  getRunningSession(userId: number): TaskExecutionSession | undefined {
    return this.data.taskExecutionSessions.find(s => s.userId === userId && s.status === 'RUNNING');
  }

  getSessionsByTask(taskId: number, userId: number): TaskExecutionSession[] {
    return this.data.taskExecutionSessions
      .filter(s => s.taskId === taskId && s.userId === userId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  getSessionsByDateRange(userId: number, startStr: string, endStr: string): TaskExecutionSession[] {
    const startTime = new Date(startStr).getTime();
    const endTime = new Date(endStr).getTime();
    return this.data.taskExecutionSessions.filter(s => {
      if (s.userId !== userId) return false;
      const started = new Date(s.startedAt).getTime();
      return started >= startTime && started <= endTime;
    });
  }

  startSession(taskId: number, userId: number): TaskExecutionSession {
    const running = this.getRunningSession(userId);
    if (running) {
      throw new Error('A focus session is already running. Please complete it first.');
    }

    const task = this.getTaskByIdAndUserId(taskId, userId);
    if (!task) {
      throw new Error('Task not found.');
    }

    const now = new Date().toISOString();
    this.data.sequences.taskExecutionSessions += 1;

    const newSession: TaskExecutionSession = {
      id: this.data.sequences.taskExecutionSessions,
      taskId,
      userId,
      startedAt: now,
      status: 'RUNNING',
      createdAt: now
    };

    this.data.taskExecutionSessions.push(newSession);

    // Update task status to IN_PROGRESS
    task.status = 'IN_PROGRESS';
    task.updatedAt = now;

    this.save();
    return newSession;
  }

  stopSession(sessionId: number, userId: number): TaskExecutionSession {
    const session = this.data.taskExecutionSessions.find(s => s.id === sessionId && s.userId === userId);
    if (!session) {
      throw new Error('Session not found.');
    }
    if (session.status !== 'RUNNING') {
      throw new Error('Session is not running.');
    }

    const now = new Date().toISOString();
    const duration = Math.max(0, Math.round((new Date(now).getTime() - new Date(session.startedAt).getTime()) / 1000));

    session.endedAt = now;
    session.durationSeconds = duration;
    session.status = 'COMPLETED';

    // Set task to IN_PROGRESS so user can continue focusing or mark DONE manually
    // This maintains flexible control for the user
    this.save();
    return session;
  }

  // --- Daily Report APIs ---
  getDailyReport(userId: number, dateStr: string): DailyReport | undefined {
    return this.data.dailyReports.find(r => r.userId === userId && r.reportDate === dateStr);
  }

  saveDailyReport(userId: number, dateStr: string, content: string): DailyReport {
    const now = new Date().toISOString();
    let r = this.getDailyReport(userId, dateStr);
    if (r) {
      r.content = content;
      r.updatedAt = now;
    } else {
      this.data.sequences.dailyReports += 1;
      r = {
        id: this.data.sequences.dailyReports,
        userId,
        reportDate: dateStr,
        content,
        generatorType: 'RULE_BASED',
        createdAt: now,
        updatedAt: now
      };
      this.data.dailyReports.push(r);
    }
    this.save();
    return r;
  }

  // --- Weekly Review APIs ---
  getWeeklyReview(userId: number, weekStartDateStr: string): WeeklyReview | undefined {
    return this.data.weeklyReviews.find(w => w.userId === userId && w.weekStartDate === weekStartDateStr);
  }

  saveWeeklyReview(userId: number, weekStartDateStr: string, weekEndDateStr: string, content: string): WeeklyReview {
    const now = new Date().toISOString();
    let w = this.getWeeklyReview(userId, weekStartDateStr);
    if (w) {
      w.content = content;
      w.updatedAt = now;
    } else {
      this.data.sequences.weeklyReviews += 1;
      w = {
        id: this.data.sequences.weeklyReviews,
        userId,
        weekStartDate: weekStartDateStr,
        weekEndDate: weekEndDateStr,
        content,
        generatorType: 'RULE_BASED',
        createdAt: now,
        updatedAt: now
      };
      this.data.weeklyReviews.push(w);
    }
    this.save();
    return w;
  }
}

export const db = new LocalDB();
