import type { NextFunction, Request, Response } from 'express';
import { env } from '../../src/config/env';
import * as authService from '../../src/services/auth.service';
import { register } from '../../src/controllers/auth.controller';

function createMockResponse() {
  const res: Partial<Response> & { statusCode: number; body: unknown } = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this as Response;
    },
    json(payload: unknown) {
      this.body = payload;
      return this as Response;
    },
  };
  return res as Response & { statusCode: number; body: unknown };
}

describe('public signup gate (DEC-ID-02)', () => {
  const originalPublicSignupEnabled = env.publicSignupEnabled;
  const originalIdentityEnabled = env.ancloraIdentityEnabled;
  const originalAllowLegacy = env.ancloraIdentityAllowLegacyAuth;

  afterEach(() => {
    env.publicSignupEnabled = originalPublicSignupEnabled;
    env.ancloraIdentityEnabled = originalIdentityEnabled;
    env.ancloraIdentityAllowLegacyAuth = originalAllowLegacy;
    jest.restoreAllMocks();
  });

  it('rejects POST /api/auth/register with 403 PUBLIC_SIGNUP_DISABLED when disabled even if legacy auth is allowed', async () => {
    env.publicSignupEnabled = false;
    env.ancloraIdentityEnabled = true;
    env.ancloraIdentityAllowLegacyAuth = true;

    const registerSpy = jest.spyOn(authService, 'register');
    const req = {
      body: { email: 'blocked@example.com', password: 'password123', fullName: 'Blocked User' },
    } as Request;
    const res = createMockResponse();
    const next = jest.fn() as NextFunction;

    await register(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ code: 'PUBLIC_SIGNUP_DISABLED' });
    expect(registerSpy).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
