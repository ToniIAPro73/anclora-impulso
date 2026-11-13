import request from 'supertest';
import { env } from '../../src/config/env';
import { prisma } from '../../src/config/database';
import {
  buildCanonicalCallbackUrl,
  readAncloraIdentityConfig,
  readPilotAllowlist,
  resolveImpulsoIdentityAccess,
  resolvePilotCallbackAccess,
} from '../../src/services/oauth/anclora-identity.provider';
import {
  createLinkIntentToken,
  linkAuthenticatedUser,
  resolveIdentityLogin,
  unlinkAuthenticatedUser,
  verifyLinkIntentToken,
} from '../../src/services/identity-link.service';
import { OAuthRefusal } from '../../src/services/oauth.service';
import { isAdminUserId } from '../../src/middleware/admin';
import app from '../../src/app';

describe('Anclora Identity OIDC integration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('resolveImpulsoIdentityAccess', () => {
    it('allows GROUP_OWNER', () => {
      expect(
        resolveImpulsoIdentityAccess({
          platformRoles: ['GROUP_OWNER'],
          applicationMemberships: [],
        }),
      ).toEqual({ allowed: true, reason: 'GROUP_OWNER' });
    });

    it('allows explicit anclora-impulso application membership', () => {
      expect(
        resolveImpulsoIdentityAccess({
          platformRoles: ['USER'],
          applicationMemberships: ['anclora-impulso'],
        }),
      ).toEqual({ allowed: true, reason: 'APPLICATION_MEMBERSHIP' });
    });

    it('denies PLATFORM_ADMIN without anclora-impulso membership', () => {
      expect(
        resolveImpulsoIdentityAccess({
          platformRoles: ['PLATFORM_ADMIN'],
          applicationMemberships: ['data-lab'],
        }),
      ).toEqual({ allowed: false, reason: 'NO_MEMBERSHIP' });
    });

    it('never grants local Impulso admin privilege from Identity roles alone', () => {
      expect(isAdminUserId('11111111-1111-1111-1111-111111111111')).toBe(false);
    });
  });

  describe('buildCanonicalCallbackUrl', () => {
    it('preserves configured redirectUri origin/path and attaches incoming query params', () => {
      const url = buildCanonicalCallbackUrl(
        'https://api.impulso.anclora.com/api/auth/anclora-identity/callback',
        '/api/auth/anclora-identity/callback?code=abc&state=xyz',
      );
      expect(url.toString()).toBe(
        'https://api.impulso.anclora.com/api/auth/anclora-identity/callback?code=abc&state=xyz',
      );
    });
  });

  describe('link intent tokens', () => {
    it('verifies valid tokens and rejects tampered or expired tokens', () => {
      const now = 1_700_000_000_000;
      const token = createLinkIntentToken('user-123', now);
      expect(verifyLinkIntentToken(token, now + 1000)).toBe('user-123');
      expect(verifyLinkIntentToken(`${token}x`, now + 1000)).toBeNull();
      expect(verifyLinkIntentToken(token, now + 6 * 60 * 1000)).toBeNull();
    });
  });

  describe('resolveIdentityLogin', () => {
    it('resolves an already-linked active user without email matching', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'toni@anclora.es',
        fullName: 'Toni',
        disabledAt: null,
      };
      jest.spyOn(prisma.identityLink, 'findUnique').mockResolvedValue({
        id: 'link-1',
        userId: 'user-1',
        issuer: 'https://anclora-identity.anclora.com',
        subject: 'sub-1',
        revokedAt: null,
        user: mockUser,
      } as never);

      const resolved = await resolveIdentityLogin({
        issuer: 'https://anclora-identity.anclora.com',
        subject: 'sub-1',
        email: 'toni@anclora.es',
        fullName: 'Toni',
      });
      expect(resolved).toEqual(mockUser);
    });

    it('refuses automatic email linking when a local user already exists without an IdentityLink', async () => {
      jest.spyOn(prisma.identityLink, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.user, 'findMany').mockResolvedValue([
        { id: 'existing-user', email: 'toni@anclora.es', fullName: 'Toni', disabledAt: null },
      ] as never);
      const auditSpy = jest.spyOn(prisma.identityLinkAudit, 'create').mockResolvedValue({} as never);

      await expect(
        resolveIdentityLogin({
          issuer: 'https://anclora-identity.anclora.com',
          subject: 'sub-new',
          email: 'toni@anclora.es',
          fullName: 'Toni',
        }),
      ).rejects.toThrow(new OAuthRefusal('link_requires_original_method'));

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'existing-user',
            action: 'LOGIN_DENIED',
            reason: 'link_requires_explicit_link',
          }),
        }),
      );
    });

    it('provisions a new user + IdentityLink + audit log when no local account exists and auto-provision is explicitly enabled', async () => {
      const prevAutoProvision = env.ancloraIdentityAutoProvision;
      env.ancloraIdentityAutoProvision = true;
      try {
        jest.spyOn(prisma.identityLink, 'findUnique').mockResolvedValue(null);
        jest.spyOn(prisma.user, 'findMany').mockResolvedValue([] as never);
        const createdUser = { id: 'new-user', email: 'new@anclora.es', fullName: 'New User', disabledAt: null };
        const txMock = {
          user: { create: jest.fn().mockResolvedValue(createdUser as never) },
          identityLink: { create: jest.fn().mockResolvedValue({} as never) },
          identityLinkAudit: { create: jest.fn().mockResolvedValue({} as never) },
        };
        jest.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => cb(txMock));

        const resolved = await resolveIdentityLogin({
          issuer: 'https://anclora-identity.anclora.com',
          subject: 'sub-brand-new',
          email: 'new@anclora.es',
          fullName: 'New User',
        });

        expect(resolved).toEqual(createdUser);
        expect(txMock.identityLink.create).toHaveBeenCalledTimes(1);
        expect(txMock.identityLinkAudit.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ action: 'LINKED', reason: 'oidc_provision' }),
          }),
        );
      } finally {
        env.ancloraIdentityAutoProvision = prevAutoProvision;
      }
    });
  });

  describe('linkAuthenticatedUser & unlinkAuthenticatedUser', () => {
    it('prevents linking a subject already owned by a different user', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'user-a',
        email: 'a@anclora.es',
        fullName: 'A',
        disabledAt: null,
      } as never);
      jest.spyOn(prisma.identityLink, 'findUnique').mockResolvedValue({
        id: 'link-x',
        userId: 'user-b',
        revokedAt: null,
      } as never);

      await expect(
        linkAuthenticatedUser({
          userId: 'user-a',
          issuer: 'https://anclora-identity.anclora.com',
          subject: 'sub-b',
          email: 'a@anclora.es',
        }),
      ).rejects.toThrow(new OAuthRefusal('account_conflict'));
    });

    it('prevents unlinking when user has no alternative authentication method', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'user-only-oidc',
        passwordHash: null,
        oauthAccounts: [],
      } as never);

      await expect(
        unlinkAuthenticatedUser({
          userId: 'user-only-oidc',
          issuer: 'https://anclora-identity.anclora.com',
        }),
      ).rejects.toThrow(new OAuthRefusal('link_requires_original_method'));
    });
  });

  describe('HTTP endpoints & fail-closed feature flags', () => {
    it('GET /api/auth/anclora-identity/status reports enabled state', async () => {
      const res = await request(app).get('/api/auth/anclora-identity/status');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('enabled');
      expect(res.body).toHaveProperty('allowLegacyAuth');
    });

    it('GET /api/auth/anclora-identity/callback rejects missing transaction cookie with retry', async () => {
      const prevEnabled = env.ancloraIdentityEnabled;
      const prevIssuer = env.ancloraIdentityIssuerUrl;
      const prevSecret = env.ancloraIdentityClientSecret;
      const prevRedirect = env.ancloraIdentityRedirectUri;
      const prevSubjects = env.ancloraIdentityPilotAllowedSubjectsRaw;

      env.ancloraIdentityEnabled = true;
      env.ancloraIdentityIssuerUrl = 'https://anclora-identity.anclora.com';
      env.ancloraIdentityClientSecret = 'test-secret-1234567890';
      env.ancloraIdentityRedirectUri = 'http://localhost:3001/api/auth/anclora-identity/callback';
      env.ancloraIdentityPilotAllowedSubjectsRaw = 'https://anclora-identity.anclora.com|sub-1';

      try {
        const res = await request(app).get('/api/auth/anclora-identity/callback?code=c&state=s');
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('/auth/error?provider=anclora-identity&reason=retry');
      } finally {
        env.ancloraIdentityEnabled = prevEnabled;
        env.ancloraIdentityIssuerUrl = prevIssuer;
        env.ancloraIdentityClientSecret = prevSecret;
        env.ancloraIdentityRedirectUri = prevRedirect;
        env.ancloraIdentityPilotAllowedSubjectsRaw = prevSubjects;
      }
    });

    it('POST /api/auth/login fails closed with 409 when Identity is enabled and legacy auth is disabled', async () => {
      const prevEnabled = env.ancloraIdentityEnabled;
      const prevLegacy = env.ancloraIdentityAllowLegacyAuth;
      env.ancloraIdentityEnabled = true;
      env.ancloraIdentityAllowLegacyAuth = false;

      try {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 'toni@anclora.es', password: 'password123' });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('ANCLORA_IDENTITY_ENABLED');
      } finally {
        env.ancloraIdentityEnabled = prevEnabled;
        env.ancloraIdentityAllowLegacyAuth = prevLegacy;
      }
    });

    it('keeps Anclora Identity disabled and allowlist fail-closed when allowlist is empty or malformed', async () => {
      const prevEnabled = env.ancloraIdentityEnabled;
      const prevIssuer = env.ancloraIdentityIssuerUrl;
      const prevSecret = env.ancloraIdentityClientSecret;
      const prevRedirect = env.ancloraIdentityRedirectUri;
      const prevSubjects = env.ancloraIdentityPilotAllowedSubjectsRaw;
      const prevEmails = env.ancloraIdentityPilotBootstrapEmailsRaw;

      env.ancloraIdentityEnabled = true;
      env.ancloraIdentityIssuerUrl = 'https://anclora-identity.anclora.com';
      env.ancloraIdentityClientSecret = 'test-secret-1234567890';
      env.ancloraIdentityRedirectUri = 'http://localhost:3001/api/auth/anclora-identity/callback';
      env.ancloraIdentityPilotAllowedSubjectsRaw = '';
      env.ancloraIdentityPilotBootstrapEmailsRaw = '';

      try {
        expect(readPilotAllowlist().valid).toBe(false);
        expect(readAncloraIdentityConfig()).toBeNull();
        const emptyStatus = await request(app).get('/api/auth/anclora-identity/status');
        expect(emptyStatus.status).toBe(200);
        expect(emptyStatus.body.enabled).toBe(false);

        env.ancloraIdentityPilotAllowedSubjectsRaw = 'malformed-entry-without-pipe';
        expect(readPilotAllowlist().valid).toBe(false);
        expect(readAncloraIdentityConfig()).toBeNull();

        env.ancloraIdentityPilotAllowedSubjectsRaw = '';
        env.ancloraIdentityPilotBootstrapEmailsRaw = 'not-an-email';
        expect(readPilotAllowlist().valid).toBe(false);
        expect(readAncloraIdentityConfig()).toBeNull();
      } finally {
        env.ancloraIdentityEnabled = prevEnabled;
        env.ancloraIdentityIssuerUrl = prevIssuer;
        env.ancloraIdentityClientSecret = prevSecret;
        env.ancloraIdentityRedirectUri = prevRedirect;
        env.ancloraIdentityPilotAllowedSubjectsRaw = prevSubjects;
        env.ancloraIdentityPilotBootstrapEmailsRaw = prevEmails;
      }
    });

    it('enforces subject allowlist and restricts bootstrap email to explicit link or linked account', () => {
      const prevSubjects = env.ancloraIdentityPilotAllowedSubjectsRaw;
      const prevEmails = env.ancloraIdentityPilotBootstrapEmailsRaw;
      env.ancloraIdentityPilotAllowedSubjectsRaw = 'https://anclora-identity.anclora.com|sub-pilot';
      env.ancloraIdentityPilotBootstrapEmailsRaw = 'bootstrap@anclora.es';

      try {
        expect(
          resolvePilotCallbackAccess({
            issuer: 'https://anclora-identity.anclora.com/',
            subject: 'sub-pilot',
            email: 'other@anclora.es',
            emailVerified: true,
            isExplicitLink: false,
            hasActiveLink: false,
          }),
        ).toEqual({ allowed: true, mode: 'subject' });

        // Unlinked bootstrap email cannot bypass explicit linking
        expect(
          resolvePilotCallbackAccess({
            issuer: 'https://anclora-identity.anclora.com',
            subject: 'sub-new',
            email: 'bootstrap@anclora.es',
            emailVerified: true,
            isExplicitLink: false,
            hasActiveLink: false,
          }),
        ).toEqual({ allowed: false, mode: 'denied' });

        // Unverified bootstrap email is always denied even on explicit link
        expect(
          resolvePilotCallbackAccess({
            issuer: 'https://anclora-identity.anclora.com',
            subject: 'sub-new',
            email: 'bootstrap@anclora.es',
            emailVerified: false,
            isExplicitLink: true,
            hasActiveLink: false,
          }),
        ).toEqual({ allowed: false, mode: 'denied' });

        // Verified bootstrap email on explicit link is allowed for first admission
        expect(
          resolvePilotCallbackAccess({
            issuer: 'https://anclora-identity.anclora.com',
            subject: 'sub-new',
            email: 'bootstrap@anclora.es',
            emailVerified: true,
            isExplicitLink: true,
            hasActiveLink: false,
          }),
        ).toEqual({ allowed: true, mode: 'bootstrap_link' });
      } finally {
        env.ancloraIdentityPilotAllowedSubjectsRaw = prevSubjects;
        env.ancloraIdentityPilotBootstrapEmailsRaw = prevEmails;
      }
    });

    it('allows traditional POST /api/auth/login when ANCLORA_IDENTITY_ALLOW_LEGACY_AUTH=true', async () => {
      const prevEnabled = env.ancloraIdentityEnabled;
      const prevLegacy = env.ancloraIdentityAllowLegacyAuth;
      env.ancloraIdentityEnabled = true;
      env.ancloraIdentityAllowLegacyAuth = true;

      try {
        // Missing password/invalid payload reaches normal validator (not 409 blocked)
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 'not-an-email', password: '' });
        expect(res.status).not.toBe(409);
      } finally {
        env.ancloraIdentityEnabled = prevEnabled;
        env.ancloraIdentityAllowLegacyAuth = prevLegacy;
      }
    });
  });
});
