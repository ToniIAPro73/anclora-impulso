import type { Request, Response } from 'express';
import { env } from '../config/env';
import logger from '../config/logger';
import { redactText } from '../utils/redact';
import { createOAuthTransaction, oauthStatesMatch, type OAuthTransaction } from '../utils/pkce';
import {
  readGoogleOAuthConfig,
  createGoogleAuthorizationUrl,
  fetchGoogleProfile,
} from '../services/oauth/google.provider';
import {
  readGitHubOAuthConfig,
  createGitHubAuthorizationUrl,
  fetchGitHubProfile,
} from '../services/oauth/github.provider';
import { resolveOAuthAccount, OAuthRefusal } from '../services/oauth.service';
import {
  buildAncloraIdentityLogoutUrl,
  createAncloraIdentityAuthorizationRequest,
  exchangeAncloraIdentityCode,
  readAncloraIdentityConfig,
  resolveImpulsoIdentityAccess,
} from '../services/oauth/anclora-identity.provider';
import {
  createLinkIntentToken,
  getIdentityLinkStatus,
  linkAuthenticatedUser,
  resolveIdentityLogin,
  unlinkAuthenticatedUser,
  verifyLinkIntentToken,
} from '../services/identity-link.service';
import { createOAuthHandoff, redeemOAuthHandoff, HANDOFF_CHALLENGE_PATTERN } from '../services/oauth-handoff.service';
import { clearRefreshTokenCookie, extractRefreshToken, setRefreshTokenCookie } from '../utils/refresh-cookie';
import { verifyAccessTokenIgnoringExpiry } from '../utils/jwt';
import { revokeByRefreshToken, revokeSession } from '../services/session.service';

const COOKIE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutos, tiempo de vida del handshake PKCE

function frontendUrl(): string {
  return env.frontendUrls[0] ?? 'http://localhost:3000';
}

function setTransactionCookie(res: Response, name: string, transaction: OAuthTransaction) {
  res.cookie(name, JSON.stringify(transaction), {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/api/auth',
  });
}

function readTransactionCookie(req: Request, name: string): OAuthTransaction | null {
  const raw = req.cookies?.[name];
  if (!raw) return null;

  try {
    return JSON.parse(raw) as OAuthTransaction;
  } catch {
    return null;
  }
}

export function googleRedirect(req: Request, res: Response) {
  if (env.ancloraIdentityEnabled && !env.ancloraIdentityAllowLegacyAuth) {
    res.status(409).json({ code: 'ANCLORA_IDENTITY_ENABLED', error: 'Usa Anclora Identity para iniciar sesión.' });
    return;
  }
  const config = readGoogleOAuthConfig();

  if (!config) {
    res.status(503).json({ error: 'Login con Google no está configurado en este entorno' });
    return;
  }

  const challenge = req.query.challenge;
  if (typeof challenge !== 'string' || !HANDOFF_CHALLENGE_PATTERN.test(challenge)) {
    res.redirect(`${frontendUrl()}/auth/error?provider=google`);
    return;
  }

  const transaction = { ...createOAuthTransaction(), handoffChallenge: challenge };
  setTransactionCookie(res, 'oauth_google_txn', transaction);
  res.redirect(createGoogleAuthorizationUrl(config, transaction));
}

export async function googleCallback(req: Request, res: Response) {
  const config = readGoogleOAuthConfig();
  const transaction = readTransactionCookie(req, 'oauth_google_txn');
  res.clearCookie('oauth_google_txn', { path: '/api/auth' });

  if (!config || !transaction) {
    res.redirect(`${frontendUrl()}/auth/error?provider=google`);
    return;
  }

  const { code, state } = req.query;

  if (typeof code !== 'string' || !oauthStatesMatch(transaction.state, typeof state === 'string' ? state : undefined)) {
    res.redirect(`${frontendUrl()}/auth/error?provider=google`);
    return;
  }

  try {
    const profile = await fetchGoogleProfile(config, code, transaction.codeVerifier);
    const user = await resolveOAuthAccount({ provider: 'google', ...profile });
    // No session and no token leave this callback: only a one-time code bound to the browser's own challenge.
    const handoffCode = await createOAuthHandoff({
      userId: user.id,
      provider: 'google',
      challenge: transaction.handoffChallenge ?? '',
    });
    res.redirect(`${frontendUrl()}/auth/callback#code=${encodeURIComponent(handoffCode)}&provider=google`);
  } catch (error) {
    const refusal = error instanceof OAuthRefusal ? ` (${error.code})` : '';
    logger.error(`Google OAuth callback failed${refusal}`, { error: redactText((error as Error).message) });
    res.redirect(`${frontendUrl()}/auth/error?provider=google`);
  }
}

export function githubRedirect(req: Request, res: Response) {
  if (env.ancloraIdentityEnabled && !env.ancloraIdentityAllowLegacyAuth) {
    res.status(409).json({ code: 'ANCLORA_IDENTITY_ENABLED', error: 'Usa Anclora Identity para iniciar sesión.' });
    return;
  }
  const config = readGitHubOAuthConfig();

  if (!config) {
    res.status(503).json({ error: 'Login con GitHub no está configurado en este entorno' });
    return;
  }

  const challenge = req.query.challenge;
  if (typeof challenge !== 'string' || !HANDOFF_CHALLENGE_PATTERN.test(challenge)) {
    res.redirect(`${frontendUrl()}/auth/error?provider=github`);
    return;
  }

  const transaction = { ...createOAuthTransaction(), handoffChallenge: challenge };
  setTransactionCookie(res, 'oauth_github_txn', transaction);
  res.redirect(createGitHubAuthorizationUrl(config, transaction));
}

export async function githubCallback(req: Request, res: Response) {
  const config = readGitHubOAuthConfig();
  const transaction = readTransactionCookie(req, 'oauth_github_txn');
  res.clearCookie('oauth_github_txn', { path: '/api/auth' });

  if (!config || !transaction) {
    res.redirect(`${frontendUrl()}/auth/error?provider=github`);
    return;
  }

  const { code, state } = req.query;

  if (typeof code !== 'string' || !oauthStatesMatch(transaction.state, typeof state === 'string' ? state : undefined)) {
    res.redirect(`${frontendUrl()}/auth/error?provider=github`);
    return;
  }

  try {
    const profile = await fetchGitHubProfile(config, code, transaction.codeVerifier);
    const user = await resolveOAuthAccount({ provider: 'github', ...profile });
    // No session and no token leave this callback: only a one-time code bound to the browser's own challenge.
    const handoffCode = await createOAuthHandoff({
      userId: user.id,
      provider: 'github',
      challenge: transaction.handoffChallenge ?? '',
    });
    res.redirect(`${frontendUrl()}/auth/callback#code=${encodeURIComponent(handoffCode)}&provider=github`);
  } catch (error) {
    const refusal = error instanceof OAuthRefusal ? ` (${error.code})` : '';
    logger.error(`GitHub OAuth callback failed${refusal}`, { error: redactText((error as Error).message) });
    res.redirect(`${frontendUrl()}/auth/error?provider=github`);
  }
}

/**
 * POST /api/auth/oauth/exchange { code, verifier, provider } -> session tokens.
 * The browser proves it is the one that started the flow by presenting the verifier of its challenge.
 */
export async function exchangeOAuthHandoff(req: Request, res: Response, next: (error?: unknown) => void) {
  try {
    const { code, verifier, provider } = (req.body ?? {}) as Record<string, unknown>;
    const auth = await redeemOAuthHandoff({ code, verifier, provider });
    setRefreshTokenCookie(res, auth.refreshToken);
    res.setHeader('Cache-Control', 'no-store');
    res.json(auth);
  } catch (error) {
    next(error);
  }
}

interface AncloraIdentityTransaction {
  state: string;
  codeVerifier: string;
  nonce: string;
  handoffChallenge: string;
  linkUserId?: string;
}

const IDENTITY_TXN_COOKIE = 'oauth_anclora_identity_txn';

function setIdentityTransactionCookie(res: Response, transaction: AncloraIdentityTransaction) {
  res.cookie(IDENTITY_TXN_COOKIE, JSON.stringify(transaction), {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.nodeEnv === 'production',
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/api/auth',
  });
}

function readIdentityTransactionCookie(req: Request): AncloraIdentityTransaction | null {
  const raw = req.cookies?.[IDENTITY_TXN_COOKIE];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AncloraIdentityTransaction>;
    if (
      typeof parsed.state !== 'string' ||
      typeof parsed.codeVerifier !== 'string' ||
      typeof parsed.nonce !== 'string'
    ) {
      return null;
    }
    return parsed as AncloraIdentityTransaction;
  } catch {
    return null;
  }
}

export function ancloraIdentityStatus(_req: Request, res: Response) {
  const config = readAncloraIdentityConfig();
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    enabled: Boolean(config),
    allowLegacyAuth: env.ancloraIdentityAllowLegacyAuth,
  });
}

export async function initAncloraIdentityLink(req: Request, res: Response) {
  const config = readAncloraIdentityConfig();
  if (!config) {
    res.status(503).json({ error: 'Anclora Identity no está configurado en este entorno' });
    return;
  }
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Autenticación requerida' });
    return;
  }
  const linkToken = createLinkIntentToken(userId);
  res.setHeader('Cache-Control', 'no-store');
  res.json({ linkToken });
}

export async function getAncloraIdentityLink(req: Request, res: Response, next: (error?: unknown) => void) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Autenticación requerida' });
      return;
    }
    const link = await getIdentityLinkStatus(userId, env.ancloraIdentityIssuerUrl || undefined);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ linked: Boolean(link), link });
  } catch (error) {
    next(error);
  }
}

export async function unlinkAncloraIdentity(req: Request, res: Response, next: (error?: unknown) => void) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Autenticación requerida' });
      return;
    }
    const config = readAncloraIdentityConfig();
    const issuer = config?.issuerUrl || env.ancloraIdentityIssuerUrl;
    if (!issuer) {
      res.status(503).json({ error: 'Anclora Identity no está configurado en este entorno' });
      return;
    }
    const result = await unlinkAuthenticatedUser({ userId, issuer });
    res.json(result);
  } catch (error) {
    if (error instanceof OAuthRefusal) {
      res.status(409).json({ code: error.code, error: 'No puedes desvincular tu único método de acceso.' });
      return;
    }
    next(error);
  }
}

export async function ancloraIdentityRedirect(req: Request, res: Response) {
  const config = readAncloraIdentityConfig();
  if (!config) {
    res.status(503).json({ error: 'Anclora Identity no está configurado en este entorno' });
    return;
  }

  const challenge = req.query.challenge;
  if (typeof challenge !== 'string' || !HANDOFF_CHALLENGE_PATTERN.test(challenge)) {
    res.redirect(`${frontendUrl()}/auth/error?provider=anclora-identity&reason=retry`);
    return;
  }

  let linkUserId: string | undefined;
  if (req.query.linkToken !== undefined) {
    const verifiedUserId = verifyLinkIntentToken(req.query.linkToken);
    if (!verifiedUserId) {
      res.redirect(`${frontendUrl()}/auth/error?provider=anclora-identity&reason=retry`);
      return;
    }
    linkUserId = verifiedUserId;
  }

  try {
    const authRequest = await createAncloraIdentityAuthorizationRequest(config);
    setIdentityTransactionCookie(res, {
      state: authRequest.state,
      codeVerifier: authRequest.codeVerifier,
      nonce: authRequest.nonce,
      handoffChallenge: challenge,
      ...(linkUserId ? { linkUserId } : {}),
    });
    res.redirect(authRequest.url);
  } catch (error) {
    logger.error('Anclora Identity discovery/authorization failed', {
      error: redactText((error as Error).message),
    });
    res.redirect(`${frontendUrl()}/auth/error?provider=anclora-identity&reason=unavailable`);
  }
}

export async function ancloraIdentityCallback(req: Request, res: Response) {
  const config = readAncloraIdentityConfig();
  const transaction = readIdentityTransactionCookie(req);
  res.clearCookie(IDENTITY_TXN_COOKIE, { path: '/api/auth' });

  if (!config || !transaction) {
    res.redirect(`${frontendUrl()}/auth/error?provider=anclora-identity&reason=retry`);
    return;
  }

  if (typeof req.query.error === 'string') {
    res.redirect(`${frontendUrl()}/auth/error?provider=anclora-identity&reason=access_denied`);
    return;
  }

  const { code, state } = req.query;
  if (typeof code !== 'string' || !oauthStatesMatch(transaction.state, typeof state === 'string' ? state : undefined)) {
    res.redirect(`${frontendUrl()}/auth/error?provider=anclora-identity&reason=invalid_state`);
    return;
  }

  try {
    const claims = await exchangeAncloraIdentityCode(config, req.originalUrl, {
      expectedState: transaction.state,
      expectedNonce: transaction.nonce,
      codeVerifier: transaction.codeVerifier,
    });

    const access = resolveImpulsoIdentityAccess(claims);
    if (!access.allowed) {
      throw new OAuthRefusal('membership_required');
    }

    const user = transaction.linkUserId
      ? await linkAuthenticatedUser({
          userId: transaction.linkUserId,
          issuer: claims.issuer,
          subject: claims.subject,
          email: claims.email,
        })
      : await resolveIdentityLogin({
          issuer: claims.issuer,
          subject: claims.subject,
          email: claims.email,
          fullName: claims.fullName,
        });

    const handoffCode = await createOAuthHandoff({
      userId: user.id,
      provider: 'anclora-identity',
      challenge: transaction.handoffChallenge ?? '',
    });

    res.redirect(
      `${frontendUrl()}/auth/callback#code=${encodeURIComponent(handoffCode)}&provider=anclora-identity`,
    );
  } catch (error) {
    const reason = error instanceof OAuthRefusal ? error.code : 'exchange';
    logger.error(`Anclora Identity callback failed (${reason})`, {
      error: redactText((error as Error).message),
    });
    res.redirect(`${frontendUrl()}/auth/error?provider=anclora-identity&reason=${encodeURIComponent(reason)}`);
  }
}

export async function ancloraIdentityLogout(req: Request, res: Response, next: (error?: unknown) => void) {
  try {
    const refreshToken = extractRefreshToken(req);
    if (refreshToken) {
      await revokeByRefreshToken(refreshToken, 'logout');
    }

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = verifyAccessTokenIgnoringExpiry(authHeader.slice(7));
        if (payload.sid) {
          await revokeSession(payload.sid, 'logout');
        }
      } catch {
        // Ignore invalid bearer token on logout
      }
    }

    clearRefreshTokenCookie(res);
    const config = readAncloraIdentityConfig();
    const endSessionUrl = config
      ? await buildAncloraIdentityLogoutUrl(config, `${frontendUrl()}/auth/login`)
      : null;

    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, endSessionUrl });
  } catch (error) {
    next(error);
  }
}
