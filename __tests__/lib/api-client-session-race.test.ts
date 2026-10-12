/** @jest-environment jsdom */
/**
 * R8-A: a request/refresh started under session A must never delete, overwrite or resurrect another session's
 * credentials. Controlled promises; assertions are on stored tokens and client state, not on call counts.
 */
type Json = Record<string, unknown>;
const jsonResponse = (status: number, body: Json = {}) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

async function loadClient() {
  jest.resetModules();
  return (await import('@/lib/api/client')).apiClient;
}

const store = () => ({ access: localStorage.getItem('accessToken'), refresh: localStorage.getItem('refreshToken') });

interface Net { refreshA: ReturnType<typeof deferred<Response>>; calls: Array<{ url: string; auth: string | null }> }

/** /workouts answers 401 for A's token, 200 for B's; /auth/refresh is held until the test releases it. */
function installNet(): Net {
  const net: Net = { refreshA: deferred<Response>(), calls: [] };
  global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    net.calls.push({ url: String(url), auth: headers.get('Authorization') });
    if (String(url).endsWith('/auth/refresh')) return net.refreshA.promise;
    return headers.get('Authorization') === 'Bearer access-B' ? jsonResponse(200, { who: 'B' }) : jsonResponse(401, { error: 'expired' });
  }) as unknown as typeof fetch;
  return net;
}

async function startRefreshUnderA() {
  localStorage.clear();
  localStorage.setItem('accessToken', 'access-A');
  localStorage.setItem('refreshToken', 'rt1.A');
  const net = installNet();
  const client = await loadClient();
  const request = client.get('/workouts');
  request.catch(() => undefined);
  // wait until the refresh request for A is actually in flight
  await new Promise<void>((resolve) => {
    const tick = () => (net.calls.some((c) => c.url.endsWith('/auth/refresh')) ? resolve() : setTimeout(tick, 1));
    tick();
  });
  return { client, net, request };
}

const signInB = (client: Awaited<ReturnType<typeof loadClient>>) => {
  localStorage.setItem('refreshToken', 'rt1.B');
  client.setToken('access-B'); // what storeSession / the OAuth callback do
};

afterEach(() => jest.restoreAllMocks());

describe('R8-A refresh started under A', () => {
  it('A pending -> login B -> A answers 401: B keeps its tokens and client state', async () => {
    const { client, net, request } = await startRefreshUnderA();
    signInB(client);
    net.refreshA.resolve(jsonResponse(401, { error: 'revoked' }));
    await expect(request).rejects.toMatchObject({ status: 401 });
    expect(store()).toEqual({ access: 'access-B', refresh: 'rt1.B' });
    expect(client.getToken()).toBe('access-B');
  });

  it('A pending -> login B -> A answers 200: A does not overwrite B', async () => {
    const { client, net, request } = await startRefreshUnderA();
    signInB(client);
    net.refreshA.resolve(jsonResponse(200, { accessToken: 'access-A2', refreshToken: 'rt1.A2' }));
    await request.catch(() => undefined);
    expect(store()).toEqual({ access: 'access-B', refresh: 'rt1.B' });
    expect(client.getToken()).toBe('access-B');
    // and A's request was not replayed under B's identity
    expect(net.calls.filter((c) => c.url.endsWith('/workouts') && c.auth === 'Bearer access-B')).toHaveLength(0);
  });

  it('A pending -> logout -> late 200: the discarded session is not restored', async () => {
    const { client, net, request } = await startRefreshUnderA();
    client.setToken(null); localStorage.removeItem('refreshToken'); // explicit logout
    net.refreshA.resolve(jsonResponse(200, { accessToken: 'access-A2', refreshToken: 'rt1.A2' }));
    await request.catch(() => undefined);
    expect(store()).toEqual({ access: null, refresh: null });
    expect(client.getToken()).toBeNull();
  });

  it('single-flight: two requests share one refresh; a session change makes BOTH inert', async () => {
    localStorage.clear();
    localStorage.setItem('accessToken', 'access-A');
    localStorage.setItem('refreshToken', 'rt1.A');
    const net = installNet();
    const client = await loadClient();
    const r1 = client.get('/workouts'); const r2 = client.get('/workouts');
    r1.catch(() => undefined); r2.catch(() => undefined);
    await new Promise<void>((resolve) => {
      const tick = () => (net.calls.some((c) => c.url.endsWith('/auth/refresh')) ? resolve() : setTimeout(tick, 1));
      tick();
    });
    signInB(client);
    net.refreshA.resolve(jsonResponse(401, { error: 'revoked' }));
    await Promise.allSettled([r1, r2]);
    expect(net.calls.filter((c) => c.url.endsWith('/auth/refresh'))).toHaveLength(1);
    expect(store()).toEqual({ access: 'access-B', refresh: 'rt1.B' });
    expect(net.calls.filter((c) => c.url.endsWith('/workouts') && c.auth === 'Bearer access-B')).toHaveLength(0);
  });

  it('control: without a session change the rotated pair is stored and the request is retried', async () => {
    const { client, net, request } = await startRefreshUnderA();
    net.refreshA.resolve(jsonResponse(200, { accessToken: 'access-B', refreshToken: 'rt1.A2' }));
    await expect(request).resolves.toEqual({ who: 'B' });
    expect(store()).toEqual({ access: 'access-B', refresh: 'rt1.A2' });
    expect(client.getToken()).toBe('access-B');
  });
});
