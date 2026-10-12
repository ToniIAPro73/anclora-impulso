import { createHash, randomBytes } from 'crypto';
import { resolveOAuthAccount, type OAuthProfile } from '../../src/services/oauth.service';
import { createOAuthHandoff, redeemOAuthHandoff } from '../../src/services/oauth-handoff.service';

export const newVerifier = () => randomBytes(32).toString('base64url');
export const challengeOf = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');

/** Provider-leg result -> handoff -> redemption, exactly as the browser would do it. Providers are simulated. */
export async function oauthSignIn(profile: OAuthProfile) {
  const verifier = newVerifier();
  const user = await resolveOAuthAccount(profile);
  const code = await createOAuthHandoff({ userId: user.id, provider: profile.provider, challenge: challengeOf(verifier) });
  return redeemOAuthHandoff({ code, verifier, provider: profile.provider });
}
