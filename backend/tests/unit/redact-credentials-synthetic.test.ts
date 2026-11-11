import { redactText } from '../../src/utils/redact';

// Synthetic credentials built at runtime. They are NOT real tokens and must never be copied from logs.
const SYNTHETIC_JWT = `eyJ${'a'.repeat(12)}.${'b'.repeat(12)}.${'c'.repeat(12)}`;
const SYNTHETIC_REFRESH = `rt1.${'x'.repeat(24)}`;
const SYNTHETIC_DB_URL = 'postgresql://qa_user:synthetic-pass@db.example.test/neondb';

describe('credential redaction in free text (regression: exposed Authorization header in tool output)', () => {
  it('removes the value of an Authorization Bearer header and keeps the header name', () => {
    const out = redactText(`TargetClosedError\n  - authorization: Bearer ${SYNTHETIC_JWT}\n  - accept: */*`);
    expect(out).not.toContain(SYNTHETIC_JWT);
    expect(out).toContain('authorization: [REDACTED]');
    expect(out).toContain('accept: */*');
  });

  it('removes Set-Cookie and Cookie header values carrying refresh tokens', () => {
    const setCookie = redactText(`set-cookie: refreshToken=${SYNTHETIC_REFRESH}; Path=/api/auth; HttpOnly; SameSite=Lax`);
    const cookie = redactText(`cookie: refreshToken=${SYNTHETIC_REFRESH}; other=1`);
    expect(setCookie).not.toContain(SYNTHETIC_REFRESH);
    expect(cookie).not.toContain(SYNTHETIC_REFRESH);
    expect(setCookie).toMatch(/set-cookie: \[REDACTED\]/i);
    expect(cookie).toMatch(/cookie: \[REDACTED\]/i);
  });

  it('removes bare JWTs, refresh tokens and database credentials in prose', () => {
    const out = redactText(`token ${SYNTHETIC_JWT} and ${SYNTHETIC_REFRESH} via ${SYNTHETIC_DB_URL}`);
    expect(out).not.toContain(SYNTHETIC_JWT);
    expect(out).not.toContain(SYNTHETIC_REFRESH);
    expect(out).not.toContain('synthetic-pass');
  });

  it('leaves ordinary text untouched', () => {
    expect(redactText('login 200 · refresh 200 · cookie flags: httpOnly=true')).toBe('login 200 · refresh 200 · cookie flags: httpOnly=true');
  });
});
