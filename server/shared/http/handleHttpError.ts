import type {Response} from 'express';

import {AppError} from '../errors/appError';

export function handleHttpError(res: Response, error: unknown): void {
  if (error instanceof AppError) {
    res.status(error.status).json({
      status: error.status,
      message: error.message,
    });
    return;
  }

  console.error('API Error:', error);
  res.status(500).json({
    status: 500,
    message: error instanceof Error ? error.message : 'An unexpected error occurred',
  });
}

