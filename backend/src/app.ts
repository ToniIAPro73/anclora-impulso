import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { httpLogger, responseTimeLogger } from './middleware/httpLogger';
import { incrementRequestCount } from './services/health.service';
import { incrementRequestCounter } from './services/metrics.service';
import logger from './config/logger';

// Importar rutas
import authRoutes from './routes/auth.routes';
import oauthRoutes from './routes/oauth.routes';
import exercisesRoutes from './routes/exercises.routes';
import workoutsRoutes from './routes/workouts.routes';
import sessionsRoutes from './routes/sessions.routes';
import progressRoutes from './routes/progress.routes';
import healthRoutes from './routes/health.routes';
import dashboardRoutes from './routes/dashboard.routes';
import nutritionRoutes from './routes/nutrition.routes';
import gamificationRoutes from './routes/gamification.routes';
import profileRoutes from './routes/profile.routes';
import productEventsRoutes from './routes/product-events.routes';
import engagementRoutes from './routes/engagement.routes';
import progressionRoutes from './routes/progression.routes';
import coachRoutes from './routes/coach.routes';
import socialRoutes from './routes/social.routes';
import wearablesRoutes from './routes/wearables.routes';
import premiumRoutes from './routes/premium.routes';

const app: Express = express();

function isAllowedOrigin(origin: string) {
  const allowedOrigins = new Set(env.frontendUrls);

  if (allowedOrigins.has(origin)) {
    return true;
  }

  try {
    const requestUrl = new URL(origin);

    return env.frontendUrls.some((allowedOrigin) => {
      try {
        const allowedUrl = new URL(allowedOrigin);
        const isSameOrigin = allowedUrl.origin === requestUrl.origin;
        const isMatchingVercelPreview =
          allowedUrl.hostname.endsWith('.vercel.app') &&
          requestUrl.hostname.endsWith('.vercel.app') &&
          requestUrl.hostname.startsWith(`${allowedUrl.hostname.replace('.vercel.app', '')}-`);

        return isSameOrigin || isMatchingVercelPreview;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

// Confiar en el proxy (necesario para Render/Vercel y rate limiting)
app.set('trust proxy', 1);

// Middleware de seguridad
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// CORS
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

// Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Servir archivos estáticos
app.use(
  '/exercises',
  express.static('public/exercises', {
    setHeaders(res) {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Access-Control-Allow-Origin', '*');
    },
  })
);
app.use('/dashboard', express.static('public'));

// Logging middleware
app.use(responseTimeLogger);
app.use(httpLogger);

// Contador de requests para métricas
app.use((req, res, next) => {
  incrementRequestCount();
  incrementRequestCounter();
  next();
});

// Rate limiting global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: env.nodeEnv === 'development' ? 1000 : 100, // más holgado en local
  message: 'Demasiadas solicitudes, por favor intenta más tarde',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Rate limiting específico para autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: env.nodeEnv === 'development' ? 100 : 5, // no bloquear el flujo local
  message: 'Demasiados intentos de autenticación, por favor intenta más tarde',
  skipSuccessfulRequests: true,
});

// Rutas de health check
app.use('/', healthRoutes);

// Log de inicio de aplicación
logger.info('Application initialized', {
  environment: env.nodeEnv,
  port: env.port,
});

// Rutas de la API
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/auth', oauthRoutes);
app.use('/api/exercises', exercisesRoutes);
app.use('/api/workouts', workoutsRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/events', productEventsRoutes);
app.use('/api/engagement', engagementRoutes);
app.use('/api/v1/progression', progressionRoutes);
app.use('/api/v1/coach', coachRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/wearables', wearablesRoutes);
app.use('/api/premium', premiumRoutes);

// Manejo de rutas no encontradas
app.use(notFoundHandler);

// Manejo global de errores
app.use(errorHandler);

export default app;
