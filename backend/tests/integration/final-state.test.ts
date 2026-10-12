/**
 * Target end state, exercised against a REAL server process (isolated DB, synthetic data):
 *   Idempotency-Key mandatory, legacy tokens off, SECURITY_CONFIG_MODE=enforce, 15-minute access tokens.
 * The server runs from an empty directory with a minimal environment (no operational .env).
 */
import { spawn, type ChildProcess } from 'child_process';
import { randomBytes, randomUUID } from 'crypto';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import os from 'os';
import path from 'path';
import { shieldEnv } from '../support/shield';
import { prisma } from '../../src/config/database';

const backendRoot = path.resolve(__dirname, '../..');
const PORT = 39211;
const BASE = `http://127.0.0.1:${PORT}/api`;
const jwtSecret = randomBytes(32).toString('hex');
const jwtRefreshSecret = randomBytes(32).toString('hex');
const tag = `final-${randomUUID().slice(0, 8)}`;
let child: ChildProcess | undefined;
let output = '';
const exerciseIds: string[] = [];
const emails: string[] = [];

async function call(method: string, route: string, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE}${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, headers: res.headers };
}

async function register(label: string) {
  const email = `${tag}-${label}@example.test`;
  emails.push(email);
  const res = await call('POST', '/auth/register', { email, password: `pw-${randomUUID()}`, fullName: label });
  expect(res.status).toBe(201);
  return res.json as { accessToken: string; refreshToken: string; user: { id: string } };
}

beforeAll(async () => {
  for (let i = 0; i < 4; i += 1) {
    const row = await prisma.exercise.create({
      data: { name: `${tag}-x${i}`, category: 'c', muscleGroup: tag, equipment: tag, trainingEnvironments: ['home'], difficulty: 'beginner', description: 'd', instructions: ['i'] },
    });
    exerciseIds.push(row.id);
  }

  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'impulso-final-'));
  child = spawn(path.join(backendRoot, 'node_modules/.bin/tsx'), ['--tsconfig', path.join(backendRoot, 'tsconfig.json'), path.join(backendRoot, 'src/server.ts')], {
    cwd,
    detached: true,
    env: {
      ...shieldEnv(),
      PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', NODE_ENV: 'development', PORT: String(PORT),
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      JWT_SECRET: jwtSecret, JWT_REFRESH_SECRET: jwtRefreshSecret,
      JWT_EXPIRES_IN: '15m',
      AUTH_ACCEPT_LEGACY_TOKENS: 'false',
      SECURITY_CONFIG_MODE: 'enforce',
      IDEMPOTENCY_KEY_ENFORCEMENT: 'require',
      LLM_COACH_ENABLED: 'true', LLM_PROVIDER: 'deterministic', LLM_COACH_CACHE_TTL_SECONDS: '0',
      FRONTEND_URL: 'http://127.0.0.1:39210',
    },
  });
  child.stdout?.on('data', (c) => { output += c; });
  child.stderr?.on('data', (c) => { output += c; });

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline && !/Servidor iniciado/.test(output)) {
    if (child.exitCode !== null) break;
    await new Promise((r) => setTimeout(r, 100));
  }
}, 45_000);

afterAll(async () => {
  if (child?.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ } }
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  await prisma.exercise.deleteMany({ where: { id: { in: exerciseIds } } });
  await prisma.$disconnect();
});

const params = { workoutType: 'strength', duration: 40, difficulty: 'beginner', trainingEnvironment: 'home', targetMuscles: [tag], equipment: [tag] };

describe('target end state (real server process)', () => {
  it('starts under enforce with no security finding left (acceptable configuration)', () => {
    expect(output).toMatch(/Servidor iniciado/);
    expect(output).not.toMatch(/SECURITY_CONFIG_NOT_ACCEPTABLE/);
    expect(output).not.toMatch(/Insecure security configuration/);
  });

  it('issues 15-minute, session-bound access tokens', async () => {
    const session = await register('ttl');
    const claims = jwt.decode(session.accessToken) as { exp: number; iat: number; sid?: string };
    expect(claims.exp - claims.iat).toBe(900);
    expect(claims.sid).toBeTruthy();
  });

  it('refuses mutating operations without Idempotency-Key (428) and accepts them with it', async () => {
    const session = await register('require');
    const auth = { Authorization: `Bearer ${session.accessToken}` };

    expect((await call('POST', '/workouts/generate', params, auth)).status).toBe(428);
    expect((await call('POST', '/v1/coach/messages', { message: 'no key sent here' }, auth)).status).toBe(428);

    const key = `final-${randomUUID()}`;
    const created = await call('POST', '/workouts/generate', params, { ...auth, 'Idempotency-Key': key });
    expect(created.status).toBe(201);
    const replay = await call('POST', '/workouts/generate', params, { ...auth, 'Idempotency-Key': key });
    expect(replay.status).toBe(200);
    expect(replay.json.id).toBe(created.json.id);
    expect(await prisma.workout.count({ where: { userId: session.user.id } })).toBe(1);

    const coachKey = `final-${randomUUID()}`;
    const coach = await call('POST', '/v1/coach/messages', { message: 'plan my training week' }, { ...auth, 'Idempotency-Key': coachKey });
    expect(coach.status).toBe(200);
    expect(coach.json.usage.windowResetsAt).toBeTruthy();
  });

  it('rejects pre-session (legacy) tokens: access and refresh', async () => {
    const session = await register('legacy');
    const legacyAccess = jwt.sign({ userId: session.user.id, email: 'x@example.test' }, jwtSecret, { expiresIn: '15m' });
    const legacyRefresh = jwt.sign({ userId: session.user.id, email: 'x@example.test' }, jwtRefreshSecret, { expiresIn: '30d' });
    expect((await call('GET', '/workouts', undefined, { Authorization: `Bearer ${legacyAccess}` })).status).toBe(401);
    expect((await call('POST', '/auth/refresh', { refreshToken: legacyRefresh })).status).toBe(401);
  });

  it('keeps rotation and logout revocation working in the end state', async () => {
    const session = await register('rotate');
    const rotated = await call('POST', '/auth/refresh', { refreshToken: session.refreshToken });
    expect(rotated.status).toBe(200);
    expect(rotated.json.refreshToken).not.toBe(session.refreshToken);
    const auth = { Authorization: `Bearer ${rotated.json.accessToken}` };
    expect((await call('GET', '/workouts', undefined, auth)).status).toBe(200);
    expect((await call('POST', '/auth/logout', { refreshToken: rotated.json.refreshToken }, auth)).status).toBe(200);
    expect((await call('GET', '/workouts', undefined, auth)).status).toBe(401);
  });
});
