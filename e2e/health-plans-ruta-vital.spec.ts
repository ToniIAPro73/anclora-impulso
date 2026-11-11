import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const LOCAL_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!process.env.CI && !fs.existsSync(chromium.executablePath()) && fs.existsSync(LOCAL_CHROME)) {
  test.use({ launchOptions: { executablePath: LOCAL_CHROME } });
}

const QA_EMAIL = 'qa.impulso@anclora.local';
const QA_PASSWORD = 'synthetic-qa-password-only';
const SHOT_DIR = path.resolve(__dirname, '../artifacts/qa/ruta-vital');

function makeSyntheticJwt(sid: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ userId: 'qa-user-ruta-vital', sid, exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString('base64url');
  return `${header}.${payload}.synthetic`;
}

interface RutaVitalState {
  enrolled: boolean;
  onboardingComplete: boolean;
  safetyCategory: 'SELF_MANAGED' | 'PROFESSIONAL_REVIEW_RECOMMENDED';
  completedIds: Set<string>;
}

const DEFINITIONS = [
  {
    id: 'plan-ruta-vital-50-60',
    key: 'ruta-vital-50-60',
    nameEs: 'Ruta Vital 50–60',
    nameEn: 'Vital Path 50–60',
    descriptionEs: 'Una ruta progresiva para fuerza, movimiento, nutrición, recuperación y continuidad.',
    descriptionEn: 'A progressive path for strength, movement, nutrition, recovery and continuity.',
    minAge: 50,
    maxAge: 60,
  },
];

function buildHomePayload(state: RutaVitalState) {
  if (!state.enrolled) return null;
  const baseActions = [
    {
      id: 'act-strength',
      key: 'strength_session',
      pillar: 'FORCE',
      type: 'workout',
      route: '/workouts/generate',
      title: 'Haz una sesión breve de fuerza',
      description: 'Usa el entrenamiento existente y adapta la intensidad a tu día.',
    },
    {
      id: 'act-movement',
      key: 'movement_break',
      pillar: 'MOVEMENT',
      type: 'movement',
      route: '/progress',
      title: 'Acumula movimiento suave',
      description: 'Elige una caminata o una pausa activa que puedas sostener.',
    },
    {
      id: 'act-nutrition',
      key: 'nutrition_anchor',
      pillar: 'NUTRITION',
      type: 'nutrition',
      route: '/nutrition',
      title: 'Completa un ancla de nutrición',
      description: 'Revisa tu módulo de nutrición y elige una acción sencilla.',
    },
    {
      id: 'act-recovery',
      key: 'recovery_anchor',
      pillar: 'RECOVERY',
      type: 'recovery',
      route: '/progress',
      title: 'Protege tu recuperación',
      description: 'Mantén una hora de despertar estable y observa cómo te sientes.',
    },
  ].map((action) => ({
    ...action,
    status: state.completedIds.has(action.id) ? 'completed' : 'pending',
    completedAt: state.completedIds.has(action.id) ? '2026-11-11T10:00:00.000Z' : null,
  }));

  const completedCount = baseActions.filter((a) => a.status === 'completed').length;
  const nextAction = baseActions.find((a) => a.status !== 'completed') ?? baseActions[0];

  return {
    enrollment: {
      id: 'enr-qa-ruta-vital',
      status: 'active',
      currentWeek: 1,
      safetyCategory: state.safetyCategory,
      adaptation: state.safetyCategory === 'PROFESSIONAL_REVIEW_RECOMMENDED' ? 'REDUCE' : 'MAINTAIN',
      onboardingComplete: state.onboardingComplete,
    },
    phase: { key: 'FOUNDATION', name: 'Base' },
    week: {
      number: 1,
      objective: 'Construir continuidad semanal sin fatiga innecesaria.',
      minimumVersion: { strengthSessions: 1 },
      fullVersion: { strengthSessions: 3 },
      progress: Math.round((completedCount / baseActions.length) * 100),
    },
    actions: baseActions,
    nextBestAction: nextAction ? { id: nextAction.id, label: nextAction.title, href: nextAction.route } : null,
    pillars: [
      { key: 'FORCE', name: 'Fuerza', state: state.completedIds.has('act-strength') ? 'ON_TRACK' : 'NOT_ENOUGH_DATA' },
      { key: 'MOVEMENT', name: 'Movimiento', state: state.completedIds.has('act-movement') ? 'ON_TRACK' : 'NOT_ENOUGH_DATA' },
    ],
  };
}

async function installIsolatedMocks(context: BrowserContext, state: RutaVitalState, baseOrigin: string) {
  const token = makeSyntheticJwt('sid-qa-ruta-vital');
  const blockedExternal: string[] = [];

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    const parsed = new URL(url);

    // Block all external network origins (Render, Neon, analytics, fonts CDNs if external) strictly.
    const isApiCall = parsed.pathname.startsWith('/api/') || parsed.pathname.includes('/api/');
    if (!isApiCall) {
      if (parsed.origin === baseOrigin || parsed.protocol === 'data:' || parsed.protocol === 'blob:') {
        await route.continue();
        return;
      }
      blockedExternal.push(`${request.method()} ${parsed.origin}`);
      await route.abort('blockedbyclient');
      return;
    }

    const method = request.method();
    const pathname = parsed.pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (pathname.endsWith('/auth/login') && method === 'POST') {
      return json({
        user: {
          id: 'qa-user-ruta-vital',
          email: QA_EMAIL,
          fullName: 'QA Ruta Vital',
          isAdmin: false,
        },
        accessToken: token,
      });
    }
    if (pathname.endsWith('/auth/me')) {
      return json({
        id: 'qa-user-ruta-vital',
        email: QA_EMAIL,
        fullName: 'QA Ruta Vital',
        isAdmin: false,
      });
    }
    if (pathname.endsWith('/auth/logout')) {
      return json({ ok: true });
    }
    if (pathname.endsWith('/profile')) {
      return json({
        sex: 'female',
        age: 55,
        heightCm: 165,
        weightKg: 64,
        targetWeightKg: 62,
        timeframeWeeks: 12,
        trainingDaysPerWeek: 3,
        trainingGoal: 'salud_general',
        preferredTrainingEnvironment: 'home',
        experienceLevel: 'intermediate',
        limitations: [],
        onboardingCompletedAt: '2026-10-12T00:00:00.000Z',
      });
    }
    if (pathname.includes('/health-plans/definitions')) {
      return json(DEFINITIONS);
    }
    if (pathname.includes('/health-plans/home')) {
      return json(buildHomePayload(state));
    }
    if (pathname.endsWith('/health-plans/enrollment') && method === 'POST') {
      state.enrolled = true;
      return json({ id: 'enr-qa-ruta-vital', status: 'active' }, 201);
    }
    if (pathname.endsWith('/health-plans/onboarding') && method === 'POST') {
      const payload = JSON.parse(request.postData() || '{}') as { safetySignals?: string[] };
      state.onboardingComplete = true;
      state.safetyCategory =
        payload.safetySignals && payload.safetySignals.length > 0
          ? 'PROFESSIONAL_REVIEW_RECOMMENDED'
          : 'SELF_MANAGED';
      return json({
        safetyCategory: state.safetyCategory,
        safetyReasonCodes: payload.safetySignals ?? [],
        safetyMessage: 'Guardado',
      });
    }
    if (/\/health-plans\/actions\/([^/]+)\/complete$/.test(pathname) && method === 'POST') {
      const actionId = pathname.match(/\/health-plans\/actions\/([^/]+)\/complete$/)?.[1];
      if (actionId) state.completedIds.add(actionId);
      return json({ status: 'completed' });
    }
    if (pathname.includes('/gamification/achievements') || pathname.includes('/gamification/history')) {
      return json([]);
    }
    if (pathname.includes('/gamification')) {
      return json({ currentStreak: 3, longestStreak: 5, totalPoints: 120, level: 2 });
    }
    if (pathname.includes('/nutrition/meal-plans')) {
      return json([]);
    }
    if (pathname.includes('/nutrition')) {
      return json({ totals: { calories: 0, protein: 0, carbs: 0, fats: 0 }, logs: [], meals: [] });
    }
    if (pathname.includes('/sessions')) {
      return json([]);
    }
    if (pathname.includes('/progression')) {
      return json({ signals: [], recommendation: null });
    }
    if (pathname.includes('/progress')) {
      return json({
        totalWorkouts: 0,
        weeklyWorkouts: 0,
        totalDuration: 0,
        totalVolume: 0,
        currentStreak: 0,
        longestStreak: 0,
        personalRecords: [],
        stats: { personalRecords: [] },
        entries: [],
      });
    }
    if (pathname.includes('/workouts')) {
      return json([]);
    }
    if (pathname.includes('/engagement')) {
      return json({ nudges: [], unreadCount: 0, notifications: [], reminders: [] });
    }

    return json({});
  });

  return blockedExternal;
}

async function loginThroughUi(page: Page) {
  await page.goto('/auth/login');
  await page.fill('#email', QA_EMAIL);
  await page.fill('#password', QA_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/login'), { timeout: 20_000 });
}

test.describe('TASK-013: Ruta Vital end-to-end & visual QA (isolated synthetic state)', () => {
  test.beforeAll(() => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('covers discover -> join -> onboarding -> week -> complete -> logout/relogin persistence & responsive layout', async ({
    page,
    context,
    baseURL,
  }) => {
    const state: RutaVitalState = {
      enrolled: false,
      onboardingComplete: false,
      safetyCategory: 'SELF_MANAGED',
      completedIds: new Set<string>(),
    };

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.addInitScript(() => {
      localStorage.setItem(
        'anclora-cookie-consent-v1',
        JSON.stringify({
          necessary: true,
          analytics: false,
          marketing: false,
          updatedAt: new Date().toISOString(),
          version: 'v1',
        }),
      );
    });

    const baseOrigin = new URL(baseURL ?? 'http://localhost:3008').origin;
    const blockedExternal = await installIsolatedMocks(context, state, baseOrigin);

    // 1. Login as synthetic QA user & navigate to /health-plans
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginThroughUi(page);
    await page.goto('/health-plans');

    // 2. Discover view
    await expect(page.getByText('Explora Ruta Vital')).toBeVisible();
    const joinBtn = page.getByRole('button', { name: 'Unirme a Ruta Vital' });
    await expect(joinBtn).toBeVisible();

    // 3. Join -> onboarding setup
    await joinBtn.click();
    await expect(page.getByText('Personaliza tu punto de partida')).toBeVisible();
    await page.getByRole('button', { name: 'Guardar y continuar' }).click();

    // 4. Week 1 home view + complete first action
    await expect(page.getByText('Inicio de Ruta Vital')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByText('0%')).toBeVisible();
    await page.getByRole('button', { name: 'Marcar como hecha' }).first().click();
    await expect(page.getByText('25%')).toBeVisible();

    // 5. Visual / layout verification (desktop 1440x900)
    const desktopOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(desktopOverflow).toBe(false);
    await page.screenshot({ path: path.join(SHOT_DIR, 'ruta-vital-desktop.png'), fullPage: true });

    // 6. Visual / layout verification (mobile 390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    // Wait for sidebar padding transition (duration-300) to settle at mobile width before capturing.
    await page.waitForFunction(() => {
      const mainParent = document.querySelector('main')?.parentElement;
      return mainParent ? getComputedStyle(mainParent).paddingLeft === '0px' : true;
    });
    const mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(mobileOverflow).toBe(false);
    await page.screenshot({ path: path.join(SHOT_DIR, 'ruta-vital-mobile.png'), fullPage: true });

    // 7. Logout & log back in -> persisted progress remains 25%
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByTestId('user-menu').click();
    await page.getByTestId('logout').click();
    await page.waitForURL((url) => url.pathname.startsWith('/auth/login'), { timeout: 20_000 });

    await loginThroughUi(page);
    await page.goto('/health-plans');
    await expect(page.getByText('Inicio de Ruta Vital')).toBeVisible();
    await expect(page.getByText('25%')).toBeVisible();

    expect(blockedExternal.every((entry) => entry.includes('va.vercel-scripts.com'))).toBe(true);
    expect(pageErrors).toEqual([]);
  });
});
