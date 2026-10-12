/** B1-F1: CORS origin policy. Exact origins always; Vercel preview wildcards only when a team suffix is configured. */
import { isAllowedOrigin } from '../../src/utils/cors-origin';

const FRONTENDS = ['https://anclora-impulso.vercel.app', 'https://impulso.anclora.com'];
const TEAM = '-pmi140979-6354s-projects.vercel.app';

describe('exact origins', () => {
  it.each(FRONTENDS)('accepts %s', (origin) => {
    expect(isAllowedOrigin(origin, FRONTENDS, [])).toBe(true);
  });

  it('rejects look-alikes of an allowed origin', () => {
    for (const origin of [
      'https://anclora-impulso.vercel.app.evil.com',
      'https://impulso.anclora.com.evil.com',
      'https://impulso-evil.anclora.com',
      'http://impulso.anclora.com',
      'https://impulso.anclora.com:8443',
      'null',
      'not a url',
      '',
    ]) {
      expect(isAllowedOrigin(origin, FRONTENDS, [TEAM])).toBe(false);
    }
  });
});

describe('Vercel preview wildcards (the B1-F1 defect)', () => {
  it('does NOT accept any "<project>-*.vercel.app" origin by default', () => {
    expect(isAllowedOrigin('https://anclora-impulso-evil.vercel.app', FRONTENDS, [])).toBe(false);
    expect(isAllowedOrigin('https://anclora-impulso-git-staging-pmi140979-6354s-projects.vercel.app', FRONTENDS, [])).toBe(false);
  });

  it('accepts previews of the project only under a configured team suffix', () => {
    const suffixes = [TEAM];
    expect(isAllowedOrigin('https://anclora-impulso-git-staging-pmi140979-6354s-projects.vercel.app', FRONTENDS, suffixes)).toBe(true);
    expect(isAllowedOrigin('https://anclora-impulso-p08s2sv2w-pmi140979-6354s-projects.vercel.app', FRONTENDS, suffixes)).toBe(true);
  });

  it('keeps rejecting foreign projects and foreign teams even when a suffix is configured', () => {
    const suffixes = [TEAM];
    expect(isAllowedOrigin('https://anclora-impulso-evil.vercel.app', FRONTENDS, suffixes)).toBe(false);
    expect(isAllowedOrigin('https://other-app-pmi140979-6354s-projects.vercel.app', FRONTENDS, suffixes)).toBe(false);
    expect(isAllowedOrigin('https://anclora-impulso-x-evilteam-projects.vercel.app', FRONTENDS, suffixes)).toBe(false);
    expect(isAllowedOrigin('http://anclora-impulso-git-staging-pmi140979-6354s-projects.vercel.app', FRONTENDS, suffixes)).toBe(false);
  });

  it('requires a non-empty hash/branch part between project and team', () => {
    expect(isAllowedOrigin('https://anclora-impulso-pmi140979-6354s-projects.vercel.app', FRONTENDS, [TEAM])).toBe(false);
  });

  it('never applies wildcards to non-Vercel origins', () => {
    expect(isAllowedOrigin('https://impulso-x.anclora.com', FRONTENDS, [TEAM])).toBe(false);
  });

  it('ignores malformed suffixes (must start with "-" and end with ".vercel.app")', () => {
    expect(isAllowedOrigin('https://anclora-impulso-evil.vercel.app', FRONTENDS, ['.vercel.app'])).toBe(false);
    expect(isAllowedOrigin('https://anclora-impulso-evil.vercel.app', FRONTENDS, ['-evil.vercel.app.example'])).toBe(false);
  });
});
