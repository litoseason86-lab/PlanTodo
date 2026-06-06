import {Router} from 'express';

import {handleHttpError} from '../../shared/http/handleHttpError';
import {getUserContext} from '../../shared/http/userContext';
import {parseSessionId, parseSessionQuery, parseTaskId} from './schemas';
import {FocusService} from './service';

export function buildFocusRoutes(service: FocusService): Router {
  const router = Router();

  router.get('/task-sessions', (req, res) => {
    try {
      const {userId} = getUserContext();
      const query = parseSessionQuery(req.query as Record<string, unknown>);
      if (query.dateFrom && query.dateTo) {
        res.json(service.listByDateRange(userId, query.dateFrom, query.dateTo));
        return;
      }
      res.json(service.listByDate(userId, query.date));
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.get('/task-sessions/running', (_req, res) => {
    try {
      const {userId} = getUserContext();
      res.json({session: service.getRunning(userId)});
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.post('/tasks/:taskId/sessions/start', (req, res) => {
    try {
      const {userId} = getUserContext();
      const taskId = parseTaskId(req.params.taskId);
      const session = service.start({taskId, userId});
      res.status(201).json(session);
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.post('/task-sessions/:sessionId/stop', (req, res) => {
    try {
      const {userId} = getUserContext();
      const sessionId = parseSessionId(req.params.sessionId);
      res.json(service.stop({sessionId, userId}));
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.post('/task-sessions/:sessionId/pause', (req, res) => {
    try {
      const {userId} = getUserContext();
      const sessionId = parseSessionId(req.params.sessionId);
      res.json(service.pause({sessionId, userId}));
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.post('/task-sessions/:sessionId/resume', (req, res) => {
    try {
      const {userId} = getUserContext();
      const sessionId = parseSessionId(req.params.sessionId);
      res.json(service.resume({sessionId, userId}));
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.get('/tasks/:taskId/sessions', (req, res) => {
    try {
      const {userId} = getUserContext();
      const taskId = parseTaskId(req.params.taskId);
      res.json(service.listByTask(taskId, userId));
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  return router;
}
