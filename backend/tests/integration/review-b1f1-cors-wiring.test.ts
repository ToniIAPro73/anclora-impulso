/** B1-F1 wiring: the real Express app answers CORS according to the origin policy. No data is read or written. */
import request from 'supertest';
import { env } from '../../src/config/env';
import app from '../../src/app';

const original = { urls: [...env.frontendUrls], suffixes: [...env.frontendPreviewHostSuffixes] };
const TEAM = '-pmi140979-6354s-projects.vercel.app';

beforeEach(() => {
  env.frontendUrls.splice(0, env.frontendUrls.length, 'https://anclora-impulso.vercel.app', 'https://impulso.anclora.com');
  env.frontendPreviewHostSuffixes.splice(0, env.frontendPreviewHostSuffixes.length);
});
afterAll(() => {
  env.frontendUrls.splice(0, env.frontendUrls.length, ...original.urls);
  env.frontendPreviewHostSuffixes.splice(0, env.frontendPreviewHostSuffixes.length, ...original.suffixes);
});

const acao = (origin: string) => request(app).get('/health/simple').set('Origin', origin).then((r) => r.headers['access-control-allow-origin']);

describe('CORS wiring', () => {
  it('echoes an exact configured origin and allows credentials', async () => {
    const res = await request(app).get('/health/simple').set('Origin', 'https://impulso.anclora.com');
    expect(res.headers['access-control-allow-origin']).toBe('https://impulso.anclora.com');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not echo a foreign "<project>-*.vercel.app" origin (B1-F1)', async () => {
    expect(await acao('https://anclora-impulso-evil.vercel.app')).toBeUndefined();
  });

  it('echoes a team-scoped preview only when the suffix is configured', async () => {
    const preview = 'https://anclora-impulso-git-staging-pmi140979-6354s-projects.vercel.app';
    expect(await acao(preview)).toBeUndefined();
    env.frontendPreviewHostSuffixes.push(TEAM);
    expect(await acao(preview)).toBe(preview);
    expect(await acao('https://anclora-impulso-evil.vercel.app')).toBeUndefined();
  });

  it('does not require an Origin header (server-to-server and same-origin requests)', async () => {
    const res = await request(app).get('/health/simple');
    expect(res.status).toBe(200);
  });
});
