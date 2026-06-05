import type {TaskRepository} from '../tasks/repository';
import {AppError} from '../../shared/errors/appError';
import type {
  CategoryRepository,
  CreateCategoryInput,
  UpdateCategoryInput,
} from './repository';

export class CategoriesService {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly tasks: Pick<TaskRepository, 'listByFilters'>,
  ) {}

  list(userId: number) {
    return this.categories.listByUser(userId);
  }

  create(input: CreateCategoryInput) {
    const name = input.name.trim();
    if (!name) {
      throw new AppError(400, 'Category name is required and cannot be blank.');
    }
    if (this.categories.existsByName(input.userId, name)) {
      throw new AppError(409, `Category "${name}" already exists.`);
    }

    return this.categories.create({
      ...input,
      name,
      color: input.color || '#64748b',
      sortOrder: input.sortOrder,
    });
  }

  update(input: UpdateCategoryInput) {
    const name = input.name.trim();
    if (!name) {
      throw new AppError(400, 'Category name is required');
    }

    const existing = this.categories
      .listByUser(input.userId)
      .find((category) => category.id !== input.id && category.name.trim().toLowerCase() === name.toLowerCase());
    if (existing) {
      throw new AppError(409, `Another category with name "${name}" already exists.`);
    }

    const updated = this.categories.update({
      ...input,
      name,
      color: input.color || '#64748b',
    });
    if (!updated) {
      throw new AppError(404, 'Category not found');
    }

    return updated;
  }

  remove(id: number, userId: number) {
    const referencedTasks = this.tasks.listByFilters({userId, categoryId: id});
    if (referencedTasks.length > 0) {
      throw new AppError(409, 'Cannot delete category: Tasks are currently referencing it.');
    }

    const removed = this.categories.remove(id, userId);
    if (!removed) {
      throw new AppError(404, 'Category not found');
    }

    return {
      success: true,
      message: 'Category deleted successfully.',
    };
  }
}

