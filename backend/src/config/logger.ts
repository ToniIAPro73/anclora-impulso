import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { redactText } from '../utils/redact';

// Definir niveles de log personalizados
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Definir colores para cada nivel
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// Formato para logs en consola (desarrollo)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `[${timestamp}] ${level}: ${message} ${metaString}`;
  })
);

// Formato para logs en archivos (producción)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Directorio de logs
const logsDir = path.join(__dirname, '../../logs');

// Transporte para logs de errores (rotación diaria)
const errorFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxFiles: '30d', // Mantener logs por 30 días
  maxSize: '20m', // Rotar cuando el archivo alcance 20MB
  format: fileFormat,
});

// Transporte para logs combinados (rotación diaria)
const combinedFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxFiles: '14d', // Mantener logs por 14 días
  maxSize: '20m',
  format: fileFormat,
});

// Transporte para logs HTTP (rotación diaria)
const httpFileTransport = new DailyRotateFile({
  filename: path.join(logsDir, 'http-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'http',
  maxFiles: '7d', // Mantener logs por 7 días
  maxSize: '20m',
  format: fileFormat,
});

// Crear el logger
const logger = winston.createLogger({
  levels,
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transports: [
    // Logs de errores
    errorFileTransport,
    // Logs combinados
    combinedFileTransport,
    // Logs HTTP
    httpFileTransport,
  ],
  // Manejo de excepciones no capturadas
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      format: fileFormat,
    }),
  ],
  // Manejo de rechazos de promesas no capturadas
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, 'rejections-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      format: fileFormat,
    }),
  ],
});

// En desarrollo, también loguear a consola
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// Función helper para loguear con contexto
export const logWithContext = (level: string, message: string, context?: any) => {
  logger.log(level, message, context);
};

// Función helper para loguear errores con stack trace
export const logError = (error: Error, context?: any) => {
  // Error text may embed URLs/tokens (provider errors, DB errors): redact free text as well as context.
  logger.error(redactText(error.message), {
    stack: redactText(error.stack),
    ...context,
  });
};

// Función helper para loguear requests HTTP
export const logHttpRequest = (req: any, res: any, responseTime: number) => {
  logger.http('HTTP Request', {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: req.get('user-agent'),
    ip: req.ip,
    userId: req.user?.id,
  });
};

export default logger;
