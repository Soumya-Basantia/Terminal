import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', err.message, err.stack);

  // Prisma errors
  if (err.message?.includes('Unique constraint')) {
    res.status(409).json({ 
      error: 'Already exists', 
      message: process.env.NODE_ENV === 'development' ? err.message : 'A conflicting record already exists' 
    });
    return;
  }

  if (err.message?.includes('Record to update not found')) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
}
