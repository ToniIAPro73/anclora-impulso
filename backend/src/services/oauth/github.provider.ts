import type { OAuthTransaction } from '../../utils/pkce';

const GITHUB_AUTHORIZATION_ENDPOINT = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_ENDPOINT = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_ENDPOINT = 'https://api.github.com/user';
const GITHUB_EMAILS_ENDPOINT = 'https://api.github.com/user/emails';
const GITHUB_LOGIN_SCOPE = 'read:user user:email';

export interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

export interface GitHubProfile {
  providerAccountId: string;
  email: string | null;
  fullName: string | null;
}

export function readGitHubOAuthConfig(): GitHubOAuthConfig | null {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
  const callbackUrl = process.env.GITHUB_OAUTH_CALLBACK_URL;

  if (!clientId || !clientSecret || !callbackUrl) {
    return null;
  }

  return { clientId, clientSecret, callbackUrl };
}

export function createGitHubAuthorizationUrl(config: GitHubOAuthConfig, transaction: OAuthTransaction): string {
  const url = new URL(GITHUB_AUTHORIZATION_ENDPOINT);

  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.callbackUrl);
  url.searchParams.set('scope', GITHUB_LOGIN_SCOPE);
  url.searchParams.set('state', transaction.state);
  url.searchParams.set('code_challenge', transaction.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');

  return url.toString();
}

export async function fetchGitHubProfile(
  config: GitHubOAuthConfig,
  code: string,
  codeVerifier: string
): Promise<GitHubProfile> {
  const tokenResponse = await fetch(GITHUB_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      code_verifier: codeVerifier,
      redirect_uri: config.callbackUrl,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`GitHub token exchange failed: ${tokenResponse.status}`);
  }

  const tokenData = (await tokenResponse.json()) as { access_token?: string; error?: string };

  if (!tokenData.access_token) {
    throw new Error(`GitHub token exchange failed: ${tokenData.error ?? 'unknown error'}`);
  }

  const authHeaders = {
    Authorization: `Bearer ${tokenData.access_token}`,
    Accept: 'application/vnd.github+json',
  };

  const userResponse = await fetch(GITHUB_USER_ENDPOINT, { headers: authHeaders });

  if (!userResponse.ok) {
    throw new Error(`GitHub user fetch failed: ${userResponse.status}`);
  }

  const user = (await userResponse.json()) as { id?: unknown; name?: unknown; login?: unknown };

  // Stable identity: GitHub's numeric account id from the authenticated response.
  if (typeof user.id !== 'number' || !Number.isSafeInteger(user.id) || user.id <= 0) {
    throw new Error('GitHub user response carried no valid account id');
  }

  // The e-mail comes ONLY from the authenticated /user/emails list and only when it is verified. The profile's
  // public `email` field is not used, and a failed or malformed lookup yields no e-mail (no fallback).
  let email: string | null = null;
  const emailsResponse = await fetch(GITHUB_EMAILS_ENDPOINT, { headers: authHeaders });

  if (emailsResponse.ok) {
    const emails = await emailsResponse.json().catch(() => null);
    if (Array.isArray(emails)) {
      const verified = emails.filter(
        (entry): entry is { email: string; primary?: boolean; verified: true } =>
          Boolean(entry) && typeof entry.email === 'string' && entry.email.length > 0 && entry.verified === true,
      );
      email = (verified.find((entry) => entry.primary === true) ?? verified[0])?.email ?? null;
    }
  }

  const displayName =
    typeof user.name === 'string' && user.name.length > 0 ? user.name : typeof user.login === 'string' ? user.login : null;

  return {
    providerAccountId: String(user.id),
    email,
    fullName: displayName,
  };
}
