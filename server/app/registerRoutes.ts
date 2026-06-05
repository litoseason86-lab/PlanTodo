import path from 'node:path';

import {Router} from 'express';

import {CategoryJsonRepository} from '../storage/json/repositories/categoryJsonRepository';
import {FocusSessionJsonRepository} from '../storage/json/repositories/focusSessionJsonRepository';
import {TaskJsonRepository} from '../storage/json/repositories/taskJsonRepository';
import {JsonFileStore} from '../storage/json/fileStore';
import {buildCategoryRoutes} from '../modules/categories/routes';
import {CategoriesService} from '../modules/categories/service';
import {buildTaskRoutes} from '../modules/tasks/routes';
import {TasksService} from '../modules/tasks/service';

export function registerRoutes(): Router {
  const router = Router();
  const store = new JsonFileStore(path.resolve('data/db.json'));
  const categories = new CategoryJsonRepository(store);
  const tasks = new TaskJsonRepository(store);
  const focusSessions = new FocusSessionJsonRepository(store);

  const categoriesService = new CategoriesService(categories, tasks);
  const tasksService = new TasksService(tasks, categories, focusSessions);

  router.use(buildCategoryRoutes(categoriesService));
  router.use(buildTaskRoutes(tasksService));

  return router;
}

