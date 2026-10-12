import os from 'os';
import fs from 'fs';
import path from 'path';
import { prisma } from '../config/database';

export interface SystemMetrics {
  timestamp: string;
  cpu: {
    usage: number;
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  process: {
    memory: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
    uptime: number;
    pid: number;
  };
  requests: {
    total: number;
    perMinute: number;
    perSecond: number;
  };
}

export interface DatabaseMetrics {
  responseTime: number;
  activeConnections: number;
  status: 'connected' | 'disconnected';
}

export interface LogStats {
  errors: number;
  warnings: number;
  info: number;
  http: number;
  total: number;
}

// Contadores globales
let totalRequests = 0;
let requestsLastMinute: number[] = [];
let requestsLastSecond: number[] = [];
let lastResetTime = Date.now();

export const incrementRequestCounter = () => {
  totalRequests++;
  const now = Date.now();
  
  // Agregar timestamp del request
  requestsLastMinute.push(now);
  requestsLastSecond.push(now);
  
  // Limpiar requests antiguos (> 1 minuto)
  const oneMinuteAgo = now - 60000;
  requestsLastMinute = requestsLastMinute.filter(t => t > oneMinuteAgo);
  
  // Limpiar requests antiguos (> 1 segundo)
  const oneSecondAgo = now - 1000;
  requestsLastSecond = requestsLastSecond.filter(t => t > oneSecondAgo);
};

export const getSystemMetrics = (): SystemMetrics => {
  const cpus = os.cpus();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  
  const processMemory = process.memoryUsage();
  
  return {
    timestamp: new Date().toISOString(),
    cpu: {
      usage: parseFloat((os.loadavg()[0] / cpus.length * 100).toFixed(2)),
      cores: cpus.length,
      loadAverage: os.loadavg().map(l => parseFloat(l.toFixed(2))),
    },
    memory: {
      total: totalMemory,
      used: usedMemory,
      free: freeMemory,
      percentage: parseFloat(((usedMemory / totalMemory) * 100).toFixed(2)),
    },
    process: {
      memory: {
        rss: processMemory.rss,
        heapTotal: processMemory.heapTotal,
        heapUsed: processMemory.heapUsed,
        external: processMemory.external,
      },
      uptime: process.uptime(),
      pid: process.pid,
    },
    requests: {
      total: totalRequests,
      perMinute: requestsLastMinute.length,
      perSecond: requestsLastSecond.length,
    },
  };
};

export const getDatabaseMetrics = async (): Promise<DatabaseMetrics> => {
  const startTime = Date.now();
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - startTime;
    
    // En producción, podrías obtener el número real de conexiones activas
    // con una query específica de PostgreSQL
    const activeConnections = 1; // Placeholder
    
    return {
      responseTime,
      activeConnections,
      status: 'connected',
    };
  } catch (error) {
    return {
      responseTime: Date.now() - startTime,
      activeConnections: 0,
      status: 'disconnected',
    };
  }
};

export const getLogStats = async (): Promise<LogStats> => {
  const logsDir = path.join(__dirname, '../../logs');
  const today = new Date().toISOString().split('T')[0];
  
  const stats: LogStats = {
    errors: 0,
    warnings: 0,
    info: 0,
    http: 0,
    total: 0,
  };
  
  try {
    // Leer archivo de logs combinados del día
    const combinedLogFile = path.join(logsDir, `combined-${today}.log`);
    
    if (fs.existsSync(combinedLogFile)) {
      const content = fs.readFileSync(combinedLogFile, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line);
      
      lines.forEach(line => {
        try {
          const log = JSON.parse(line);
          stats.total++;
          
          switch (log.level) {
            case 'error':
              stats.errors++;
              break;
            case 'warn':
              stats.warnings++;
              break;
            case 'info':
              stats.info++;
              break;
            case 'http':
              stats.http++;
              break;
          }
        } catch (e) {
          // Ignorar líneas que no son JSON válido
        }
      });
    }
  } catch (error) {
    console.error('Error reading log stats:', error);
  }
  
  return stats;
};

export const getRecentLogs = async (limit: number = 100, level?: string): Promise<any[]> => {
  const logsDir = path.join(__dirname, '../../logs');
  const today = new Date().toISOString().split('T')[0];
  const combinedLogFile = path.join(logsDir, `combined-${today}.log`);
  
  const logs: any[] = [];
  
  try {
    if (fs.existsSync(combinedLogFile)) {
      const content = fs.readFileSync(combinedLogFile, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line);
      
      // Obtener las últimas líneas
      const recentLines = lines.slice(-limit);
      
      recentLines.forEach(line => {
        try {
          const log = JSON.parse(line);
          
          // Filtrar por nivel si se especifica
          if (!level || log.level === level) {
            logs.push(log);
          }
        } catch (e) {
          // Ignorar líneas que no son JSON válido
        }
      });
    }
  } catch (error) {
    console.error('Error reading recent logs:', error);
  }
  
  return logs.reverse(); // Más recientes primero
};

export const getMetricsSummary = async () => {
  const [systemMetrics, databaseMetrics, logStats] = await Promise.all([
    Promise.resolve(getSystemMetrics()),
    getDatabaseMetrics(),
    getLogStats(),
  ]);
  
  return {
    system: systemMetrics,
    database: databaseMetrics,
    logs: logStats,
    timestamp: new Date().toISOString(),
  };
};
