import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { prisma } from '../../src/config/database';
import { resetCoachRuntimeState } from '../../src/services/coach/coach.service';
import { resetDeterministicCoachProviderCalls } from '../../src/services/coach/providers/deterministic.provider';

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

async function registerUser(prefix: string) {
  const authCredential = `credential-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const response = await request(app).post('/api/auth/register').send({
    email: uniqueEmail(prefix),
    password: authCredential,
    fullName: 'Coach User',
  });

  expect(response.status).toBe(201);

  return {
    accessToken: response.body.accessToken as string,
    userId: response.body.user.id as string,
  };
}

describe('llm coach endpoint', () => {
  const originalConfig = {
    llmCoachEnabled: env.llmCoachEnabled,
    llmProvider: env.llmProvider,
    llmCoachWindowLimit: env.llmCoachWindowLimit,
    llmCoachCacheTtlSeconds: env.llmCoachCacheTtlSeconds,
  };

  beforeEach(() => {
    env.llmCoachEnabled = true;
    env.llmProvider = 'deterministic';
    env.llmCoachWindowLimit = 20;
    env.llmCoachCacheTtlSeconds = 300;
    resetCoachRuntimeState();
    resetDeterministicCoachProviderCalls();
  });

  afterEach(() => {
    env.llmCoachEnabled = originalConfig.llmCoachEnabled;
    env.llmProvider = originalConfig.llmProvider;
    env.llmCoachWindowLimit = originalConfig.llmCoachWindowLimit;
    env.llmCoachCacheTtlSeconds = originalConfig.llmCoachCacheTtlSeconds;
    resetCoachRuntimeState();
    resetDeterministicCoachProviderCalls();
  });

  it('blocks coach access when the feature flag is disabled', async () => {
    env.llmCoachEnabled = false;
    const { accessToken } = await registerUser('coach-disabled');

    const response = await request(app)
      .post('/api/v1/coach/messages')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ message: 'How should I progress my bench press?' });

    expect(response.status).toBe(503);
    expect(response.body.error).toContain('disabled');
  });

  it('returns a guarded response for injury and medical questions without calling the provider', async () => {
    const { accessToken } = await registerUser('coach-guardrail');

    const response = await request(app)
      .post('/api/v1/coach/messages')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ message: 'My knee hurts sharply when squatting. What should I do?' });

    expect(response.status).toBe(200);
    expect(response.body.safety.escalatedToProfessional).toBe(true);
    expect(response.body.answer).toContain('qualified professional');
    expect(response.body.provider).toBe('guardrail');
  });

  it('generates a contextual deterministic answer and persists bounded conversation memory', async () => {
    const { accessToken, userId } = await registerUser('coach-context');

    await prisma.user.update({
      where: { id: userId },
      data: {
        trainingGoal: 'build_muscle',
        trainingDaysPerWeek: 4,
        limitations: ['limited shoulder mobility'],
        experienceLevel: 'intermediate',
      },
    });

    const response = await request(app)
      .post('/api/v1/coach/messages')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ message: 'Give me one practical adjustment for this training week.' });

    expect(response.status).toBe(200);
    expect(response.body.answer).toContain('build_muscle');
    expect(response.body.answer).toContain('limited shoulder mobility');
    expect(response.body.safety.withinScope).toBe(true);
    expect(response.body.usage.estimatedTotalTokens).toBeGreaterThan(0);

    const messages = await prisma.coachMessage.findMany({
      where: { conversation: { userId } },
      orderBy: { createdAt: 'asc' },
    });

    expect(messages).toHaveLength(2);
    expect(messages.map((message) => message.role)).toEqual(['user', 'assistant']);
  });

  it('dedupes repeated prompts (persistent idempotent replay replaces the per-process cache) without extra turns', async () => {
    const { accessToken, userId } = await registerUser('coach-cache');
    const payload = { message: 'How can I improve workout adherence this week?' };

    const first = await request(app)
      .post('/api/v1/coach/messages')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payload);
    const second = await request(app)
      .post('/api/v1/coach/messages')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payload);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    // Behaviour change: legacy clients (no Idempotency-Key) get a server-derived short-window key, so the
    // repeat is a persistent replay (flagged) instead of an in-process cache hit.
    expect(second.body.idempotentReplay).toBe(true);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(second.headers['deprecation']).toBe('true');

    const messages = await prisma.coachMessage.findMany({
      where: { conversation: { userId } },
    });

    expect(messages).toHaveLength(2);
  });

  it('enforces per-user cost control rate limits', async () => {
    env.llmCoachWindowLimit = 1;
    env.llmCoachCacheTtlSeconds = 0;
    const { accessToken } = await registerUser('coach-rate-limit');

    const first = await request(app)
      .post('/api/v1/coach/messages')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ message: 'Plan my next workout focus.' });
    const second = await request(app)
      .post('/api/v1/coach/messages')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ message: 'Plan my next nutrition focus.' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.body.error).toContain('rate limit');
  });
});
