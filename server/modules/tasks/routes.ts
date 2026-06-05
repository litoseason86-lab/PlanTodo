import {Router} from 'express';

import {handleHttpError} from '../../shared/http/handleHttpError';
import {
  parseTaskBody,
  parseTaskId,
  parseTaskQuery,
  parseTaskStatusBody,
} from './schemas';
import {TasksService} from './service';

const DEMO_USER_ID = 1;

export function buildTaskRoutes(service: TasksService): Router {
  const router = Router();

  router.get('/tasks', (req, res) => {
    try {
      const query = parseTaskQuery(req.query as Record<string, unknown>);
      res.json(service.list({userId: DEMO_USER_ID, ...query}));
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.post('/tasks', (req, res) => {
    try {
      const body = parseTaskBody(req.body);
      const task = service.create({
        userId: DEMO_USER_ID,
        ...body,
      });
      res.status(201).json(task);
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.patch('/tasks/:id/status', (req, res) => {
    try {
      const id = parseTaskId(req.params.id);
      const body = parseTaskStatusBody(req.body);
      const task = service.updateStatus(id, DEMO_USER_ID, body.status);
      res.json(task);
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.delete('/tasks/:id', (req, res) => {
    try {
      const id = parseTaskId(req.params.id);
      service.delete(id, DEMO_USER_ID);
      res.status(204).send();
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  return router;
}
