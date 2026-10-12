/** F-4 triage: what each provider module accepts as an ACCREDITED e-mail / stable identity. fetch is simulated. */
import { fetchGoogleProfile } from '../../src/services/oauth/google.provider';
import { fetchGitHubProfile } from '../../src/services/oauth/github.provider';

const cfg = { clientId: 'c', clientSecret: 's', callbackUrl: 'http://127.0.0.1/cb' };
const json = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

function stubFetch(routes: Record<string, () => Response>) {
  return jest.spyOn(globalThis, 'fetch').mockImplementation((async (input: any) => {
    const url = String(input);
    for (const [prefix, make] of Object.entries(routes)) if (url.startsWith(prefix)) return make();
    throw new Error(`unexpected network call: ${url}`);
  }) as any);
}
afterEach(() => jest.restoreAllMocks());

describe('Google: e-mail only when Google states email_verified === true', () => {
  const run = (userinfo: unknown) => {
    stubFetch({
      'https://oauth2.googleapis.com/token': () => json({ access_token: 't' }),
      'https://openidconnect.googleapis.com/v1/userinfo': () => json(userinfo),
    });
    return fetchGoogleProfile(cfg, 'code', 'verifier');
  };

  it('verified e-mail is returned', async () => {
    expect(await run({ sub: '1', email: 'a@x.test', email_verified: true, name: 'A' })).toMatchObject({ providerAccountId: '1', email: 'a@x.test' });
  });
  it.each([[false], [undefined], ['true'], [1], [null]])('email_verified=%p gives NO e-mail', async (flag) => {
    const profile = await run({ sub: '1', email: 'a@x.test', email_verified: flag });
    expect(profile.email).toBeNull();
    expect(profile.providerAccountId).toBe('1');
  });
  it('rejects a response without a stable subject', async () => {
    await expect(run({ email: 'a@x.test', email_verified: true })).rejects.toThrow();
    await expect(run({ sub: 42, email: 'a@x.test', email_verified: true })).rejects.toThrow();
    await expect(run({ sub: '', email: 'a@x.test', email_verified: true })).rejects.toThrow();
  });
});

describe('GitHub: e-mail only from /user/emails and only when verified; profile e-mail is ignored', () => {
  const run = (user: unknown, emails: () => Response) => {
    stubFetch({
      'https://github.com/login/oauth/access_token': () => json({ access_token: 't' }),
      'https://api.github.com/user/emails': emails,
      'https://api.github.com/user': () => json(user),
    });
    return fetchGitHubProfile(cfg, 'code', 'verifier');
  };

  it('verified primary e-mail is selected over the public profile e-mail', async () => {
    const p = await run({ id: 7, email: 'public@x.test', login: 'l' }, () => json([
      { email: 'other@x.test', primary: false, verified: true },
      { email: 'main@x.test', primary: true, verified: true },
    ]));
    expect(p).toMatchObject({ providerAccountId: '7', email: 'main@x.test' });
  });
  it('profile e-mail present but list empty / unverified / failed / malformed: NO e-mail, no fallback', async () => {
    const user = { id: 7, email: 'public@x.test', login: 'l' };
    expect((await run(user, () => json([]))).email).toBeNull();
    expect((await run(user, () => json([{ email: 'public@x.test', primary: true, verified: false }]))).email).toBeNull();
    expect((await run(user, () => json({ message: 'nope' }, 403))).email).toBeNull();
    expect((await run(user, () => json({ not: 'an array' }))).email).toBeNull();
    expect((await run(user, () => json([{ email: 'x@x.test', verified: 'true' }]))).email).toBeNull();
  });
  it('rejects a response without a valid numeric account id', async () => {
    await expect(run({ login: 'l' }, () => json([]))).rejects.toThrow();
    await expect(run({ id: 'abc', login: 'l' }, () => json([]))).rejects.toThrow();
    await expect(run({ id: 0, login: 'l' }, () => json([]))).rejects.toThrow();
  });
});
