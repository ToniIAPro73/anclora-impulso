/**
 * Simulated Google/GitHub for the isolated E2E (loaded with `node --require` ONLY when E2E_FAKE_OAUTH=1).
 * Answers the providers' token/userinfo endpoints for SYNTHETIC codes of the form  <g|gh>.<base64url(JSON profile)>
 * and refuses to reach any other external host. This proves the local flow, not real Google/GitHub interoperability.
 */
const realFetch = globalThis.fetch;
const decode = (s) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));
const reply = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });

globalThis.fetch = async (input, init = {}) => {
  const url = String(input && input.url ? input.url : input);
  const host = new URL(url).hostname;
  const external = ['oauth2.googleapis.com', 'openidconnect.googleapis.com', 'accounts.google.com', 'github.com', 'api.github.com'];
  if (!external.includes(host)) return realFetch(input, init);

  if (url.startsWith('https://oauth2.googleapis.com/token')) {
    const code = new URLSearchParams(String(init.body)).get('code') || '';
    if (!code.startsWith('g.')) return reply({ error: 'invalid_grant' }, 400);
    return reply({ access_token: 'gtok.' + code.slice(2) });
  }
  if (url.startsWith('https://openidconnect.googleapis.com/v1/userinfo')) {
    const token = (init.headers && init.headers.Authorization) || '';
    return reply(decode(token.replace('Bearer gtok.', '')));
  }
  if (url.startsWith('https://github.com/login/oauth/access_token')) {
    const code = new URLSearchParams(String(init.body)).get('code') || '';
    if (!code.startsWith('gh.')) return reply({ error: 'bad_verification_code' });
    return reply({ access_token: 'ghtok.' + code.slice(3) });
  }
  const token = ((init.headers && init.headers.Authorization) || '').replace('Bearer ghtok.', '');
  if (url.startsWith('https://api.github.com/user/emails')) {
    const p = decode(token);
    return p.emailsStatus ? reply({ message: 'simulated failure' }, p.emailsStatus) : reply(p.emails || []);
  }
  if (url.startsWith('https://api.github.com/user')) return reply(decode(token).user);
  return reply({ error: 'unexpected simulated call' }, 500);
};
