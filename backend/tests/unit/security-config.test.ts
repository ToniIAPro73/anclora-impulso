import {
  applySecurityPolicy,
  evaluateSecurityConfig,
  parseDurationSeconds,
  SecurityConfigError,
  KNOWN_DEFAULT_SECRETS,
} from '../../src/utils/security-config';

const strong = (n: string) => `${n}-`.padEnd(48, 'x');
const good = { jwtSecret: strong('a'), jwtRefreshSecret: strong('b'), jwtExpiresIn: '15m', authAcceptLegacyTokens: false };
const codes = (input: typeof good) => evaluateSecurityConfig(input).map((f) => f.code);

describe('security config evaluation (AI-06 AC01)', () => {
  it('accepts strong distinct secrets and a short access lifetime', () => {
    expect(evaluateSecurityConfig(good)).toEqual([]);
  });

  it.each(KNOWN_DEFAULT_SECRETS)('flags the known default secret', (value) => {
    expect(codes({ ...good, jwtSecret: value })).toContain('JWT_SECRET_DEFAULT');
    expect(codes({ ...good, jwtRefreshSecret: value })).toContain('JWT_REFRESH_SECRET_DEFAULT');
  });

  it('flags short, empty and identical secrets', () => {
    expect(codes({ ...good, jwtSecret: 'short' })).toContain('JWT_SECRET_SHORT');
    expect(codes({ ...good, jwtRefreshSecret: '' })).toContain('JWT_REFRESH_SECRET_SHORT');
    expect(codes({ ...good, jwtRefreshSecret: good.jwtSecret })).toContain('JWT_SECRETS_IDENTICAL');
  });

  it('flags long or unparsable access lifetimes and legacy-token acceptance as warnings (not acceptable)', () => {
    const found = evaluateSecurityConfig({ ...good, jwtExpiresIn: '7d', authAcceptLegacyTokens: true });
    expect(found.find((f) => f.code === 'ACCESS_TOKEN_LIFETIME_LONG')?.severity).toBe('warning');
    expect(found.find((f) => f.code === 'LEGACY_TOKENS_ACCEPTED')?.severity).toBe('warning');
    expect(codes({ ...good, jwtExpiresIn: 'soon' })).toContain('ACCESS_TOKEN_LIFETIME_LONG');
  });

  it('never exposes secret values in findings', () => {
    const secret = strong('super-secret-value');
    const dump = JSON.stringify(evaluateSecurityConfig({ ...good, jwtSecret: secret, jwtRefreshSecret: secret }));
    expect(dump.includes(secret)).toBe(false);
  });

  it('parses durations', () => {
    expect(parseDurationSeconds('15m')).toBe(900);
    expect(parseDurationSeconds('7d')).toBe(604800);
    expect(parseDurationSeconds('3600')).toBe(3600);
    expect(parseDurationSeconds('abc')).toBeNull();
  });
});

describe('security policy modes (AI-06 AC02)', () => {
  const insecure = { ...good, jwtSecret: KNOWN_DEFAULT_SECRETS[0] };

  it('enforce throws on error findings', () => {
    expect(() => applySecurityPolicy('enforce', insecure)).toThrow(SecurityConfigError);
  });

  it('warn and off do not throw but never report an insecure configuration as acceptable', () => {
    for (const mode of ['warn', 'off'] as const) {
      const result = applySecurityPolicy(mode, insecure);
      expect(result.acceptable).toBe(false);
    }
  });

  it('long access lifetime alone does not block startup in enforce but is not acceptable', () => {
    const result = applySecurityPolicy('enforce', { ...good, jwtExpiresIn: '7d' });
    expect(result.acceptable).toBe(false);
  });

  it('a fully secure configuration is acceptable in every mode', () => {
    for (const mode of ['off', 'warn', 'enforce'] as const) {
      expect(applySecurityPolicy(mode, good).acceptable).toBe(true);
    }
  });
});
