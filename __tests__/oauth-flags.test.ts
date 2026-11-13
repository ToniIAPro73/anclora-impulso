import {
  isAncloraIdentityEnabled,
  isGithubAuthEnabled,
  isGoogleAuthEnabled,
} from '../lib/auth/oauth';

describe('Auth provider feature flags', () => {
  it('isGoogleAuthEnabled returns a boolean', () => {
    expect(typeof isGoogleAuthEnabled()).toBe('boolean');
  });

  it('isGithubAuthEnabled returns a boolean', () => {
    expect(typeof isGithubAuthEnabled()).toBe('boolean');
  });

  it('isAncloraIdentityEnabled returns a boolean', () => {
    expect(typeof isAncloraIdentityEnabled()).toBe('boolean');
  });
});

