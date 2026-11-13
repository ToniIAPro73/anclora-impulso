// Local fixture API for admin-content visual QA. No database, no real identity. Port 3101.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url)); const load = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
const routes = { '/api/auth/me': 'me.json', '/api/profile': 'profile.json', '/api/exercises/editorial/summary': 'exercises.json', '/api/nutrition/editorial/summary': 'recipes.json', '/api/engagement/admin/deliveries': 'deliveries.json', '/api/events/summary': 'events.json' };
const log = []; let memoryProfile = null;
http.createServer((req, res) => {
  const origin = req.headers.origin || '*';
  const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', Vary: 'Origin' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  const url = new URL(req.url, 'http://x'); let body = '';
  req.on('data', (c) => (body += c)); req.on('end', () => {
    if (url.pathname === '/__log') { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); return res.end(JSON.stringify(log.filter((l) => l.method !== 'GET'))); }
    log.push({ method: req.method, path: url.pathname, body: body.slice(0, 400) });
    const delay = (req.method !== 'GET' && url.pathname === '/api/profile') || url.pathname.includes('bulk-update') || (req.method !== 'GET' && /\/(exercises|recipes)\//.test(url.pathname)) ? 1500 : 0;
    setTimeout(() => {
      const autoKey = (url.pathname.replace('/api/', '') + url.search).replace(/[/?=]/g, '_') + '.json';
      if (req.method === 'GET' && fs.existsSync(path.join(dir, 'auto', autoKey))) { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); return res.end(load(path.join('auto', autoKey))); }
      if (req.method === 'GET' && routes[url.pathname]) { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); return res.end(load(routes[url.pathname])); }
      if ((req.method === 'PUT' || req.method === 'PATCH') && url.pathname === '/api/profile') {
        if (process.env.FX_PROFILE_FAIL === '1' || fs.existsSync(path.join(dir, 'FAIL_PROFILE'))) { res.writeHead(500, { ...cors, 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'fixture failure' })); }
        const merged = { ...JSON.parse(load('profile.json')), ...JSON.parse(body || '{}') }; memoryProfile = JSON.stringify(merged);
        res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); return res.end(memoryProfile);
      }
      if (req.method === 'GET' && url.pathname === '/api/profile' && memoryProfile) { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); return res.end(memoryProfile); }
      if (req.method === 'POST' && url.pathname === '/api/auth/refresh') { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ accessToken: 'fixture-token' })); }
      if (req.method === 'POST' && url.pathname === '/api/engagement/admin/dispatch-now') { res.writeHead(500, { ...cors, 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'fixture failure' })); }
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(req.method === 'GET' ? '[]' : '{}');
    }, delay);
  });
}).listen(3101, '127.0.0.1', () => console.log('fixture api on 3101'));
