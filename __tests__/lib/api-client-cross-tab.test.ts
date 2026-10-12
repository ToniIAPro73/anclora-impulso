/** @jest-environment jsdom */
/**
 * R8-C: another TAB signs in as B by writing the shared storage (it never calls this client's setToken). A request
 * started under A must never be replayed, refreshed or written over under B. The fake server applies a PUT to the
 * user identified by the Authorization header, so the state of BOTH users is asserted, not only tokens.
 */
type Json = Record<string, unknown>;
const jsonResponse = (status: number, body: Json = {}) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;
const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const jwt = (sid: string, n = 0) => `${b64({ alg: 'none' })}.${b64({ sid, n })}.sig`;

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}
const until = (cond: () => boolean) => new Promise<void>((resolve) => { const t = () => (cond() ? resolve() : setTimeout(t, 1)); t(); });

const A_EXPIRED = jwt('sess-A', 0);
const A_FRESH = jwt('sess-A', 1);      // rotated token of the SAME session
const B_TOKEN = jwt('sess-B', 0);
const userOf = (auth: string | null) => (auth?.includes(b64({ sid: 'sess-A', n: 1 }) ) || auth === `Bearer ${A_FRESH}` ? 'A'
  : auth === `Bearer ${B_TOKEN}` ? 'B' : null);

interface Server {
  profiles: { A: { age: number }; B: { age: number } };
  requests: Array<{ method: string; url: string; auth: string | null; body: string | null; refreshBody?: string }>;
  refresh: ReturnType<typeof deferred<Response>>;
  firstPut: ReturnType<typeof deferred<void>>;
}

function installServer(holdFirstPut = false): Server {
  const s: Server = { profiles: { A: { age: 30 }, B: { age: 40 } }, requests: [], refresh: deferred<Response>(), firstPut: deferred<void>() };
  let puts = 0;
  global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const auth = headers.get('Authorization');
    const body = typeof init?.body === 'string' ? init.body : null;
    s.requests.push({ method: init?.method ?? 'GET', url: String(url), auth, body });
    if (String(url).endsWith('/auth/refresh')) return s.refresh.promise;
    if (String(url).endsWith('/profile') && init?.method === 'PUT') {
      puts += 1;
      if (holdFirstPut && puts === 1) await s.firstPut.promise;
      if (auth === `Bearer ${A_EXPIRED}`) return jsonResponse(401, { error: 'expired' });
      const user = auth === `Bearer ${A_FRESH}` ? 'A' : auth === `Bearer ${B_TOKEN}` ? 'B' : null;
      if (!user) return jsonResponse(401, { error: 'unauthenticated' });
      Object.assign(s.profiles[user], JSON.parse(body ?? '{}'));
      return jsonResponse(200, { user });
    }
    return jsonResponse(404);
  }) as unknown as typeof fetch;
  return s;
}

async function tabA() {
  localStorage.clear();
  localStorage.setItem('accessToken', A_EXPIRED);
  localStorage.setItem('refreshToken', 'rt1.A');
  jest.resetModules();
  return (await import('@/lib/api/client')).apiClient;
}
/** Another tab signs in as B: shared storage only, no call on this tab's client. */
const otherTabLogsInAsB = () => { localStorage.setItem('accessToken', B_TOKEN); localStorage.setItem('refreshToken', 'rt1.B'); };

const sentUnderB = (s: Server) => s.requests.filter((r) => r.auth === `Bearer ${B_TOKEN}`);
const refreshBodies = (s: Server) => s.requests.filter((r) => r.url.endsWith('/auth/refresh')).map((r) => r.body);

afterEach(() => jest.restoreAllMocks());

describe('R8-C other tab signs in as B', () => {
  it('PUT of A pending refresh -> tab B login -> refresh A answers 401: nothing of A is sent under B', async () => {
    const s = installServer();
    const client = await tabA();
    const put = client.put('/profile', { age: 31 });
    put.catch(() => undefined);
    await until(() => s.requests.some((r) => r.url.endsWith('/auth/refresh')));
    otherTabLogsInAsB();
    s.refresh.resolve(jsonResponse(401, { error: 'revoked' }));
    await expect(put).rejects.toMatchObject({ status: 401 });

    expect(sentUnderB(s)).toHaveLength(0);
    expect(s.requests.filter((r) => r.method === 'PUT' && r.body === '{"age":31}')).toHaveLength(1); // only the original, under A
    expect(s.profiles).toEqual({ A: { age: 30 }, B: { age: 40 } });
    expect({ a: localStorage.getItem('accessToken'), r: localStorage.getItem('refreshToken') }).toEqual({ a: B_TOKEN, r: 'rt1.B' });
  });

  it('same interleaving, refresh A answers 200: A does not overwrite B, nothing is replayed under B', async () => {
    const s = installServer();
    const client = await tabA();
    const put = client.put('/profile', { age: 31 });
    put.catch(() => undefined);
    await until(() => s.requests.some((r) => r.url.endsWith('/auth/refresh')));
    otherTabLogsInAsB();
    s.refresh.resolve(jsonResponse(200, { accessToken: A_FRESH, refreshToken: 'rt1.A2' }));
    await put.catch(() => undefined);

    expect(sentUnderB(s)).toHaveLength(0);
    expect(s.profiles).toEqual({ A: { age: 30 }, B: { age: 40 } });
    expect({ a: localStorage.getItem('accessToken'), r: localStorage.getItem('refreshToken') }).toEqual({ a: B_TOKEN, r: 'rt1.B' });
  });

  it('tab B logs in BEFORE the 401 arrives: B\'s refresh token is never used for A\'s request', async () => {
    const s = installServer(true);
    const client = await tabA();
    const put = client.put('/profile', { age: 31 });
    put.catch(() => undefined);
    await until(() => s.requests.some((r) => r.method === 'PUT'));
    otherTabLogsInAsB();
    s.firstPut.resolve(); // the 401 for A now arrives, with B already in the shared storage
    await put.catch(() => undefined);

    expect(refreshBodies(s)).toHaveLength(0);          // B's rt1.B was not exchanged on behalf of A
    expect(sentUnderB(s)).toHaveLength(0);
    expect(s.profiles).toEqual({ A: { age: 30 }, B: { age: 40 } });
    expect(localStorage.getItem('refreshToken')).toBe('rt1.B');
  });

  it('control: another tab ROTATED the same session A -> adopted, request replayed once under A, B/other users untouched', async () => {
    const s = installServer();
    const client = await tabA();
    const put = client.put('/profile', { age: 31 });
    await until(() => s.requests.some((r) => r.url.endsWith('/auth/refresh')));
    localStorage.setItem('accessToken', A_FRESH); localStorage.setItem('refreshToken', 'rt1.A2'); // same sid, rotated elsewhere
    s.refresh.resolve(jsonResponse(401, { error: 'token already rotated' }));
    await expect(put).resolves.toEqual({ user: 'A' });

    expect(s.profiles).toEqual({ A: { age: 31 }, B: { age: 40 } });
    expect(s.requests.filter((r) => r.method === 'PUT' && r.auth === `Bearer ${A_FRESH}`)).toHaveLength(1);
    expect({ a: localStorage.getItem('accessToken'), r: localStorage.getItem('refreshToken') }).toEqual({ a: A_FRESH, r: 'rt1.A2' });
  });
});
