import type {Category} from '../../../shared/domain/entities';

export interface CreateCategoryInput {
  userId: number;
  name: string;
  color: string;
  sortOrder: number;
}

export interface UpdateCategoryInput extends CreateCategoryInput {
  id: number;
}

export interface CategoryRepository {
  listByUser(userId: number): Category[];
  getById(id: number, userId: number): Category | undefined;
  existsByName(userId: number, name: string): boolean;
  create(input: CreateCategoryInput): Category;
  update(input: UpdateCategoryInput): Category | undefined;
  remove(id: number, userId: number): boolean;
}

