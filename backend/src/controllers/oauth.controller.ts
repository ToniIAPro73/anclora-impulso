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
import { createOAuthHandoff, redeemOAuthHandoff, HANDOFF_CHALLENGE_PATTERN } from '../services/oauth-handoff.service';

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
    res.setHeader('Cache-Control', 'no-store');
    res.json(auth);
  } catch (error) {
    next(error);
  }
}
