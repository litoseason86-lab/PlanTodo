import {AppError} from '../../shared/errors/appError';

export interface NormalizedTagName {
  name: string;
  normalizedName: string;
}

export function normalizeTagName(value: string): NormalizedTagName {
  const name = value.trim().replace(/\s+/gu, ' ');
  if (!name) {
    throw new AppError(400, 'Tag name is required');
  }
  if (name.length > 32) {
    throw new AppError(400, 'Tag name must be at most 32 characters');
  }
  return {name, normalizedName: name.toLowerCase()};
}

export function parseTagId(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new AppError(400, 'Invalid tag ID');
  }
  const id = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(id)) {
    throw new AppError(400, 'Invalid tag ID');
  }
  return id;
}

export function parseTagBody(body: unknown): NormalizedTagName {
  const payload = (body ?? {}) as Record<string, unknown>;
  if (typeof payload.name !== 'string') {
    throw new AppError(400, 'Tag name is required');
  }
  return normalizeTagName(payload.name);
}
