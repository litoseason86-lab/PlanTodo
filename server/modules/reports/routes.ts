import {Router} from 'express';

import {handleHttpError} from '../../shared/http/handleHttpError';
import {getUserContext} from '../../shared/http/userContext';
import {parseDailyBodyDate, parseDailyDate, parseWeekStart} from './schemas';
import {ReportsService} from './service';

export function buildReportRoutes(service: ReportsService): Router {
  const router = Router();

  router.get('/daily-reports', (req, res) => {
    try {
      const {userId} = getUserContext();
      const date = parseDailyDate(req.query.date);
      res.json(service.getDaily(userId, date));
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.post('/daily-reports/generate', (req, res) => {
    try {
      const {userId} = getUserContext();
      const date = parseDailyBodyDate((req.body as Record<string, unknown>)?.date);
      res.json(service.generateDaily(userId, date));
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.get('/weekly-reviews', (req, res) => {
    try {
      const {userId} = getUserContext();
      const weekStart = parseWeekStart(req.query.weekStart, 'query');
      res.json(service.getWeekly(userId, weekStart));
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.post('/weekly-reviews/generate', (req, res) => {
    try {
      const {userId} = getUserContext();
      const weekStart = parseWeekStart((req.body as Record<string, unknown>)?.weekStart, 'body');
      res.json(service.generateWeekly(userId, weekStart));
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  return router;
}
