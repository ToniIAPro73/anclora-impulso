import { env } from '../../config/env';
import { OAuthRefusal } from '../oauth.service';

export interface AncloraIdentityConfig {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface AncloraIdentityClaims {
  issuer: string;
  subject: string;
  email: string;
  emailVerified: boolean;
  fullName: string | null;
  platformRoles: string[];
  applicationMemberships: string[];
  applicationRoles: Record<string, string>;
}

export interface AncloraIdentityAccessDecision {
  allowed: boolean;
  reason: 'GROUP_OWNER' | 'APPLICATION_MEMBERSHIP' | 'NO_MEMBERSHIP';
}

type OpenIdClientModule = typeof import('openid-client', { with: { 'resolution-mode': 'import' } });
type JoseModule = typeof import('jose', { with: { 'resolution-mode': 'import' } });
type OpenIdConfiguration = Awaited<ReturnType<OpenIdClientModule['discovery']>>;

let cachedConfigKey: string | null = null;
let cachedOidcConfig: OpenIdConfiguration | null = null;
let cachedJwksUri: string | null = null;
let cachedJwks: ReturnType<JoseModule['createRemoteJWKSet']> | null = null;

async function loadOpenIdClient(): Promise<OpenIdClientModule> {
  try {
    // Works in Node 22.12+/24 and Jest CJS without --experimental-vm-modules.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('openid-client') as OpenIdClientModule;
  } catch {
    // Fallback for Node <22.12 ESM-only environments.
    return Function('return import("openid-client")')() as Promise<OpenIdClientModule>;
  }
}

async function loadJose(): Promise<JoseModule> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('jose') as JoseModule;
  } catch {
    return Function('return import("jose")')() as Promise<JoseModule>;
  }
}

export function clearAncloraIdentityCacheForTests(): void {
  cachedConfigKey = null;
  cachedOidcConfig = null;
  cachedJwksUri = null;
  cachedJwks = null;
}

export function readAncloraIdentityConfig(): AncloraIdentityConfig | null {
  if (!env.ancloraIdentityEnabled) {
    return null;
  }
  if (
    !env.ancloraIdentityIssuerUrl ||
    !env.ancloraIdentityClientId ||
    !env.ancloraIdentityClientSecret ||
    !env.ancloraIdentityRedirectUri
  ) {
    return null;
  }
  return {
    issuerUrl: env.ancloraIdentityIssuerUrl,
    clientId: env.ancloraIdentityClientId,
    clientSecret: env.ancloraIdentityClientSecret,
    redirectUri: env.ancloraIdentityRedirectUri,
  };
}

export async function getAncloraIdentityOidcConfig(
  config: AncloraIdentityConfig,
): Promise<OpenIdConfiguration> {
  const key = `${config.issuerUrl}|${config.clientId}|${config.redirectUri}`;
  if (cachedOidcConfig && cachedConfigKey === key) {
    return cachedOidcConfig;
  }

  const client = await loadOpenIdClient();
  const isLocalHttp = env.nodeEnv !== 'production' && config.issuerUrl.startsWith('http://');
  const discovered = await client.discovery(
    new URL(config.issuerUrl),
    config.clientId,
    config.clientSecret,
    client.ClientSecretBasic(config.clientSecret),
    {
      timeout: 8,
      ...(isLocalHttp ? { execute: [client.allowInsecureRequests] } : {}),
    },
  );

  cachedConfigKey = key;
  cachedOidcConfig = discovered;
  return discovered;
}

export async function createAncloraIdentityAuthorizationRequest(
  config: AncloraIdentityConfig,
): Promise<{ url: string; state: string; codeVerifier: string; nonce: string }> {
  const client = await loadOpenIdClient();
  const oidcConfig = await getAncloraIdentityOidcConfig(config);

  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();
  const nonce = client.randomNonce();

  const authUrl = client.buildAuthorizationUrl(oidcConfig, {
    redirect_uri: config.redirectUri,
    scope: 'openid profile email anclora_platform',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    nonce,
  });

  return {
    url: authUrl.toString(),
    state,
    codeVerifier,
    nonce,
  };
}

export function buildCanonicalCallbackUrl(configuredRedirectUri: string, requestUrl: string): URL {
  const base = new URL(configuredRedirectUri);
  const incoming = new URL(requestUrl, base.origin);
  base.search = incoming.search;
  return base;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string') result[k] = v;
  }
  return result;
}

export function resolveImpulsoIdentityAccess(
  claims: Pick<AncloraIdentityClaims, 'platformRoles' | 'applicationMemberships'>,
): AncloraIdentityAccessDecision {
  if (claims.platformRoles.includes('GROUP_OWNER')) {
    return { allowed: true, reason: 'GROUP_OWNER' };
  }
  if (claims.applicationMemberships.includes('anclora-impulso')) {
    return { allowed: true, reason: 'APPLICATION_MEMBERSHIP' };
  }
  return { allowed: false, reason: 'NO_MEMBERSHIP' };
}

export async function exchangeAncloraIdentityCode(
  config: AncloraIdentityConfig,
  requestUrl: string,
  checks: { expectedState: string; expectedNonce: string; codeVerifier: string },
): Promise<AncloraIdentityClaims> {
  const client = await loadOpenIdClient();
  const oidcConfig = await getAncloraIdentityOidcConfig(config);
  const callbackUrl = buildCanonicalCallbackUrl(config.redirectUri, requestUrl);

  const tokens = await client.authorizationCodeGrant(oidcConfig, callbackUrl, {
    pkceCodeVerifier: checks.codeVerifier,
    expectedState: checks.expectedState,
    expectedNonce: checks.expectedNonce,
  });

  const serverMetadata = oidcConfig.serverMetadata();
  if (typeof tokens.id_token === 'string' && typeof serverMetadata.jwks_uri === 'string') {
    const jose = await loadJose();
    if (!cachedJwks || cachedJwksUri !== serverMetadata.jwks_uri) {
      cachedJwksUri = serverMetadata.jwks_uri;
      cachedJwks = jose.createRemoteJWKSet(new URL(serverMetadata.jwks_uri));
    }
    await jose.jwtVerify(tokens.id_token, cachedJwks, {
      issuer: serverMetadata.issuer ?? config.issuerUrl,
      audience: config.clientId,
    });
  }

  const idClaims = tokens.claims();
  if (!idClaims?.sub || typeof idClaims.sub !== 'string') {
    throw new OAuthRefusal('identity_invalid');
  }

  let mergedClaims: Record<string, unknown> = { ...idClaims };
  if (tokens.access_token) {
    try {
      const userInfo = await client.fetchUserInfo(oidcConfig, tokens.access_token, idClaims.sub);
      mergedClaims = { ...mergedClaims, ...userInfo };
    } catch {
      // Best-effort enrichment: ID token claims already carry validated sub/iss/email/platform claims.
    }
  }

  const emailVerified = mergedClaims.email_verified === true;
  const email = typeof mergedClaims.email === 'string' ? mergedClaims.email.trim() : '';
  if (!emailVerified || !email) {
    throw new OAuthRefusal('email_not_verified');
  }

  const issuer = typeof mergedClaims.iss === 'string' ? mergedClaims.iss : config.issuerUrl;
  const fullName = typeof mergedClaims.name === 'string' && mergedClaims.name.trim().length > 0
    ? mergedClaims.name.trim()
    : null;

  return {
    issuer,
    subject: idClaims.sub,
    email,
    emailVerified,
    fullName,
    platformRoles: asStringArray(mergedClaims.platform_roles),
    applicationMemberships: asStringArray(mergedClaims.application_memberships),
    applicationRoles: asStringRecord(mergedClaims.application_roles),
  };
}

export async function buildAncloraIdentityLogoutUrl(
  config: AncloraIdentityConfig,
  postLogoutRedirectUri?: string,
): Promise<string | null> {
  try {
    const client = await loadOpenIdClient();
    const oidcConfig = await getAncloraIdentityOidcConfig(config);
    const url = client.buildEndSessionUrl(
      oidcConfig,
      postLogoutRedirectUri ? { post_logout_redirect_uri: postLogoutRedirectUri } : undefined,
    );
    return url.toString();
  } catch {
    return null;
  }
}
