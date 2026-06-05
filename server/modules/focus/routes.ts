import {Router} from 'express';

import {handleHttpError} from '../../shared/http/handleHttpError';
import {parseSessionId, parseTaskId} from './schemas';
import {FocusService} from './service';

const DEMO_USER_ID = 1;

export function buildFocusRoutes(service: FocusService): Router {
  const router = Router();

  router.get('/task-sessions', (req, res) => {
    try {
      const date = typeof req.query.date === 'string' ? req.query.date : undefined;
      res.json(service.listByDate(DEMO_USER_ID, date));
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.get('/task-sessions/running', (_req, res) => {
    try {
      res.json({session: service.getRunning(DEMO_USER_ID)});
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.post('/tasks/:taskId/sessions/start', (req, res) => {
    try {
      const taskId = parseTaskId(req.params.taskId);
      const session = service.start({taskId, userId: DEMO_USER_ID});
      res.status(201).json(session);
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.post('/task-sessions/:sessionId/stop', (req, res) => {
    try {
      const sessionId = parseSessionId(req.params.sessionId);
      res.json(service.stop({sessionId, userId: DEMO_USER_ID}));
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.post('/task-sessions/:sessionId/pause', (req, res) => {
    try {
      const sessionId = parseSessionId(req.params.sessionId);
      res.json(service.pause({sessionId, userId: DEMO_USER_ID}));
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.post('/task-sessions/:sessionId/resume', (req, res) => {
    try {
      const sessionId = parseSessionId(req.params.sessionId);
      res.json(service.resume({sessionId, userId: DEMO_USER_ID}));
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.get('/tasks/:taskId/sessions', (req, res) => {
    try {
      const taskId = parseTaskId(req.params.taskId);
      res.json(service.listByTask(taskId, DEMO_USER_ID));
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  return router;
}
