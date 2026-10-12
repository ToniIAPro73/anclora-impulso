import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import logger, { logError } from '../config/logger';
import { redactSensitive, redactText, stripQueryString } from '../utils/redact';

/**
 * Clase de error personalizado
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true,
    public details?: Record<string, unknown>
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Middleware global de manejo de errores
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // The OAuth handoff exchange carries a one-time code and a verifier in its BODY: that body is never logged, whatever
  // the key names are (structural redaction is only a second line of defence, never proof of absence).
  const omitBody = (req.originalUrl ?? req.url ?? '').startsWith('/api/auth/oauth/');

  // Contexto del error
  const errorContext = {
    method: req.method,
    url: stripQueryString(req.url),
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: (req as any).user?.id,
    body: omitBody ? '[omitted]' : redactSensitive(req.body),
    params: redactSensitive(req.params),
    query: redactSensitive(req.query),
  };

  // Loguear el error
  logError(err, errorContext);

  // Error personalizado de la aplicación
  if (err instanceof AppError) {
    const retryAfter = err.details?.retryAfterSeconds;
    if (typeof retryAfter === 'number') {
      res.setHeader('Retry-After', String(retryAfter));
    }
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ?? {}),
    });
    return;
  }

  // Errores de Prisma
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Violación de constraint único
    if (err.code === 'P2002') {
      res.status(409).json({
        error: 'Ya existe un registro con esos datos',
      });
      return;
    }

    // Registro no encontrado
    if (err.code === 'P2025') {
      res.status(404).json({
        error: 'Registro no encontrado',
      });
      return;
    }

    // Foreign key constraint failed
    if (err.code === 'P2003') {
      res.status(400).json({
        error: 'Referencia inválida',
      });
      return;
    }
  }

  // Error de validación de Prisma
  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      error: 'Datos inválidos',
    });
    return;
  }

  // Error genérico
  res.status(500).json({
    error: process.env.NODE_ENV === 'development' 
      ? err.message 
      : 'Error interno del servidor',
  });
}

/**
 * Middleware para rutas no encontradas
 */
export function notFoundHandler(req: Request, res: Response): void {
  logger.warn('Route not found', {
    method: req.method,
    url: stripQueryString(req.originalUrl),
    ip: req.ip,
  });
  
  res.status(404).json({
    error: 'Ruta no encontrada',
  });
}
