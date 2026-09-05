import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export interface OAuthTransaction {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
}

function createRandomBase64Url(): string {
  return randomBytes(32).toString('base64url');
}

export function createOAuthTransaction(): OAuthTransaction {
  const state = createRandomBase64Url();
  const codeVerifier = createRandomBase64Url();
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

  return { state, codeVerifier, codeChallenge };
}

export function oauthStatesMatch(expectedState: string, receivedState: string | undefined): boolean {
  if (!receivedState) {
    return false;
  }

  const expected = Buffer.from(expectedState, 'utf8');
  const received = Buffer.from(receivedState, 'utf8');

  return expected.length === received.length && timingSafeEqual(expected, received);
}
