import type { OAuthTransaction } from '../../utils/pkce';

const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';
const GOOGLE_LOGIN_SCOPE = 'openid email profile';

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

export interface GoogleProfile {
  providerAccountId: string;
  email: string | null;
  fullName: string | null;
}

export function readGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const callbackUrl = process.env.GOOGLE_OAUTH_CALLBACK_URL;

  if (!clientId || !clientSecret || !callbackUrl) {
    return null;
  }

  return { clientId, clientSecret, callbackUrl };
}

export function createGoogleAuthorizationUrl(config: GoogleOAuthConfig, transaction: OAuthTransaction): string {
  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);

  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.callbackUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_LOGIN_SCOPE);
  url.searchParams.set('state', transaction.state);
  url.searchParams.set('code_challenge', transaction.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('prompt', 'select_account');

  return url.toString();
}

export async function fetchGoogleProfile(
  config: GoogleOAuthConfig,
  code: string,
  codeVerifier: string
): Promise<GoogleProfile> {
  const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: config.callbackUrl,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Google token exchange failed: ${tokenResponse.status}`);
  }

  const tokenData = (await tokenResponse.json()) as { access_token: string };

  const profileResponse = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!profileResponse.ok) {
    throw new Error(`Google userinfo fetch failed: ${profileResponse.status}`);
  }

  const profile = (await profileResponse.json()) as { sub: string; email?: string; name?: string };

  return {
    providerAccountId: profile.sub,
    email: profile.email ?? null,
    fullName: profile.name ?? null,
  };
}
