/** @jest-environment jsdom */

type Json = Record<string, unknown>;

function jsonResponse(status: number, body: Json = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

async function loadClient() {
  jest.resetModules();
  const mod = await import('@/lib/api/client');
  return mod.apiClient;
}

describe('api client session refresh', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('accessToken', 'old-access');
    localStorage.setItem('refreshToken', 'rt1.old');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('refreshes once on 401, stores the rotated pair and retries the request', async () => {
    const calls: Array<{ url: string; auth: string | null }> = [];
    global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({ url: String(url), auth: headers.get('Authorization') });
      if (String(url).endsWith('/auth/refresh')) return jsonResponse(200, { accessToken: 'new-access', refreshToken: 'rt1.new' });
      return headers.get('Authorization') === 'Bearer new-access' ? jsonResponse(200, { ok: true }) : jsonResponse(401, { error: 'Token expirado' });
    }) as unknown as typeof fetch;

    const client = await loadClient();
    await expect(client.get('/workouts')).resolves.toEqual({ ok: true });
    expect(localStorage.getItem('refreshToken')).toBe('rt1.new');
    expect(localStorage.getItem('accessToken')).toBe('new-access');
    expect(calls.filter((c) => c.url.endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('shares one refresh between concurrent 401s (single-flight)', async () => {
    let refreshCalls = 0;
    global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (String(url).endsWith('/auth/refresh')) {
        refreshCalls += 1;
        await new Promise((r) => setTimeout(r, 20));
        return jsonResponse(200, { accessToken: 'new-access', refreshToken: 'rt1.new' });
      }
      return headers.get('Authorization') === 'Bearer new-access' ? jsonResponse(200, {}) : jsonResponse(401, {});
    }) as unknown as typeof fetch;

    const client = await loadClient();
    await Promise.all([client.get('/a'), client.get('/b'), client.get('/c')]);
    expect(refreshCalls).toBe(1);
  });

  it('clears the dead session when the refresh is rejected and surfaces the original error', async () => {
    global.fetch = jest.fn(async (url: RequestInfo | URL) =>
      String(url).endsWith('/auth/refresh') ? jsonResponse(401, { error: 'Sesión revocada' }) : jsonResponse(401, { error: 'Token expirado' }),
    ) as unknown as typeof fetch;

    const client = await loadClient();
    await expect(client.get('/workouts')).rejects.toThrow('Token expirado');
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
  });

  it('keeps the session on a network failure during refresh', async () => {
    global.fetch = jest.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith('/auth/refresh')) throw new TypeError('network');
      return jsonResponse(401, { error: 'Token expirado' });
    }) as unknown as typeof fetch;

    const client = await loadClient();
    await expect(client.get('/workouts')).rejects.toThrow('Token expirado');
    expect(localStorage.getItem('refreshToken')).toBe('rt1.old');
  });

  it('refreshes for /auth/me (session check) but not for credential endpoints', async () => {
    const fetchMock = jest.fn(async () => jsonResponse(401, { error: 'Email o contraseña incorrectos' }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const client = await loadClient();
    await expect(client.post('/auth/login', { email: 'a', password: 'b' })).rejects.toThrow('Email o contraseña incorrectos');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const urls: string[] = [];
    global.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      urls.push(String(url));
      if (String(url).endsWith('/auth/refresh')) return jsonResponse(200, { accessToken: 'new', refreshToken: 'rt1.new' });
      return new Headers(init?.headers).get('Authorization') === 'Bearer new' ? jsonResponse(200, { id: 'u' }) : jsonResponse(401, {});
    }) as unknown as typeof fetch;
    await expect(client.get('/auth/me')).resolves.toEqual({ id: 'u' });
    expect(urls.filter((u) => u.endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('logout revokes on the server with both tokens before clearing locally', async () => {
    const fetchMock = jest.fn(async () => jsonResponse(200, {}));
    global.fetch = fetchMock as unknown as typeof fetch;
    const client = await loadClient();
    await client.revokeSessionOnServer();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url.endsWith('/auth/logout')).toBe(true);
    expect(JSON.parse(String(init.body))).toEqual({ refreshToken: 'rt1.old' });
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer old-access');
  });
});
