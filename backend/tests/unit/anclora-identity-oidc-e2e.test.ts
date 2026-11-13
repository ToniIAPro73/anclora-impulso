import http from 'node:http';
import { createHash, generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { prisma } from '../../src/config/database';
import { clearAncloraIdentityCacheForTests } from '../../src/services/oauth/anclora-identity.provider';
import { issueSession } from '../../src/services/session.service';

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function signRs256Jwt(
  payload: Record<string, unknown>,
  privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'],
  kid: string,
): string {
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid }));
  const body = base64Url(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;
  const signature = sign('RSA-SHA256', Buffer.from(signingInput), privateKey);
  return `${signingInput}.${base64Url(signature)}`;
}

describe('Anclora Identity OIDC Local HTTP E2E', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicJwk = publicKey.export({ format: 'jwk' }) as Record<string, unknown>;
  const kid = 'test-oidc-kid-1';

  let idpServer: http.Server;
  let issuerUrl = '';

  // Configurable IdP behavior per test
  let nextClaims: {
    sub: string;
    email: string;
    email_verified: boolean;
    name: string;
    platform_roles: string[];
    application_memberships: string[];
    tamperSignature?: boolean;
    tamperNonce?: boolean;
  };

  // In-memory store backing mocked Prisma models (zero Neon writes)
  const users = new Map<string, any>();
  const identityLinks = new Map<string, any>(); // key: `${issuer}|${subject}`
  const audits: any[] = [];
  const handoffs = new Map<string, any>();
  const sessions = new Map<string, any>();
  const refreshTokens = new Map<string, any>();

  beforeAll(async () => {
    const authCodes = new Map<string, { nonce: string; codeChallenge: string }>();

    idpServer = http.createServer((req, res) => {
      const reqUrl = new URL(req.url || '/', issuerUrl);

      if (reqUrl.pathname === '/.well-known/openid-configuration') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            issuer: issuerUrl,
            authorization_endpoint: `${issuerUrl}/auth`,
            token_endpoint: `${issuerUrl}/token`,
            userinfo_endpoint: `${issuerUrl}/userinfo`,
            jwks_uri: `${issuerUrl}/jwks`,
            end_session_endpoint: `${issuerUrl}/session/end`,
            response_types_supported: ['code'],
            subject_types_supported: ['public'],
            id_token_signing_alg_values_supported: ['RS256'],
            code_challenge_methods_supported: ['S256'],
            token_endpoint_auth_methods_supported: ['client_secret_basic'],
          }),
        );
        return;
      }

      if (reqUrl.pathname === '/jwks') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            keys: [{ ...publicJwk, kid, use: 'sig', alg: 'RS256' }],
          }),
        );
        return;
      }

      if (reqUrl.pathname === '/auth') {
        const nonce = reqUrl.searchParams.get('nonce') || '';
        const codeChallenge = reqUrl.searchParams.get('code_challenge') || '';
        const code = `auth-code-${randomUUID()}`;
        authCodes.set(code, { nonce, codeChallenge });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code }));
        return;
      }

      if (reqUrl.pathname === '/token' && req.method === 'POST') {
        let rawBody = '';
        req.on('data', (chunk) => {
          rawBody += chunk;
        });
        req.on('end', () => {
          const params = new URLSearchParams(rawBody);
          const code = params.get('code') || '';
          const verifier = params.get('code_verifier') || '';
          const stored = authCodes.get(code);
          authCodes.delete(code);

          if (!stored) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid_grant' }));
            return;
          }

          const expectedChallenge = base64Url(createHash('sha256').update(verifier).digest());
          if (expectedChallenge !== stored.codeChallenge) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'invalid_grant', error_description: 'PKCE mismatch' }));
            return;
          }

          const nowSec = Math.floor(Date.now() / 1000);
          let idToken = signRs256Jwt(
            {
              iss: issuerUrl,
              aud: 'anclora-impulso',
              sub: nextClaims.sub,
              iat: nowSec,
              exp: nowSec + 300,
              nonce: nextClaims.tamperNonce ? 'wrong-nonce' : stored.nonce,
              email: nextClaims.email,
              email_verified: nextClaims.email_verified,
              name: nextClaims.name,
              platform_roles: nextClaims.platform_roles,
              application_memberships: nextClaims.application_memberships,
            },
            privateKey,
            kid,
          );

          if (nextClaims.tamperSignature) {
            const parts = idToken.split('.');
            idToken = `${parts[0]}.${parts[1]}.${base64Url('invalid-signature')}`;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              access_token: `at-${randomUUID()}`,
              token_type: 'Bearer',
              expires_in: 300,
              id_token: idToken,
            }),
          );
        });
        return;
      }

      if (reqUrl.pathname === '/userinfo') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            sub: nextClaims.sub,
            email: nextClaims.email,
            email_verified: nextClaims.email_verified,
            name: nextClaims.name,
            platform_roles: nextClaims.platform_roles,
            application_memberships: nextClaims.application_memberships,
          }),
        );
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => {
      idpServer.listen(0, '127.0.0.1', () => {
        const addr = idpServer.address() as { port: number };
        issuerUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => idpServer.close(() => resolve()));
  });

  let prevEnv: Record<string, any>;

  beforeEach(() => {
    users.clear();
    identityLinks.clear();
    audits.length = 0;
    handoffs.clear();
    sessions.clear();
    refreshTokens.clear();
    clearAncloraIdentityCacheForTests();

    prevEnv = {
      ancloraIdentityEnabled: env.ancloraIdentityEnabled,
      ancloraIdentityIssuerUrl: env.ancloraIdentityIssuerUrl,
      ancloraIdentityClientId: env.ancloraIdentityClientId,
      ancloraIdentityClientSecret: env.ancloraIdentityClientSecret,
      ancloraIdentityRedirectUri: env.ancloraIdentityRedirectUri,
      ancloraIdentityAllowLegacyAuth: env.ancloraIdentityAllowLegacyAuth,
      ancloraIdentityAutoProvision: env.ancloraIdentityAutoProvision,
    };

    env.ancloraIdentityEnabled = true;
    env.ancloraIdentityIssuerUrl = issuerUrl;
    env.ancloraIdentityClientId = 'anclora-impulso';
    env.ancloraIdentityClientSecret = 'test-impulso-secret-32-chars-min!!';
    env.ancloraIdentityRedirectUri = 'http://127.0.0.1:3001/api/auth/anclora-identity/callback';
    env.ancloraIdentityAllowLegacyAuth = true;
    env.ancloraIdentityAutoProvision = true;

    nextClaims = {
      sub: 'identity-sub-1',
      email: 'pilot@anclora.es',
      email_verified: true,
      name: 'Pilot User',
      platform_roles: ['USER'],
      application_memberships: ['anclora-impulso'],
    };

    // Wire in-memory Prisma delegates
    const wireTx = () => ({
      user: {
        create: jest.fn(async ({ data }: any) => {
          const u = { id: randomUUID(), disabledAt: null, createdAt: new Date(), ...data };
          users.set(u.id, u);
          return u;
        }),
        findUnique: jest.fn(async ({ where }: any) => users.get(where.id) || null),
      },
      identityLink: {
        create: jest.fn(async ({ data }: any) => {
          const link = { id: randomUUID(), revokedAt: null, createdAt: new Date(), ...data };
          identityLinks.set(`${data.issuer}|${data.subject}`, link);
          return link;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          for (const [k, v] of identityLinks.entries()) {
            if (v.id === where.id) {
              const updated = { ...v, ...data };
              identityLinks.set(k, updated);
              return updated;
            }
          }
          return null;
        }),
        delete: jest.fn(async ({ where }: any) => {
          for (const [k, v] of identityLinks.entries()) {
            if (v.id === where.id) {
              identityLinks.delete(k);
              return v;
            }
          }
          return null;
        }),
      },
      identityLinkAudit: {
        create: jest.fn(async ({ data }: any) => {
          const row = { id: randomUUID(), createdAt: new Date(), ...data };
          audits.push(row);
          return row;
        }),
      },
      oAuthHandoff: {
        updateMany: jest.fn(async ({ where, data }: any) => {
          const row = handoffs.get(where.codeHash);
          if (!row || row.consumedAt !== null || row.expiresAt <= where.expiresAt.gt) {
            return { count: 0 };
          }
          row.consumedAt = data.consumedAt;
          return { count: 1 };
        }),
        findUnique: jest.fn(async ({ where }: any) => handoffs.get(where.codeHash) || null),
      },
      authSession: {
        create: jest.fn(async ({ data }: any) => {
          const s = { id: randomUUID(), revokedAt: null, revokedReason: null, ...data };
          sessions.set(s.id, s);
          return s;
        }),
      },
      refreshToken: {
        create: jest.fn(async ({ data }: any) => {
          const rt = { id: randomUUID(), usedAt: null, ...data };
          refreshTokens.set(rt.tokenHash, rt);
          return rt;
        }),
      },
    });

    const tx = wireTx();
    jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(tx));
    jest.spyOn(prisma.user, 'findMany').mockImplementation((async ({ where }: any) => {
      const targetEmail = String(where?.email?.equals || '').toLowerCase();
      return [...users.values()].filter((u) => u.email.toLowerCase() === targetEmail);
    }) as any);
    jest.spyOn(prisma.user, 'findUnique').mockImplementation((async ({ where }: any) => {
      const u = users.get(where.id);
      if (!u) return null;
      return { ...u, oauthAccounts: [] };
    }) as any);
    jest.spyOn(prisma.identityLink, 'findUnique').mockImplementation((async ({ where }: any) => {
      const key = `${where.issuer_subject.issuer}|${where.issuer_subject.subject}`;
      const link = identityLinks.get(key);
      if (!link) return null;
      return { ...link, user: users.get(link.userId) };
    }) as any);
    jest.spyOn(prisma.identityLink, 'findFirst').mockImplementation((async ({ where }: any) => {
      for (const link of identityLinks.values()) {
        if (link.userId === where.userId && (!where.issuer || link.issuer === where.issuer) && !link.revokedAt) {
          return link;
        }
      }
      return null;
    }) as any);
    jest.spyOn(prisma.identityLinkAudit, 'create').mockImplementation((async ({ data }: any) => {
      const row = { id: randomUUID(), createdAt: new Date(), ...data };
      audits.push(row);
      return row;
    }) as any);
    jest.spyOn(prisma.oAuthHandoff, 'create').mockImplementation((async ({ data }: any) => {
      const row = { id: randomUUID(), consumedAt: null, ...data };
      handoffs.set(data.codeHash, row);
      return row;
    }) as any);
    jest.spyOn(prisma.authSession, 'create').mockImplementation((async ({ data }: any) => {
      const s = { id: randomUUID(), revokedAt: null, revokedReason: null, ...data };
      sessions.set(s.id, s);
      return s;
    }) as any);
    jest.spyOn(prisma.refreshToken, 'create').mockImplementation((async ({ data }: any) => {
      const rt = { id: randomUUID(), usedAt: null, ...data };
      refreshTokens.set(rt.tokenHash, rt);
      return rt;
    }) as any);
    jest.spyOn(prisma.authSession, 'findUnique').mockImplementation((async ({ where }: any) => {
      const s = sessions.get(where.id);
      if (!s) return null;
      return { ...s, user: users.get(s.userId) };
    }) as any);
    jest.spyOn(prisma.authSession, 'updateMany').mockImplementation((async ({ where, data }: any) => {
      const s = sessions.get(where.id);
      if (!s || s.revokedAt !== null) return { count: 0 };
      s.revokedAt = data.revokedAt;
      s.revokedReason = data.revokedReason;
      return { count: 1 };
    }) as any);
    jest.spyOn(prisma.refreshToken, 'findUnique').mockImplementation((async ({ where }: any) => {
      const rt = refreshTokens.get(where.tokenHash);
      if (!rt) return null;
      return { ...rt, session: sessions.get(rt.sessionId) };
    }) as any);
  });

  afterEach(() => {
    Object.assign(env, prevEnv);
    jest.restoreAllMocks();
  });

  async function runOidcLoginFlow(linkToken?: string) {
    const verifier = base64Url(Buffer.alloc(32, 7));
    const challenge = base64Url(createHash('sha256').update(verifier).digest());

    const loginQuery = new URLSearchParams({ challenge, ...(linkToken ? { linkToken } : {}) });
    const loginRes = await request(app).get(`/api/auth/anclora-identity/login?${loginQuery.toString()}`);
    expect(loginRes.status).toBe(302);

    const txnCookies = loginRes.headers['set-cookie'];
    const authUrl = new URL(loginRes.headers.location);
    expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authUrl.searchParams.get('nonce')).toBeTruthy();

    // Hit local IdP /auth endpoint to obtain real authorization code
    const idpResp = await fetch(authUrl.toString());
    const { code } = (await idpResp.json()) as { code: string };
    const state = authUrl.searchParams.get('state')!;

    const cbRes = await request(app)
      .get(`/api/auth/anclora-identity/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`)
      .set('Cookie', txnCookies);

    return { cbRes, verifier };
  }

  it('completes full PKCE + nonce + JWKS OIDC flow, accesses /me, and revokes session on logout', async () => {
    const { cbRes, verifier } = await runOidcLoginFlow();
    expect(cbRes.status).toBe(302);
    expect(cbRes.headers.location).toContain('/auth/callback#code=');

    const hash = cbRes.headers.location.split('#')[1];
    const handoffCode = new URLSearchParams(hash).get('code')!;

    const exchangeRes = await request(app)
      .post('/api/auth/oauth/exchange')
      .send({ code: handoffCode, verifier, provider: 'anclora-identity' });
    expect(exchangeRes.status).toBe(200);
    expect(exchangeRes.body.user.email).toBe('pilot@anclora.es');
    expect(exchangeRes.body.user.isAdmin).toBe(false);
    const accessToken = exchangeRes.body.accessToken as string;

    // Access protected /api/auth/me
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe('pilot@anclora.es');

    // Logout & verify session revocation
    const logoutRes = await request(app)
      .post('/api/auth/anclora-identity/logout')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.ok).toBe(true);
    expect(logoutRes.body.endSessionUrl).toContain(`${issuerUrl}/session/end`);

    const meAfterLogout = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(meAfterLogout.status).toBe(401);
  });

  it('rejects tampered ID token signatures and nonce mismatches', async () => {
    nextClaims.tamperSignature = true;
    const sigRes = await runOidcLoginFlow();
    expect(sigRes.cbRes.status).toBe(302);
    expect(sigRes.cbRes.headers.location).toContain('reason=exchange');

    nextClaims.tamperSignature = false;
    nextClaims.tamperNonce = true;
    const nonceRes = await runOidcLoginFlow();
    expect(nonceRes.cbRes.status).toBe(302);
    expect(nonceRes.cbRes.headers.location).toContain('reason=exchange');
  });

  it('denies users without anclora-impulso membership or unverified email', async () => {
    nextClaims.application_memberships = ['data-lab'];
    const deniedRes = await runOidcLoginFlow();
    expect(deniedRes.cbRes.headers.location).toContain('reason=membership_required');

    nextClaims.application_memberships = ['anclora-impulso'];
    nextClaims.email_verified = false;
    const unverifiedRes = await runOidcLoginFlow();
    expect(unverifiedRes.cbRes.headers.location).toContain('reason=email_not_verified');
  });

  it('blocks automatic email linking and completes explicit authenticated linking + unlinking preserving userId', async () => {
    const existingUserId = randomUUID();
    users.set(existingUserId, {
      id: existingUserId,
      email: 'pilot@anclora.es',
      passwordHash: 'bcrypt-hash-present',
      fullName: 'Existing Impulso User',
      disabledAt: null,
    });

    // 1. Direct OIDC login must refuse auto-linking by email
    const blocked = await runOidcLoginFlow();
    expect(blocked.cbRes.headers.location).toContain('reason=link_requires_original_method');
    expect(audits.some((a) => a.action === 'LOGIN_DENIED' && a.userId === existingUserId)).toBe(true);

    // 2. Simulate active Impulso session for existing user and initiate explicit link
    const localSession = await issueSession({ id: existingUserId, email: 'pilot@anclora.es' });

    const initRes = await request(app)
      .post('/api/auth/anclora-identity/link/init')
      .set('Authorization', `Bearer ${localSession.accessToken}`);
    expect(initRes.status).toBe(200);
    expect(initRes.body.linkToken).toBeTruthy();

    const linked = await runOidcLoginFlow(initRes.body.linkToken);
    expect(linked.cbRes.headers.location).toContain('/auth/callback#code=');
    const handoffCode = new URLSearchParams(linked.cbRes.headers.location.split('#')[1]).get('code')!;

    const redeemRes = await request(app)
      .post('/api/auth/oauth/exchange')
      .send({ code: handoffCode, verifier: linked.verifier, provider: 'anclora-identity' });
    expect(redeemRes.status).toBe(200);
    expect(redeemRes.body.user.id).toBe(existingUserId);

    // 3. Verify link status & unlink
    const statusRes = await request(app)
      .get('/api/auth/anclora-identity/link')
      .set('Authorization', `Bearer ${localSession.accessToken}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.linked).toBe(true);

    const unlinkRes = await request(app)
      .delete('/api/auth/anclora-identity/link')
      .set('Authorization', `Bearer ${localSession.accessToken}`);
    expect(unlinkRes.status).toBe(200);
    expect(unlinkRes.body.unlinked).toBe(true);
    expect(audits.some((a) => a.action === 'UNLINKED' && a.userId === existingUserId)).toBe(true);
  });
});
