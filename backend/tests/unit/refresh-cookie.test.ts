import type { Response } from 'express';
import {
  clearRefreshTokenCookie,
  extractRefreshToken,
  getRefreshCookieOptions,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  setRefreshTokenCookie,
} from '../../src/utils/refresh-cookie';

describe('refresh token HttpOnly cookie helpers (TASK-002 / AUD-001)', () => {
  it('configures HttpOnly, SameSite=lax, and restricted path /api/auth', () => {
    const options = getRefreshCookieOptions();
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
    });
    expect(options.maxAge).toBeGreaterThan(0);
  });

  it('sets and clears the refreshToken cookie on the response', () => {
    const cookie = jest.fn();
    const clearCookie = jest.fn();
    const res = { cookie, clearCookie } as unknown as Response;

    setRefreshTokenCookie(res, 'rt1.sample');
    expect(cookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'rt1.sample',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: REFRESH_COOKIE_PATH,
      }),
    );

    clearRefreshTokenCookie(res);
    expect(clearCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        path: REFRESH_COOKIE_PATH,
      }),
    );
  });

  it('prefers the HttpOnly cookie and falls back to the request body during transition', () => {
    expect(
      extractRefreshToken({
        cookies: { refreshToken: 'cookie-rt' },
        body: { refreshToken: 'body-rt' },
      }),
    ).toBe('cookie-rt');

    expect(
      extractRefreshToken({
        cookies: {},
        body: { refreshToken: 'body-rt' },
      }),
    ).toBe('body-rt');

    expect(extractRefreshToken({ cookies: {}, body: {} })).toBeUndefined();
  });
});
