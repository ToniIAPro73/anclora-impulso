import { Router, type Router as ExpressRouter } from 'express';
import {
  getMetrics,
  getDbMetrics,
  getLogsStats,
  getLogs,
  getSummary,
} from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const router: ExpressRouter = Router();

// Operational/global data: administrators only. Applies to every route below.
router.use(authenticate, requireAdmin);

/**
 * @route   GET /api/dashboard/metrics
 * @desc    Obtener métricas del sistema
 * @access  Admin (Bearer token of an account listed in ADMIN_EMAILS)
 */
router.get('/metrics', getMetrics);

/**
 * @route   GET /api/dashboard/db-metrics
 * @desc    Obtener métricas de la base de datos
 * @access  Admin (Bearer token of an account listed in ADMIN_EMAILS)
 */
router.get('/db-metrics', getDbMetrics);

/**
 * @route   GET /api/dashboard/logs-stats
 * @desc    Obtener estadísticas de logs
 * @access  Admin (Bearer token of an account listed in ADMIN_EMAILS)
 */
router.get('/logs-stats', getLogsStats);

/**
 * @route   GET /api/dashboard/logs
 * @desc    Obtener logs recientes
 * @query   limit - Número de logs a obtener (default: 100)
 * @query   level - Filtrar por nivel (error, warn, info, http)
 * @access  Admin (Bearer token of an account listed in ADMIN_EMAILS)
 */
router.get('/logs', getLogs);

/**
 * @route   GET /api/dashboard/summary
 * @desc    Obtener resumen completo de métricas
 * @access  Admin (Bearer token of an account listed in ADMIN_EMAILS)
 */
router.get('/summary', getSummary);

export default router;
