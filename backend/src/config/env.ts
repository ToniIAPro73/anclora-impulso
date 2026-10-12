import dotenv from 'dotenv';

dotenv.config();

function expandFrontendAliases(rawOrigins: string[]) {
  const aliases = new Set<string>();

  for (const origin of rawOrigins) {
    aliases.add(origin);

    try {
      const url = new URL(origin);

      if (url.hostname === 'localhost') {
        aliases.add(origin.replace('localhost', '127.0.0.1'));
      }

      if (url.hostname === '127.0.0.1') {
        aliases.add(origin.replace('127.0.0.1', 'localhost'));
      }
    } catch {
      // Ignore malformed entries and preserve the original value only.
    }
  }

  return [...aliases];
}

const configuredFrontendUrls = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

export const env = {
  // Database
  databaseUrl: process.env.DATABASE_URL || '',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-in-production',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',

  // Sessions (AI-06)
  authRefreshSessionDays: parseInt(process.env.AUTH_REFRESH_SESSION_DAYS || '30', 10),
  authRefreshReuseGraceSeconds: parseInt(process.env.AUTH_REFRESH_REUSE_GRACE_SECONDS || '10', 10),
  // Transition: accept pre-session JWTs (no `sid`). Set to 'false' once existing sessions have rotated.
  authAcceptLegacyTokens: process.env.AUTH_ACCEPT_LEGACY_TOKENS !== 'false',
  securityConfigMode: (process.env.SECURITY_CONFIG_MODE || 'warn') as 'off' | 'warn' | 'enforce',

  // OAuth handoff (F-4): lifetime of the one-time code between the provider callback and its redemption by the browser.
  // Clamped to 10..300 s; anything unparsable falls back to 60 s.
  oauthHandoffTtlSeconds: (() => {
    const parsed = parseInt(process.env.OAUTH_HANDOFF_TTL_SECONDS || '60', 10);
    return Number.isFinite(parsed) ? Math.min(300, Math.max(10, parsed)) : 60;
  })(),

  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // CORS
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  frontendUrls: expandFrontendAliases(configuredFrontendUrls),

  // F-1: administrative privileges are granted to USER IDS designated out of band (ADMIN_USER_IDS), never to an
  // e-mail address: an address is free text that anyone can register, an id is assigned by the database.
  adminUserIds: (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim().toLowerCase())
    .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)),

  // DEPRECATED and IGNORED for authorization (kept only so startup can warn that the old variable no longer applies).
  adminEmails: (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),

  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || '',
  notificationDispatchIntervalMinutes: parseInt(process.env.NOTIFICATION_DISPATCH_INTERVAL_MINUTES || '15', 10),

  // LLM (Groq / modelos open source)
  llmProvider: process.env.LLM_PROVIDER || 'groq',
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  llmCoachEnabled: process.env.LLM_COACH_ENABLED === 'true',
  llmCoachMaxPromptChars: parseInt(process.env.LLM_COACH_MAX_PROMPT_CHARS || '6000', 10),
  llmCoachMaxOutputTokens: parseInt(process.env.LLM_COACH_MAX_OUTPUT_TOKENS || '450', 10),
  llmCoachMemoryMessages: parseInt(process.env.LLM_COACH_MEMORY_MESSAGES || '8', 10),
  llmCoachCacheTtlSeconds: parseInt(process.env.LLM_COACH_CACHE_TTL_SECONDS || '300', 10),
  llmCoachWindowMinutes: parseInt(process.env.LLM_COACH_WINDOW_MINUTES || '60', 10),
  llmCoachWindowLimit: parseInt(process.env.LLM_COACH_WINDOW_LIMIT || '20', 10),
  llmCoachProviderTimeoutMs: parseInt(process.env.LLM_COACH_PROVIDER_TIMEOUT_MS || '25000', 10),
  // Operational protections for the coach (engineering defaults; NOT approved commercial or economic limits).
  llmCoachMaxConcurrent: parseInt(process.env.LLM_COACH_MAX_CONCURRENT || '2', 10),
  llmCoachMaxFailedAttempts: parseInt(process.env.LLM_COACH_MAX_FAILED_ATTEMPTS_PER_WINDOW || '5', 10),
  llmWorkoutTimeoutMs: parseInt(process.env.LLM_WORKOUT_TIMEOUT_MS || '30000', 10),
  idempotencyMaxAttempts: parseInt(process.env.IDEMPOTENCY_MAX_ATTEMPTS || '3', 10),
  // 'warn': clients without Idempotency-Key get a server-derived short-window key and a Deprecation header.
  // 'require': 428 without the header. A sunset date in the past forces 'require'.
  idempotencyKeyEnforcement: (process.env.IDEMPOTENCY_KEY_ENFORCEMENT || 'warn') as 'warn' | 'require',
  idempotencyLegacySunsetAt: process.env.IDEMPOTENCY_LEGACY_SUNSET_AT || '',
  // Physical deletion happens only this long AFTER logical expiry (replay guarantee ends at expiresAt).
  retentionPurgeGraceSeconds: parseInt(process.env.RETENTION_PURGE_GRACE_SECONDS || '3600', 10),
  retentionPurgeBatchSize: parseInt(process.env.RETENTION_PURGE_BATCH_SIZE || '500', 10),
  idempotencyRetentionHours: parseInt(process.env.IDEMPOTENCY_RETENTION_HOURS || '24', 10),
  healthDataImportEnabled: process.env.HEALTH_DATA_IMPORT_ENABLED === 'true',
  wearableSyncEnabled: process.env.WEARABLE_SYNC_ENABLED === 'true',
  wearableReadinessEnabled: process.env.WEARABLE_READINESS_ENABLED === 'true',
  formAnalysisEnabled: process.env.FORM_ANALYSIS_ENABLED === 'true',
  voiceCoachEnabled: process.env.VOICE_COACH_ENABLED === 'true',

  // Legacy (deprecated, usar GROQ_API_KEY)
  openaiApiKey: process.env.OPENAI_API_KEY || '',
};

// Validar variables de entorno críticas
if (!env.databaseUrl) {
  console.warn('⚠️  DATABASE_URL no está configurada');
}

if (env.nodeEnv === 'production') {
  if (env.jwtSecret === 'default-secret-change-in-production') {
    throw new Error('JWT_SECRET debe ser configurado en producción');
  }
  if (env.jwtRefreshSecret === 'default-refresh-secret-change-in-production') {
    throw new Error('JWT_REFRESH_SECRET debe ser configurado en producción');
  }
}
