/** Review R4: secrets in query strings / free text must not reach ANY used logging path. Decoy values only. */
const warn = jest.fn();
const error = jest.fn();
jest.mock('../../src/config/logger', () => ({
  __esModule: true,
  default: { warn: (...a: unknown[]) => warn(...a), error: (...a: unknown[]) => error(...a), info: jest.fn(), http: jest.fn() },
  logError: (...a: unknown[]) => error(...a),
}));

import { notFoundHandler } from '../../src/middleware/errorHandler';
import { responseTimeLogger } from '../../src/middleware/httpLogger';
import { redactText, stripQueryString } from '../../src/utils/redact';

const DECOYS = ['DECOY_CODE_7f3a', 'DECOY_TOKEN_91bc', 'DECOY_SECRET_c04d'];
const serialized = (mock: jest.Mock) => JSON.stringify(mock.mock.calls);

beforeEach(() => { warn.mockClear(); error.mockClear(); });

describe('404 handler', () => {
  it('does not write query values (code, tokens, secrets) to the log', () => {
    const req = { method: 'GET', originalUrl: `/missing?code=${DECOYS[0]}&accessToken=${DECOYS[1]}`, url: '/missing', ip: '127.0.0.1' } as never;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as never;
    notFoundHandler(req, res);
    const logged = serialized(warn);
    for (const decoy of DECOYS) expect(logged.includes(decoy)).toBe(false);
    expect(logged).toContain('/missing'); // the path itself is still logged
  });
});

describe('slow-request logging', () => {
  it('does not write query values for slow requests', () => {
    const realNow = Date.now;
    let t = 1_000_000;
    Date.now = () => t;
    try {
      const req = { method: 'GET', url: `/api/x?code=${DECOYS[0]}&refresh_token=${DECOYS[1]}`, user: { userId: 'u' } };
      const res = { setHeader: jest.fn(), end: jest.fn() };
      responseTimeLogger(req, res, jest.fn());
      t += 1500;
      res.end();
    } finally { Date.now = realNow; }
    expect(warn).toHaveBeenCalled();
    for (const decoy of DECOYS) expect(serialized(warn).includes(decoy)).toBe(false);
  });
});

describe('free-text redaction', () => {
  it('removes secret-bearing query parameters, bearer values and tokens from error text', () => {
    const text =
      `request to https://provider.example/token?code=${DECOYS[0]}&client_secret=${DECOYS[2]}&grant_type=x failed; ` +
      `Authorization: Bearer ${DECOYS[1]} refresh=rt1.${'A'.repeat(30)} jwt=eyJ${'a'.repeat(12)}.${'b'.repeat(12)}.${'c'.repeat(12)}`;
    const cleaned = redactText(text);
    for (const decoy of DECOYS) expect(cleaned.includes(decoy)).toBe(false);
    expect(cleaned.includes('rt1.' + 'A'.repeat(30))).toBe(false);
    expect(cleaned).toContain('grant_type=x'); // non-secret parameters survive
  });

  it('stripQueryString keeps the path and drops every value', () => {
    expect(stripQueryString(`/a/b?code=${DECOYS[0]}`)).not.toContain(DECOYS[0]);
    expect(stripQueryString('/a/b')).toBe('/a/b');
  });
});
