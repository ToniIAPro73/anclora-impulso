import request from 'supertest';
import app from '../../src/app';

jest.setTimeout(30000);

describe('Ruta Vital 50-60 API', () => {
  it('supports opt-in, safety-aware onboarding, weekly home and action continuity', async () => {
    const register = await request(app).post('/api/auth/register').send({
      email: `health-plan-${Date.now()}@example.com`,
      password: 'password123',
      fullName: 'Synthetic Health Plan Fixture',
    });
    expect(register.status).toBe(201);
    const token = register.body.accessToken as string;
    const auth = { Authorization: `Bearer ${token}` };

    const profile = await request(app).put('/api/profile').set(auth).send({ age: 55 });
    expect(profile.status).toBe(200);

    const definitions = await request(app).get('/api/health-plans/definitions?locale=en');
    expect(definitions.status).toBe(200);
    expect(definitions.body[0]).toMatchObject({ key: 'ruta-vital-50-60', minAge: 50, maxAge: 60 });

    const enrollment = await request(app).post('/api/health-plans/enrollment').set(auth).send({});
    expect(enrollment.status).toBe(201);

    const beforeOnboarding = await request(app).get('/api/health-plans/home').set(auth);
    expect(beforeOnboarding.status).toBe(200);
    expect(beforeOnboarding.body.enrollment.onboardingComplete).toBe(false);
    expect(beforeOnboarding.body.week.minimumVersion).toBeDefined();

    const onboarding = await request(app).post('/api/health-plans/onboarding').set(auth).send({
      goal: 'strength',
      baselineActivity: 'irregular',
      availableTime: '30',
      preferences: ['morning'],
      equipment: ['bodyweight'],
      knownLimitations: [],
      safetySignals: ['recent_injury'],
    });
    expect(onboarding.status).toBe(200);
    expect(onboarding.body.safetyCategory).toBe('PROFESSIONAL_REVIEW_RECOMMENDED');

    const home = await request(app).get('/api/health-plans/home?locale=en').set(auth);
    expect(home.status).toBe(200);
    expect(home.body).toMatchObject({
      enrollment: { onboardingComplete: true, safetyCategory: 'PROFESSIONAL_REVIEW_RECOMMENDED', adaptation: 'REDUCE' },
      phase: { key: 'FOUNDATION' },
      week: { number: 1 },
    });
    const actionId = home.body.actions[0].id as string;

    const complete = await request(app).post(`/api/health-plans/actions/${actionId}/complete`).set(auth).send({});
    expect(complete.status).toBe(200);

    const afterComplete = await request(app).get('/api/health-plans/home').set(auth);
    expect(afterComplete.body.week.progress).toBeGreaterThan(0);

    const paused = await request(app).put('/api/health-plans/enrollment/status').set(auth).send({ status: 'paused' });
    expect(paused.status).toBe(200);
    const resumed = await request(app).put('/api/health-plans/enrollment/status').set(auth).send({ status: 'active' });
    expect(resumed.status).toBe(200);
  });

  it('rejects an explicit opt-in outside the cohort boundary', async () => {
    const register = await request(app).post('/api/auth/register').send({
      email: `health-plan-boundary-${Date.now()}@example.com`,
      password: 'password123',
      fullName: 'Boundary Fixture',
    });
    const token = register.body.accessToken as string;
    await request(app).put('/api/profile').set('Authorization', `Bearer ${token}`).send({ age: 61 });
    const response = await request(app).post('/api/health-plans/enrollment').set('Authorization', `Bearer ${token}`).send({});
    expect(response.status).toBe(422);
  });
});
