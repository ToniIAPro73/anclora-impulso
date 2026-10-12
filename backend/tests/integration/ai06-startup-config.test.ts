/**
 * AI-06 AC02: process-level startup behaviour of the security configuration policy.
 * The child runs from an empty temp directory so no operational .env can be loaded, with a minimal environment.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { shieldEnv } from '../support/shield';
import { randomBytes } from 'crypto';

const backendRoot = path.resolve(__dirname, '../..');
const tsx = path.join(backendRoot, 'node_modules/.bin/tsx');
const entry = path.join(backendRoot, 'src/server.ts');
const tsconfig = path.join(backendRoot, 'tsconfig.json');

interface RunResult { code: number | null; stdout: string; stderr: string; }

function runServer(extraEnv: Record<string, string>, waitFor: RegExp, port: number): Promise<RunResult> {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'impulso-startup-'));
  return new Promise((resolve) => {
    const child = spawn(tsx, ['--tsconfig', tsconfig, entry], {
      cwd,
      detached: true, // own process group: tsx spawns a grandchild that must be killed too
      env: {
        ...shieldEnv(),
        PATH: process.env.PATH ?? '',
        HOME: process.env.HOME ?? '',
        DATABASE_URL: process.env.DATABASE_URL ?? '',
        NODE_ENV: 'test',
        PORT: String(port),
        ...extraEnv,
      },
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { process.kill(-(child.pid as number), 'SIGKILL'); } catch { /* already gone */ }
      resolve({ code, stdout, stderr });
    };
    child.stdout.on('data', (chunk) => { stdout += chunk; if (waitFor.test(stdout)) setTimeout(() => finish(null), 100); });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('exit', (code) => finish(code));
    const timer = setTimeout(() => finish(null), 25000);
  });
}

const strong = () => randomBytes(32).toString('hex');

describe('startup security policy (process level)', () => {
  it('enforce + default secrets: refuses to start (exit 1) and prints only finding codes', async () => {
    const result = await runServer({ SECURITY_CONFIG_MODE: 'enforce' }, /Servidor iniciado/, 39101);
    expect(result.code).toBe(1);
    expect(result.stdout).not.toMatch(/Servidor iniciado/);
    expect(result.stderr + result.stdout).toMatch(/JWT_SECRET_DEFAULT/);
    expect(result.stderr + result.stdout).not.toContain('default-secret-change-in-production');
  }, 40000);

  it('enforce + short secrets: refuses to start', async () => {
    const result = await runServer({ SECURITY_CONFIG_MODE: 'enforce', JWT_SECRET: 'short', JWT_REFRESH_SECRET: 'short' }, /Servidor iniciado/, 39102);
    expect(result.code).toBe(1);
    expect(result.stderr + result.stdout).toMatch(/JWT_SECRET_SHORT/);
  }, 40000);

  it('warn + default secrets: starts but reports SECURITY_CONFIG_NOT_ACCEPTABLE (not an acceptance)', async () => {
    const result = await runServer({ SECURITY_CONFIG_MODE: 'warn' }, /Servidor iniciado/, 39103);
    expect(result.stdout).toMatch(/Servidor iniciado/);
    expect(result.stdout + result.stderr).toMatch(/SECURITY_CONFIG_NOT_ACCEPTABLE/);
  }, 40000);

  it('enforce + strong distinct secrets + short lifetime + legacy tokens off: starts without warnings', async () => {
    const result = await runServer(
      { SECURITY_CONFIG_MODE: 'enforce', JWT_SECRET: strong(), JWT_REFRESH_SECRET: strong(), JWT_EXPIRES_IN: '15m', AUTH_ACCEPT_LEGACY_TOKENS: 'false' },
      /Servidor iniciado/,
      39104,
    );
    expect(result.stdout).toMatch(/Servidor iniciado/);
    expect(result.stdout + result.stderr).not.toMatch(/SECURITY_CONFIG_NOT_ACCEPTABLE/);
  }, 40000);

  it('strong secrets but legacy tokens still accepted: starts, yet is reported as NOT acceptable', async () => {
    const result = await runServer(
      { SECURITY_CONFIG_MODE: 'enforce', JWT_SECRET: strong(), JWT_REFRESH_SECRET: strong(), JWT_EXPIRES_IN: '15m' },
      /Servidor iniciado/,
      39105,
    );
    expect(result.stdout).toMatch(/Servidor iniciado/);
    expect(result.stdout + result.stderr).toMatch(/SECURITY_CONFIG_NOT_ACCEPTABLE.*LEGACY_TOKENS_ACCEPTED/);
  }, 40000);
});
