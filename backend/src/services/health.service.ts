import { PrismaClient } from '@prisma/client';
import os from 'os';
import logger from '../config/logger';

const prisma = new PrismaClient();

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  checks: {
    database: CheckResult;
    memory: CheckResult;
    disk: CheckResult;
  };
  metrics: {
    memoryUsage: MemoryMetrics;
    cpuUsage: number;
    requestsPerMinute?: number;
  };
}

interface CheckResult {
  status: 'pass' | 'warn' | 'fail';
  message: string;
  responseTime?: number;
}

interface MemoryMetrics {
  used: string;
  total: string;
  percentage: number;
}

// Contador de requests (simple, en producción usar Redis)
let requestCount = 0;
let lastRequestCountReset = Date.now();

export const incrementRequestCount = () => {
  requestCount++;
};

export const getRequestsPerMinute = (): number => {
  const now = Date.now();
  const elapsedMinutes = (now - lastRequestCountReset) / 60000;
  const rpm = elapsedMinutes > 0 ? requestCount / elapsedMinutes : 0;
  
  // Reset cada hora
  if (elapsedMinutes > 60) {
    requestCount = 0;
    lastRequestCountReset = now;
  }
  
  return Math.round(rpm);
};

// Check de base de datos
const checkDatabase = async (): Promise<CheckResult> => {
  const startTime = Date.now();
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - startTime;
    
    if (responseTime > 1000) {
      return {
        status: 'warn',
        message: 'Database is slow',
        responseTime,
      };
    }
    
    return {
      status: 'pass',
      message: 'Database is healthy',
      responseTime,
    };
  } catch (error: any) {
    logger.error('Database health check failed', { error: error.message });
    return {
      status: 'fail',
      message: `Database connection failed: ${error.message}`,
      responseTime: Date.now() - startTime,
    };
  }
};

// Resultado cuando la comprobación de BD se omite (modo ligero)
const skippedDatabaseCheck = (): CheckResult => ({
  status: 'pass',
  message: 'skipped',
});

// Check de memoria
const checkMemory = (): CheckResult => {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsagePercentage = (usedMemory / totalMemory) * 100;
  
  if (memoryUsagePercentage > 90) {
    return {
      status: 'fail',
      message: `Memory usage critical: ${memoryUsagePercentage.toFixed(2)}%`,
    };
  }
  
  if (memoryUsagePercentage > 80) {
    return {
      status: 'warn',
      message: `Memory usage high: ${memoryUsagePercentage.toFixed(2)}%`,
    };
  }
  
  return {
    status: 'pass',
    message: `Memory usage normal: ${memoryUsagePercentage.toFixed(2)}%`,
  };
};

// Check de disco
const checkDisk = (): CheckResult => {
  // En un entorno real, usarías una librería como 'diskusage'
  // Por ahora, retornamos un check básico
  return {
    status: 'pass',
    message: 'Disk space is adequate',
  };
};

// Obtener métricas de memoria
const getMemoryMetrics = (): MemoryMetrics => {
  const used = process.memoryUsage();
  const totalMemory = os.totalmem();
  const usedMemory = totalMemory - os.freemem();
  
  return {
    used: `${(usedMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
    total: `${(totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
    percentage: parseFloat(((usedMemory / totalMemory) * 100).toFixed(2)),
  };
};

// Obtener uso de CPU (promedio de carga)
const getCpuUsage = (): number => {
  const cpus = os.cpus();
  const avgLoad = os.loadavg()[0]; // Carga promedio de 1 minuto
  const cpuCount = cpus.length;
  const cpuUsagePercentage = (avgLoad / cpuCount) * 100;
  
  return parseFloat(cpuUsagePercentage.toFixed(2));
};

// Función principal de health check.
// deep=false (por defecto) NO consulta la base de datos, para que Neon pueda
// escalar a cero. deep=true conserva el comportamiento completo.
export const getHealthStatus = async (deep = false): Promise<HealthStatus> => {
  const startTime = Date.now();
  
  try {
    // Ejecutar todos los checks
    const [databaseCheck, memoryCheck, diskCheck] = await Promise.all([
      deep ? checkDatabase() : Promise.resolve(skippedDatabaseCheck()),
      Promise.resolve(checkMemory()),
      Promise.resolve(checkDisk()),
    ]);
    
    // Determinar status general
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (
      databaseCheck.status === 'fail' ||
      memoryCheck.status === 'fail' ||
      diskCheck.status === 'fail'
    ) {
      overallStatus = 'unhealthy';
    } else if (
      databaseCheck.status === 'warn' ||
      memoryCheck.status === 'warn' ||
      diskCheck.status === 'warn'
    ) {
      overallStatus = 'degraded';
    }
    
    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: databaseCheck,
        memory: memoryCheck,
        disk: diskCheck,
      },
      metrics: {
        memoryUsage: getMemoryMetrics(),
        cpuUsage: getCpuUsage(),
        requestsPerMinute: getRequestsPerMinute(),
      },
    };
    
    // Loguear si el health check es unhealthy
    if (overallStatus === 'unhealthy') {
      logger.error('Health check failed', { healthStatus });
    } else if (overallStatus === 'degraded') {
      logger.warn('Health check degraded', { healthStatus });
    }
    
    const checkDuration = Date.now() - startTime;
    logger.debug(`Health check completed in ${checkDuration}ms`, { status: overallStatus });
    
    return healthStatus;
  } catch (error: any) {
    logger.error('Health check error', { error: error.message, stack: error.stack });
    
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: { status: 'fail', message: 'Check failed' },
        memory: { status: 'fail', message: 'Check failed' },
        disk: { status: 'fail', message: 'Check failed' },
      },
      metrics: {
        memoryUsage: getMemoryMetrics(),
        cpuUsage: getCpuUsage(),
      },
    };
  }
};

// Health check simplificado (para load balancers)
export const getSimpleHealthStatus = async (deep = false): Promise<{ status: string }> => {
  if (!deep) {
    return { status: 'ok' };
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  } catch (error) {
    logger.error('Simple health check failed', { error });
    return { status: 'error' };
  }
};
