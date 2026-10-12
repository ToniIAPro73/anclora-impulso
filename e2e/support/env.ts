import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import type { APIRequestContext } from '@playwright/test';

export const API = process.env.API_URL ?? 'http://127.0.0.1:3101/api';
const DB_USER = process.env.E2E_DB_USER ?? '';
const DB_NAME = process.env.E2E_DB_NAME ?? '';

/** Runs SQL inside the isolated test container (never any other database). Synthetic data only. */
export function sql(statement: string): string {
  if (!DB_USER || !DB_NAME) throw new Error('E2E must run through scripts/e2e-isolated.sh');
  return execFileSync(
    'docker',
    ['exec', '-i', 'anclora-impulso-test-postgres', 'psql', '-U', DB_USER, '-d', DB_NAME, '-Atq', '-c', statement],
    { encoding: 'utf8' },
  ).trim();
}

export interface TestUser {
  email: string;
  password: string;
  id: string;
  accessToken: string;
  refreshToken: string;
}

export async function registerUser(request: APIRequestContext, label: string): Promise<TestUser> {
  const email = `e2e-${label}-${randomUUID().slice(0, 8)}@example.test`;
  const password = `pw-${randomUUID()}`;
  const res = await request.post(`${API}/auth/register`, { data: { email, password, fullName: `E2E ${label}` } });
  if (res.status() !== 201) throw new Error(`register failed: ${res.status()}`);
  const body = await res.json();
  const user = { email, password, id: body.user.id as string, accessToken: body.accessToken as string, refreshToken: body.refreshToken as string };
  // Complete profile up front so the onboarding modal never covers the page under test.
  await completeProfile(request, user);
  return user;
}

/** Complete profile so the generator is enabled. */
export async function completeProfile(request: APIRequestContext, user: TestUser) {
  const res = await request.put(`${API}/profile`, {
    headers: { Authorization: `Bearer ${user.accessToken}` },
    data: {
      sex: 'male', age: 45, heightCm: 178, weightKg: 82, targetWeightKg: 78, timeframeWeeks: 12,
      trainingDaysPerWeek: 3, trainingGoal: 'build_muscle', preferredTrainingEnvironment: 'home',
      experienceLevel: 'beginner', onboardingCompletedAt: new Date().toISOString(),
    },
  });
  if (!res.ok()) throw new Error(`profile failed: ${res.status()}`);
}

/** Fresh access token for API-level calls (E2E access tokens are deliberately short-lived). */
export async function apiLogin(request: APIRequestContext, user: TestUser): Promise<string> {
  const res = await request.post(`${API}/auth/login`, { data: { email: user.email, password: user.password } });
  if (!res.ok()) throw new Error(`login failed: ${res.status()}`);
  return (await res.json()).accessToken as string;
}
