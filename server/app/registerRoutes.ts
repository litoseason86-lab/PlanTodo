import {Router} from 'express';

import {buildCategoryRoutes} from '../modules/categories/routes';
import {CategoriesService} from '../modules/categories/service';
import {buildFocusRoutes} from '../modules/focus/routes';
import {FocusService} from '../modules/focus/service';
import {buildReportRoutes} from '../modules/reports/routes';
import {ReportsService} from '../modules/reports/service';
import {buildTaskRoutes} from '../modules/tasks/routes';
import {TasksService} from '../modules/tasks/service';
import {createRepositoriesFromEnv} from '../storage/createRepositories';

export function registerRoutes(): Router {
  const router = Router();
  const repositories = createRepositoriesFromEnv();

  const categoriesService = new CategoriesService(repositories.categories, repositories.tasks);
  const tasksService = new TasksService(repositories.tasks, repositories.categories, repositories.focusSessions);
  const focusService = new FocusService(repositories.tasks, repositories.focusSessions);
  const reportsService = new ReportsService(
    repositories.reports,
    repositories.tasks,
    repositories.categories,
    repositories.focusSessions,
  );

  router.use(buildCategoryRoutes(categoriesService));
  router.use(buildTaskRoutes(tasksService));
  router.use(buildFocusRoutes(focusService));
  router.use(buildReportRoutes(reportsService));

  return router;
}
