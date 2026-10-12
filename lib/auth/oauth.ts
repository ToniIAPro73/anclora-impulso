import { goTo } from './navigate';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export type OAuthProvider = 'google' | 'github';

export function isGoogleAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === 'true';
}

export function isGithubAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_GITHUB_AUTH === 'true';
}

// ---------------------------------------------------------------------------------------------------------------------
// F-4: the credentials of an OAuth sign-in are handed to the browser that STARTED the flow, and only to it.
//   start  : this tab creates a random verifier, keeps it in sessionStorage (per tab, never in the URL) and sends only its
//            S256 challenge to the backend, which binds the flow's one-time handoff code to it;
//   return : /auth/callback#code=… (the code alone is useless) is redeemed together with the verifier;
//   the verifier is single use and expires; nothing credential-like is ever read from the URL.
// ---------------------------------------------------------------------------------------------------------------------

export const OAUTH_ATTEMPT_KEY = 'anclora.oauth.attempt';
export const OAUTH_ATTEMPT_MAX_AGE_MS = 10 * 60 * 1000;

export interface OAuthAttempt {
  verifier: string;
  provider: OAuthProvider;
  startedAt: number;
  /** userId of the session this tab held when the flow started (null = signed out). */
  identity: string | null;
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function s256(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

/** userId claim of the stored access token (no verification: used only to detect that the identity CHANGED). */
export function storedIdentity(): string | null {
  try {
    const token = localStorage.getItem('accessToken');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.userId === 'string' ? payload.userId : null;
  } catch {
    return null;
  }
}

/** Starts a flow: records the attempt in THIS tab and navigates to the backend with the challenge only. */
export async function beginOAuth(provider: OAuthProvider): Promise<void> {
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  const verifier = base64Url(random);
  const attempt: OAuthAttempt = { verifier, provider, startedAt: Date.now(), identity: storedIdentity() };
  // A newer attempt in this tab supersedes any earlier one: a late return of the old flow can no longer be redeemed.
  sessionStorage.setItem(OAUTH_ATTEMPT_KEY, JSON.stringify(attempt));
  const challenge = await s256(verifier);
  goTo(`${API_URL}/auth/${provider}?challenge=${encodeURIComponent(challenge)}`);
}

/** Reads AND removes the pending attempt (single use). Returns null when there is none or it is malformed/expired. */
export function takeOAuthAttempt(now: number = Date.now()): OAuthAttempt | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(OAUTH_ATTEMPT_KEY);
    sessionStorage.removeItem(OAUTH_ATTEMPT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const attempt = JSON.parse(raw) as OAuthAttempt;
    const valid =
      typeof attempt.verifier === 'string' && /^[A-Za-z0-9_-]{43,128}$/.test(attempt.verifier) &&
      (attempt.provider === 'google' || attempt.provider === 'github') &&
      typeof attempt.startedAt === 'number' && now - attempt.startedAt >= 0 && now - attempt.startedAt <= OAUTH_ATTEMPT_MAX_AGE_MS &&
      (attempt.identity === null || typeof attempt.identity === 'string');
    return valid ? attempt : null;
  } catch {
    return null;
  }
}

export interface OAuthRedeemResult {
  user: { id: string; email: string; fullName: string; isAdmin?: boolean };
  accessToken: string;
  refreshToken: string;
}

/** Redeems the handoff code with the verifier of THIS tab's attempt. Throws on any refusal. */
export async function redeemOAuthHandoff(code: string, attempt: OAuthAttempt): Promise<OAuthRedeemResult> {
  const response = await fetch(`${API_URL}/auth/oauth/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, verifier: attempt.verifier, provider: attempt.provider }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('oauth_exchange_failed');
  const body = (await response.json()) as Partial<OAuthRedeemResult>;
  if (typeof body.accessToken !== 'string' || typeof body.refreshToken !== 'string' || !body.user) {
    throw new Error('oauth_exchange_malformed');
  }
  return body as OAuthRedeemResult;
}

export function signInWithGoogle() {
  return beginOAuth('google');
}

export function signInWithGithub() {
  return beginOAuth('github');
}
