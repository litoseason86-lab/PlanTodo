import {AppError} from '../../shared/errors/appError';

export interface CategoryBody {
  name: string;
  color: string;
  sortOrder: number;
}

export function parseCategoryId(value: string): number {
  const id = Number.parseInt(value, 10);
  if (Number.isNaN(id)) {
    throw new AppError(400, 'Invalid category ID');
  }
  return id;
}

export function parseCategoryBody(body: unknown): CategoryBody {
  const payload = (body ?? {}) as Record<string, unknown>;

  return {
    name: typeof payload.name === 'string' ? payload.name : '',
    color: typeof payload.color === 'string' ? payload.color : '#64748b',
    sortOrder: typeof payload.sortOrder === 'number' ? payload.sortOrder : 0,
  };
}

