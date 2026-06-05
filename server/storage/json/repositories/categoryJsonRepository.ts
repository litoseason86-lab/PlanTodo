import type {
  CategoryRepository,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../../../modules/categories/repository';
import type {Category} from '../../../../shared/domain/entities';
import {JsonFileStore} from '../fileStore';

export class CategoryJsonRepository implements CategoryRepository {
  constructor(private readonly store: JsonFileStore) {}

  listByUser(userId: number): Category[] {
    return this.store
      .read()
      .categories.filter((category) => category.userId === userId)
      .sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }
        return left.name.localeCompare(right.name);
      });
  }

  getById(id: number, userId: number): Category | undefined {
    return this.store
      .read()
      .categories.find((category) => category.id === id && category.userId === userId);
  }

  existsByName(userId: number, name: string): boolean {
    const normalizedName = name.trim().toLowerCase();
    return this.store.read().categories.some((category) => {
      return category.userId === userId && category.name.trim().toLowerCase() === normalizedName;
    });
  }

  create(input: CreateCategoryInput): Category {
    return this.store.update((data) => {
      data.sequences.categories += 1;
      const now = new Date().toISOString();
      const category: Category = {
        id: data.sequences.categories,
        userId: input.userId,
        name: input.name.trim(),
        color: input.color || '#64748b',
        sortOrder: input.sortOrder,
        createdAt: now,
        updatedAt: now,
      };
      data.categories.push(category);
      return category;
    });
  }

  update(input: UpdateCategoryInput): Category | undefined {
    return this.store.update((data) => {
      const category = data.categories.find((item) => {
        return item.id === input.id && item.userId === input.userId;
      });
      if (!category) {
        return undefined;
      }

      category.name = input.name.trim();
      category.color = input.color || '#64748b';
      category.sortOrder = input.sortOrder;
      category.updatedAt = new Date().toISOString();

      return category;
    });
  }

  remove(id: number, userId: number): boolean {
    return this.store.update((data) => {
      const index = data.categories.findIndex((item) => item.id === id && item.userId === userId);
      if (index === -1) {
        return false;
      }
      data.categories.splice(index, 1);
      return true;
    });
  }
}

