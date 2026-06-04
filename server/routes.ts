import { Router, Request, Response, NextFunction } from 'express';
import { db } from './db';
import { generateDailyReportContent, generateWeeklyReviewContent } from './reports';

const router = Router();
const DEMO_USER_ID = 1; // Fixed demo user context

// Helper to log errors & respond cleanly
function handleControllerError(res: Response, err: unknown, status = 500) {
  console.error('API Error:', err);
  const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
  res.status(status).json({ status, message: msg });
}

// ==========================================
// 1. CATEGORY MANAGEMENT API
// ==========================================

// GET /api/categories
router.get('/categories', (req: Request, res: Response) => {
  try {
    const list = db.getCategories(DEMO_USER_ID);
    res.json(list);
  } catch (err) {
    handleControllerError(res, err);
  }
});

// POST /api/categories
router.post('/categories', (req: Request, res: Response) => {
  try {
    const { name, color, sortOrder } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ status: 400, message: 'Category name is required and cannot be blank.' });
    }

    if (db.existsCategoryByName(DEMO_USER_ID, name)) {
      return res.status(409).json({ status: 409, message: `Category "${name.trim()}" already exists.` });
    }

    const newCat = db.createCategory(
      DEMO_USER_ID, 
      name, 
      color || '#64748b', 
      typeof sortOrder === 'number' ? sortOrder : 0
    );
    res.status(210).json(newCat); // 210/201 Success
  } catch (err) {
    handleControllerError(res, err);
  }
});

// PUT /api/categories/:id
router.put('/categories/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, color, sortOrder } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ status: 400, message: 'Invalid category ID' });
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ status: 400, message: 'Category name is required' });
    }

    // Check if another category has the same name
    const existing = db.getCategories(DEMO_USER_ID).find(
      c => c.name.trim().toLowerCase() === name.trim().toLowerCase() && c.id !== id
    );
    if (existing) {
      return res.status(409).json({ status: 409, message: `Another category with name "${name.trim()}" already exists.` });
    }

    const updated = db.updateCategory(
      id,
      DEMO_USER_ID,
      name,
      color,
      typeof sortOrder === 'number' ? sortOrder : 0
    );

    if (!updated) {
      return res.status(404).json({ status: 404, message: 'Category not found' });
    }

    res.json(updated);
  } catch (err) {
    handleControllerError(res, err);
  }
});

// DELETE /api/categories/:id
router.delete('/categories/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ status: 400, message: 'Invalid category ID' });
    }

    // Attempt delete (db.deleteCategory throws if in use)
    db.deleteCategory(id, DEMO_USER_ID);
    res.json({ success: true, message: 'Category deleted successfully.' });
  } catch (err) {
    // If it's the "in use" error, reject with 409 Conflict
    const errMsg = err instanceof Error ? err.message : '';
    if (errMsg.includes('referencing')) {
      return res.status(409).json({ status: 409, message: errMsg });
    }
    handleControllerError(res, err, 400);
  }
});


// ==========================================
// 2. TASK MANAGEMENT API
// ==========================================

// GET /api/tasks
router.get('/tasks', (req: Request, res: Response) => {
  try {
    const { date, status, categoryId } = req.query;
    
    const catId = categoryId ? parseInt(categoryId as string, 10) : undefined;
    const tasks = db.getTasks(
      DEMO_USER_ID,
      typeof date === 'string' ? date : undefined,
      typeof status === 'string' ? status : undefined,
      catId && !isNaN(catId) ? catId : undefined
    );
    res.json(tasks);
  } catch (err) {
    handleControllerError(res, err);
  }
});

// POST /api/tasks
router.post('/tasks', (req: Request, res: Response) => {
  try {
    const { title, categoryId, plannedDate } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ status: 400, message: 'Task title is required' });
    }

    const catId = parseInt(categoryId, 10);
    if (isNaN(catId)) {
      return res.status(400).json({ status: 400, message: 'Valid categoryId is required' });
    }

    const cat = db.getCategoryByIdAndUserId(catId, DEMO_USER_ID);
    if (!cat) {
      return res.status(404).json({ status: 404, message: 'Category not found' });
    }

    const dateStr = typeof plannedDate === 'string' ? plannedDate : new Date().toISOString().slice(0, 10);

    const newTask = db.createTask(DEMO_USER_ID, catId, title, dateStr);
    res.status(201).json(newTask);
  } catch (err) {
    handleControllerError(res, err);
  }
});

// PATCH /api/tasks/:id/status
router.patch('/tasks/:id/status', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ status: 400, message: 'Invalid task ID' });
    }

    const validStatuses = ['TODO', 'IN_PROGRESS', 'DONE', 'NOT_DONE'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ status: 400, message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const updated = db.updateTaskStatus(id, DEMO_USER_ID, status as any);
    if (!updated) {
      return res.status(404).json({ status: 404, message: 'Task not found' });
    }

    res.json(updated);
  } catch (err) {
    handleControllerError(res, err);
  }
});


// ==========================================
// 3. TASK EXECUTION SESSIONS (TIMING) API
// ==========================================

// GET /api/task-sessions
router.get('/task-sessions', (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    if (typeof date === 'string') {
      const startOfDay = `${date}T00:00:00.000Z`;
      const endOfDay = `${date}T23:59:59.999Z`;
      const list = db.getSessionsByDateRange(DEMO_USER_ID, startOfDay, endOfDay);
      return res.json(list);
    }
    res.json([]);
  } catch (err) {
    handleControllerError(res, err);
  }
});

// GET /api/task-sessions/running
router.get('/task-sessions/running', (req: Request, res: Response) => {
  try {
    const active = db.getRunningSession(DEMO_USER_ID);
    if (!active) {
      return res.json({ session: null });
    }

    // Enrich active session with task info for frontend state
    const task = db.getTaskByIdAndUserId(active.taskId, DEMO_USER_ID);
    res.json({
      session: {
        ...active,
        taskTitle: task ? task.title : '未知任务'
      }
    });
  } catch (err) {
    handleControllerError(res, err);
  }
});

// POST /api/tasks/:taskId/sessions/start
router.post('/tasks/:taskId/sessions/start', (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId)) {
      return res.status(400).json({ status: 400, message: 'Invalid task ID' });
    }

    const session = db.startSession(taskId, DEMO_USER_ID);
    res.status(201).json(session);
  } catch (err) {
    // Already running or other errors throw 409 conflict/400
    const msg = err instanceof Error ? err.message : '';
    const status = msg.includes('running') ? 409 : 400;
    handleControllerError(res, err, status);
  }
});

// POST /api/task-sessions/:sessionId/stop
router.post('/task-sessions/:sessionId/stop', (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.sessionId, 10);
    if (isNaN(sessionId)) {
      return res.status(400).json({ status: 400, message: 'Invalid session ID' });
    }

    const endedSession = db.stopSession(sessionId, DEMO_USER_ID);
    res.json(endedSession);
  } catch (err) {
    handleControllerError(res, err, 400);
  }
});

// GET /api/tasks/:taskId/sessions
router.get('/tasks/:taskId/sessions', (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId, 10);
    if (isNaN(taskId)) {
      return res.status(400).json({ status: 400, message: 'Invalid task ID' });
    }

    const list = db.getSessionsByTask(taskId, DEMO_USER_ID);
    res.json(list);
  } catch (err) {
    handleControllerError(res, err);
  }
});


// ==========================================
// 4. REPORTS GENERATOR API
// ==========================================

// GET /api/daily-reports?date=YYYY-MM-DD
router.get('/daily-reports', (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    if (!date || typeof date !== 'string') {
      return res.status(400).json({ status: 400, message: 'Query parameter "date" (YYYY-MM-DD) is required.' });
    }

    const report = db.getDailyReport(DEMO_USER_ID, date);
    if (!report) {
      return res.status(404).json({ status: 404, message: 'No daily report found for this date. Please generate one first.' });
    }
    res.json(report);
  } catch (err) {
    handleControllerError(res, err);
  }
});

// POST /api/daily-reports/generate
router.post('/daily-reports/generate', (req: Request, res: Response) => {
  try {
    const { date } = req.body;
    if (!date || typeof date !== 'string') {
      return res.status(400).json({ status: 400, message: 'Body parameter "date" (YYYY-MM-DD) is required.' });
    }

    const content = generateDailyReportContent(DEMO_USER_ID, date);
    const report = db.saveDailyReport(DEMO_USER_ID, date, content);
    res.json(report);
  } catch (err) {
    handleControllerError(res, err);
  }
});

// GET /api/weekly-reviews?weekStart=YYYY-MM-DD
router.get('/weekly-reviews', (req: Request, res: Response) => {
  try {
    const { weekStart } = req.query;
    if (!weekStart || typeof weekStart !== 'string') {
      return res.status(400).json({ status: 400, message: 'Query parameter "weekStart" (YYYY-MM-DD) is required.' });
    }

    const review = db.getWeeklyReview(DEMO_USER_ID, weekStart);
    if (!review) {
      return res.status(404).json({ status: 404, message: 'No weekly review found for this week. Please generate one first.' });
    }
    res.json(review);
  } catch (err) {
    handleControllerError(res, err);
  }
});

// POST /api/weekly-reviews/generate
router.post('/weekly-reviews/generate', (req: Request, res: Response) => {
  try {
    const { weekStart } = req.body;
    if (!weekStart || typeof weekStart !== 'string') {
      return res.status(400).json({ status: 400, message: 'Body parameter "weekStart" (YYYY-MM-DD) is required.' });
    }

    // Validate date format and calculate end date
    const d = new Date(weekStart);
    if (isNaN(d.getTime())) {
      return res.status(400).json({ status: 400, message: 'Invalid weekStart date format' });
    }

    const weekEnd = new Date(d.getTime() + 6 * 24 * 60 * 60 * 1000);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    const content = generateWeeklyReviewContent(DEMO_USER_ID, weekStart);
    const review = db.saveWeeklyReview(DEMO_USER_ID, weekStart, weekEndStr, content);
    res.json(review);
  } catch (err) {
    handleControllerError(res, err);
  }
});

export const apiRouter = router;
