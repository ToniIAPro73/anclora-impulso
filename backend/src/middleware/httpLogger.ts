import morgan from 'morgan';
import logger from '../config/logger';
import { stripQueryString } from '../utils/redact';

// Stream personalizado para enviar logs de Morgan a Winston
const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Formato personalizado de Morgan
morgan.token('safe-url', (req: any) => stripQueryString(req.originalUrl || req.url));

morgan.token('user-id', (req: any) => {
  return req.user?.userId || 'anonymous';
});

morgan.token('response-time-ms', (req: any, res: any) => {
  const responseTime = res.getHeader('X-Response-Time');
  return responseTime ? `${responseTime}ms` : '-';
});

// Formato detallado para desarrollo
const devFormat = ':method :safe-url :status :response-time ms - :res[content-length] - user: :user-id';

// Formato JSON para producción
const prodFormat = JSON.stringify({
  method: ':method',
  url: ':safe-url',
  status: ':status',
  responseTime: ':response-time',
  contentLength: ':res[content-length]',
  userId: ':user-id',
  userAgent: ':user-agent',
  ip: ':remote-addr',
});

// Middleware de Morgan
export const httpLogger = morgan(
  process.env.NODE_ENV === 'production' ? prodFormat : devFormat,
  {
    stream,
    // No loguear requests a /health (para evitar spam)
    skip: (req) => req.url === '/health',
  }
);

// Middleware para agregar tiempo de respuesta
export const responseTimeLogger = (req: any, res: any, next: any) => {
  const startTime = Date.now();

  // Interceptar el método res.end para calcular tiempo de respuesta
  const originalEnd = res.end;
  res.end = function (...args: any[]) {
    const responseTime = Date.now() - startTime;
    res.setHeader('X-Response-Time', responseTime);
    
    // Loguear requests lentos (> 1 segundo)
    if (responseTime > 1000) {
      logger.warn('Slow request detected', {
        method: req.method,
        url: stripQueryString(req.url),
        responseTime: `${responseTime}ms`,
        userId: req.user?.userId,
      });
    }

    originalEnd.apply(res, args);
  };

  next();
};
