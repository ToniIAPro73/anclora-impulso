import type { Request, Response } from 'express';
import { env } from '../config/env';
import logger from '../config/logger';
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
import { findOrCreateOAuthUser } from '../services/oauth.service';

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
  const config = readGoogleOAuthConfig();

  if (!config) {
    res.status(503).json({ error: 'Login con Google no está configurado en este entorno' });
    return;
  }

  const transaction = createOAuthTransaction();
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
    const auth = await findOrCreateOAuthUser({ provider: 'google', ...profile });
    res.redirect(
      `${frontendUrl()}/auth/callback?accessToken=${encodeURIComponent(auth.accessToken)}&refreshToken=${encodeURIComponent(auth.refreshToken)}`
    );
  } catch (error) {
    logger.error('Google OAuth callback failed', { error: (error as Error).message });
    res.redirect(`${frontendUrl()}/auth/error?provider=google`);
  }
}

export function githubRedirect(req: Request, res: Response) {
  const config = readGitHubOAuthConfig();

  if (!config) {
    res.status(503).json({ error: 'Login con GitHub no está configurado en este entorno' });
    return;
  }

  const transaction = createOAuthTransaction();
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
    const auth = await findOrCreateOAuthUser({ provider: 'github', ...profile });
    res.redirect(
      `${frontendUrl()}/auth/callback?accessToken=${encodeURIComponent(auth.accessToken)}&refreshToken=${encodeURIComponent(auth.refreshToken)}`
    );
  } catch (error) {
    logger.error('GitHub OAuth callback failed', { error: (error as Error).message });
    res.redirect(`${frontendUrl()}/auth/error?provider=github`);
  }
}
