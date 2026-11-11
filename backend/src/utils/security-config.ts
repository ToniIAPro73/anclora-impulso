export type SecurityFindingCode =
  | 'JWT_SECRET_DEFAULT'
  | 'JWT_SECRET_SHORT'
  | 'JWT_REFRESH_SECRET_DEFAULT'
  | 'JWT_REFRESH_SECRET_SHORT'
  | 'JWT_SECRETS_IDENTICAL'
  | 'ACCESS_TOKEN_LIFETIME_LONG'
  | 'LEGACY_TOKENS_ACCEPTED';

export interface SecurityFinding {
  code: SecurityFindingCode;
  severity: 'error' | 'warning' | 'info';
}

export interface SecurityConfigInput {
  jwtSecret: string;
  jwtRefreshSecret: string;
  jwtExpiresIn: string;
  authAcceptLegacyTokens: boolean;
}

/** Constants the application falls back to when the variables are missing. They are public in the repo. */
export const KNOWN_DEFAULT_SECRETS = [
  'default-secret-change-in-production',
  'default-refresh-secret-change-in-production',
];

export const MIN_SECRET_LENGTH = 32;
export const MAX_RECOMMENDED_ACCESS_LIFETIME_SECONDS = 3600;

export function parseDurationSeconds(value: string): number | null {
  const match = /^(\d+)\s*([smhd]?)$/i.exec(value.trim());
  if (!match) return null;
  const unit = { '': 1, s: 1, m: 60, h: 3600, d: 86400 }[match[2].toLowerCase() as '' | 's' | 'm' | 'h' | 'd'];
  return parseInt(match[1], 10) * unit;
}

/** Pure: inspects values, never returns or logs them. */
export function evaluateSecurityConfig(input: SecurityConfigInput): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  if (KNOWN_DEFAULT_SECRETS.includes(input.jwtSecret)) findings.push({ code: 'JWT_SECRET_DEFAULT', severity: 'error' });
  else if (input.jwtSecret.length < MIN_SECRET_LENGTH) findings.push({ code: 'JWT_SECRET_SHORT', severity: 'error' });

  if (KNOWN_DEFAULT_SECRETS.includes(input.jwtRefreshSecret)) findings.push({ code: 'JWT_REFRESH_SECRET_DEFAULT', severity: 'error' });
  else if (input.jwtRefreshSecret.length < MIN_SECRET_LENGTH) findings.push({ code: 'JWT_REFRESH_SECRET_SHORT', severity: 'error' });

  if (input.jwtSecret === input.jwtRefreshSecret) findings.push({ code: 'JWT_SECRETS_IDENTICAL', severity: 'error' });

  const lifetime = parseDurationSeconds(input.jwtExpiresIn);
  if (lifetime === null || lifetime > MAX_RECOMMENDED_ACCESS_LIFETIME_SECONDS) {
    findings.push({ code: 'ACCESS_TOKEN_LIFETIME_LONG', severity: 'warning' });
  }

  // Legacy (pre-session) tokens cannot be individually revoked: while accepted, revocation is NOT complete.
  if (input.authAcceptLegacyTokens) findings.push({ code: 'LEGACY_TOKENS_ACCEPTED', severity: 'warning' });

  return findings;
}

export interface SecurityPolicyResult {
  mode: 'off' | 'warn' | 'enforce';
  /** True only with zero error/warning findings. `off`/`warn` never make an insecure configuration acceptable. */
  acceptable: boolean;
  findings: SecurityFinding[];
}

export class SecurityConfigError extends Error {
  constructor(public readonly findings: SecurityFinding[]) {
    super(`Insecure security configuration: ${findings.map((f) => f.code).join(', ')}`);
  }
}

/** Throws in enforce mode when any error-severity finding exists. Logs nothing itself. */
export function applySecurityPolicy(
  mode: 'off' | 'warn' | 'enforce',
  input: SecurityConfigInput,
): SecurityPolicyResult {
  const findings = evaluateSecurityConfig(input);
  const blocking = findings.filter((finding) => finding.severity === 'error');

  if (mode === 'enforce' && blocking.length > 0) {
    throw new SecurityConfigError(blocking);
  }

  return {
    mode,
    acceptable: !findings.some((finding) => finding.severity !== 'info'),
    findings,
  };
}

/**
 * Startup guard (TASK-006 / AUD-002): fails startup in any environment other than `test`
 * when JWT secrets are missing or left at known default values. Never logs secret values.
 */
export function assertRequiredJwtSecrets(input: {
  nodeEnv: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
}): void {
  if (input.nodeEnv === 'test') return;

  if (!input.jwtSecret || KNOWN_DEFAULT_SECRETS.includes(input.jwtSecret)) {
    throw new Error('JWT_SECRET debe ser configurado fuera del entorno de test');
  }

  if (!input.jwtRefreshSecret || KNOWN_DEFAULT_SECRETS.includes(input.jwtRefreshSecret)) {
    throw new Error('JWT_REFRESH_SECRET debe ser configurado fuera del entorno de test');
  }

  if (input.jwtSecret.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET debe tener al menos ${MIN_SECRET_LENGTH} caracteres fuera del entorno de test`);
  }

  if (input.jwtRefreshSecret.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_REFRESH_SECRET debe tener al menos ${MIN_SECRET_LENGTH} caracteres fuera del entorno de test`);
  }

  if (input.jwtSecret === input.jwtRefreshSecret) {
    throw new Error('JWT_SECRET y JWT_REFRESH_SECRET no pueden ser idénticos fuera del entorno de test');
  }
}

