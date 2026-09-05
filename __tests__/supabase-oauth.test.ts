import { isGoogleAuthEnabled, isGithubAuthEnabled } from '../lib/auth/oauth';

describe('Social OAuth feature flags', () => {
  it('isGoogleAuthEnabled returns a boolean', () => {
    expect(typeof isGoogleAuthEnabled()).toBe('boolean');
  });

  it('isGithubAuthEnabled returns a boolean', () => {
    expect(typeof isGithubAuthEnabled()).toBe('boolean');
  });
});
