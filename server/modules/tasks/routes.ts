import {Router} from 'express';

import {handleHttpError} from '../../shared/http/handleHttpError';
import {getUserContext} from '../../shared/http/userContext';
import {
  parseBatchScheduleBody,
  parseBatchUnscheduleBody,
  parseTaskBody,
  parseTaskId,
  parseTaskQuery,
  parseTaskScheduleBody,
  parseTaskStatusBody,
} from './schemas';
import {TasksService} from './service';

export function buildTaskRoutes(service: TasksService): Router {
  const router = Router();

  router.get('/tasks', (req, res) => {
    try {
      const {userId} = getUserContext();
      const query = parseTaskQuery(req.query as Record<string, unknown>);
      res.json(service.list({userId, ...query}));
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.post('/tasks', (req, res) => {
    try {
      const {userId} = getUserContext();
      const body = parseTaskBody(req.body);
      const task = service.create({
        userId,
        ...body,
      });
      res.status(201).json(task);
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.patch('/tasks/batch-schedule', (req, res) => {
    try {
      const {userId} = getUserContext();
      const body = parseBatchScheduleBody(req.body);
      res.json(service.batchScheduleDate({userId, ...body}));
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.patch('/tasks/batch-unschedule', (req, res) => {
    try {
      const {userId} = getUserContext();
      const body = parseBatchUnscheduleBody(req.body);
      res.json(service.batchUnschedule({userId, ...body}));
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.patch('/tasks/:id/status', (req, res) => {
    try {
      const {userId} = getUserContext();
      const id = parseTaskId(req.params.id);
      const body = parseTaskStatusBody(req.body);
      const task = service.updateStatus(id, userId, body.status);
      res.json(task);
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.patch('/tasks/:id/schedule', (req, res) => {
    try {
      const {userId} = getUserContext();
      const id = parseTaskId(req.params.id);
      const body = parseTaskScheduleBody(req.body);
      const task = service.updateSchedule({taskId: id, userId, ...body});
      res.json(task);
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.delete('/tasks/:id', (req, res) => {
    try {
      const {userId} = getUserContext();
      const id = parseTaskId(req.params.id);
      service.delete(id, userId);
      res.status(204).send();
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  return router;
}
