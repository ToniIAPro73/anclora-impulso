/** B1-F7: errors and slow requests must be attributed to the authenticated user (JwtPayload.userId). Synthetic ids only. */
const warn = jest.fn();
const error = jest.fn();
jest.mock('../../src/config/logger', () => ({
  __esModule: true,
  default: { warn: (...a: unknown[]) => warn(...a), error: (...a: unknown[]) => error(...a), info: jest.fn(), http: jest.fn() },
  logError: (...a: unknown[]) => error(...a),
}));

import { errorHandler, AppError } from '../../src/middleware/errorHandler';
import { responseTimeLogger } from '../../src/middleware/httpLogger';

const USER_ID = '00000000-0000-4000-8000-000000000b1f';

beforeEach(() => { warn.mockClear(); error.mockClear(); });

describe('error log context', () => {
  const run = (user: unknown) => {
    const req = { method: 'GET', url: '/api/x', originalUrl: '/api/x', ip: '127.0.0.1', get: () => 'jest', body: {}, params: {}, query: {}, user } as never;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), setHeader: jest.fn() } as never;
    errorHandler(new AppError(400, 'bad'), req, res, jest.fn());
    return error.mock.calls[0][1] as Record<string, unknown>;
  };

  it('records the userId of the authenticated user', () => {
    expect(run({ userId: USER_ID, email: 'x@example.test' }).userId).toBe(USER_ID);
  });

  it('records no user for an anonymous request', () => {
    expect(run(undefined).userId).toBeUndefined();
  });
});

describe('slow-request log context', () => {
  it('records the userId of the authenticated user', () => {
    const realNow = Date.now;
    let t = 1_000_000;
    Date.now = () => t;
    try {
      const req = { method: 'GET', url: '/api/x', user: { userId: USER_ID } };
      const res = { setHeader: jest.fn(), end: jest.fn() };
      responseTimeLogger(req, res, jest.fn());
      t += 1500;
      res.end();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][1]).toMatchObject({ userId: USER_ID });
    } finally {
      Date.now = realNow;
    }
  });
});
