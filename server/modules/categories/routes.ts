import {Router} from 'express';

import {handleHttpError} from '../../shared/http/handleHttpError';
import {getUserContext} from '../../shared/http/userContext';
import {parseCategoryBody, parseCategoryId} from './schemas';
import {CategoriesService} from './service';

export function buildCategoryRoutes(service: CategoriesService): Router {
  const router = Router();

  router.get('/categories', (_req, res) => {
    try {
      const {userId} = getUserContext();
      res.json(service.list(userId));
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.post('/categories', (req, res) => {
    try {
      const {userId} = getUserContext();
      const body = parseCategoryBody(req.body);
      const category = service.create({
        userId,
        ...body,
      });
      res.status(201).json(category);
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.put('/categories/:id', (req, res) => {
    try {
      const {userId} = getUserContext();
      const id = parseCategoryId(req.params.id);
      const body = parseCategoryBody(req.body);
      const category = service.update({
        id,
        userId,
        ...body,
      });
      res.json(category);
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  router.delete('/categories/:id', (req, res) => {
    try {
      const {userId} = getUserContext();
      const id = parseCategoryId(req.params.id);
      res.json(service.remove(id, userId));
    } catch (error) {
      handleHttpError(res, error);
    }
  });

  return router;
}
