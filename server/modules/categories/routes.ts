import {Router} from 'express';

import {handleHttpError} from '../../shared/http/handleHttpError';
import {parseCategoryBody, parseCategoryId} from './schemas';
import {CategoriesService} from './service';

const DEMO_USER_ID = 1;

export function buildCategoryRoutes(service: CategoriesService): Router {
  const router = Router();

  router.get('/categories', (_req, res) => {
    try {
      res.json(service.list(DEMO_USER_ID));
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.post('/categories', (req, res) => {
    try {
      const body = parseCategoryBody(req.body);
      const category = service.create({
        userId: DEMO_USER_ID,
        ...body,
      });
      res.status(201).json(category);
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.put('/categories/:id', (req, res) => {
    try {
      const id = parseCategoryId(req.params.id);
      const body = parseCategoryBody(req.body);
      const category = service.update({
        id,
        userId: DEMO_USER_ID,
        ...body,
      });
      res.json(category);
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.delete('/categories/:id', (req, res) => {
    try {
      const id = parseCategoryId(req.params.id);
      res.json(service.remove(id, DEMO_USER_ID));
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  return router;
}

