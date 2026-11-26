/**
 * Session recording F2 — pure recording rules (sdd/features/session-recording-f2/).
 */
import {
  BODYWEIGHT_EQUIPMENT,
  INACTIVITY_THRESHOLD_MS,
  MAX_SESSION_DURATION_SECONDS,
  RECORDING_VERSION,
  allowsBodyweight,
  buildSessionPayload,
  computeActiveDurationSeconds,
  isDraftStale,
  parseDecimalInput,
  parseIntegerInput,
  type DraftSet,
  type PlannedExercise,
} from '@/lib/session-recording';

const HOUR = 60 * 60 * 1000;

describe('parseDecimalInput', () => {
  it.each([
    ['12,5', 12.5],
    ['12.5', 12.5],
    ['12', 12],
    [' 7,25 ', 7.25],
    ['0', 0],
    ['0,5', 0.5],
  ])('parses %p as %p', (raw, expected) => {
    expect(parseDecimalInput(raw)).toBe(expected);
  });

  it.each(['abc', '1,234', '12,555', '-5', '12,', ',5', '1.2.3', '12 5'])('rejects %p', (raw) => {
    expect(parseDecimalInput(raw)).toBeNull();
  });

  it('returns undefined for empty input', () => {
    expect(parseDecimalInput('')).toBeUndefined();
    expect(parseDecimalInput('   ')).toBeUndefined();
  });
});

describe('parseIntegerInput', () => {
  it('parses whole numbers and rejects decimals or text', () => {
    expect(parseIntegerInput('8')).toBe(8);
    expect(parseIntegerInput(' 12 ')).toBe(12);
    expect(parseIntegerInput('8,5')).toBeNull();
    expect(parseIntegerInput('x')).toBeNull();
    expect(parseIntegerInput('')).toBeUndefined();
  });
});

describe('allowsBodyweight', () => {
  it('accepts unloaded equipment and rejects external loads', () => {
    for (const equipment of BODYWEIGHT_EQUIPMENT) expect(allowsBodyweight(equipment)).toBe(true);
    for (const equipment of ['barbell', 'dumbbells', 'machine', 'cables', 'kettlebell']) {
      expect(allowsBodyweight(equipment)).toBe(false);
    }
  });
});

describe('computeActiveDurationSeconds', () => {
  const start = new Date('2026-11-26T10:00:00.000Z');

  it('measures from start to now while the user is active', () => {
    const now = new Date(start.getTime() + 45 * 60 * 1000);
    expect(computeActiveDurationSeconds({ startedAt: start.toISOString(), lastActivityAt: now.toISOString(), now })).toBe(2700);
  });

  it('stops at the last activity when the gap to now exceeds the inactivity threshold', () => {
    const lastActivity = new Date(start.getTime() + 50 * 60 * 1000);
    const now = new Date(lastActivity.getTime() + INACTIVITY_THRESHOLD_MS + 1000);
    expect(
      computeActiveDurationSeconds({ startedAt: start.toISOString(), lastActivityAt: lastActivity.toISOString(), now }),
    ).toBe(3000);
  });

  it('never exceeds the API maximum and is at least one second', () => {
    const now = new Date(start.getTime() + 3.9 * HOUR);
    expect(computeActiveDurationSeconds({ startedAt: new Date(start.getTime() - 10 * HOUR).toISOString(), lastActivityAt: now.toISOString(), now }))
      .toBe(MAX_SESSION_DURATION_SECONDS);
    expect(computeActiveDurationSeconds({ startedAt: now.toISOString(), lastActivityAt: now.toISOString(), now })).toBe(1);
    // clock skew: start in the future
    expect(computeActiveDurationSeconds({ startedAt: new Date(now.getTime() + 60_000).toISOString(), lastActivityAt: now.toISOString(), now })).toBe(1);
  });

  it('treats a missing lastActivityAt as the start (legacy drafts)', () => {
    const now = new Date(start.getTime() + 2 * 24 * HOUR);
    expect(computeActiveDurationSeconds({ startedAt: start.toISOString(), lastActivityAt: undefined, now })).toBe(1);
  });
});

describe('isDraftStale', () => {
  const now = new Date('2026-11-26T20:00:00.000Z');
  it('is stale when the last activity (or the start, for legacy drafts) is older than 4 h', () => {
    expect(isDraftStale({ startedAt: new Date(now.getTime() - 5 * HOUR).toISOString() }, now)).toBe(true);
    expect(isDraftStale({ startedAt: new Date(now.getTime() - 5 * HOUR).toISOString(), lastActivityAt: new Date(now.getTime() - HOUR).toISOString() }, now)).toBe(false);
    expect(isDraftStale({ startedAt: new Date(now.getTime() - HOUR).toISOString() }, now)).toBe(false);
  });
});

describe('buildSessionPayload', () => {
  const exercises: PlannedExercise[] = [
    { exerciseId: 'bench', equipment: 'barbell', reps: 10, rest: 90 },
    { exerciseId: 'pushup', equipment: 'bodyweight', reps: 12, rest: 60 },
  ];
  const set = (overrides: Partial<DraftSet> = {}): DraftSet => ({
    reps: '10', weight: '', rir: '', rpe: '', restSeconds: '90', completed: false, ...overrides,
  });
  const base = { workoutId: 'w1', notes: '', durationSeconds: 1200, exercises };

  it('sends only completed sets, keeps their original position and omits exercises without completed sets', () => {
    const result = buildSessionPayload({
      ...base,
      sets: { bench: [set(), set({ completed: true, reps: '8', weight: '60' })], pushup: [set(), set()] },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload).toEqual({
      workoutId: 'w1',
      duration: 1200,
      notes: undefined,
      recordingVersion: RECORDING_VERSION,
      exercises: [{ exerciseId: 'bench', sets: [{ reps: 8, weight: 60, rir: undefined, rpe: undefined, restSeconds: 90, order: 1 }] }],
    });
  });

  it('refuses a session without any completed set', () => {
    const result = buildSessionPayload({ ...base, sets: { bench: [set()], pushup: [set()] } });
    expect(result).toEqual({ ok: false, issues: [{ exerciseId: '*', setIndex: -1, field: 'sets', code: 'no_completed_sets' }] });
  });

  it('never substitutes empty reps with the target', () => {
    const result = buildSessionPayload({ ...base, sets: { bench: [set({ completed: true, reps: '', weight: '50' })], pushup: [] } });
    expect(result).toEqual({ ok: false, issues: [{ exerciseId: 'bench', setIndex: 0, field: 'reps', code: 'required' }] });
  });

  it('rejects zero or invalid reps', () => {
    const zero = buildSessionPayload({ ...base, sets: { bench: [set({ completed: true, reps: '0', weight: '50' })], pushup: [] } });
    const text = buildSessionPayload({ ...base, sets: { bench: [set({ completed: true, reps: 'ten', weight: '50' })], pushup: [] } });
    expect(zero.ok).toBe(false);
    expect(text.ok).toBe(false);
  });

  it('parses a decimal comma and rejects an invalid weight instead of recording 0', () => {
    const comma = buildSessionPayload({ ...base, sets: { bench: [set({ completed: true, weight: '12,5' })], pushup: [] } });
    expect(comma.ok && comma.payload.exercises[0].sets[0].weight).toBe(12.5);
    const invalid = buildSessionPayload({ ...base, sets: { bench: [set({ completed: true, weight: 'abc' })], pushup: [] } });
    expect(invalid).toEqual({ ok: false, issues: [{ exerciseId: 'bench', setIndex: 0, field: 'weight', code: 'invalid' }] });
  });

  it('accepts an empty weight only on bodyweight exercises (stored as 0)', () => {
    const bodyweight = buildSessionPayload({ ...base, sets: { bench: [], pushup: [set({ completed: true, reps: '12' })] } });
    expect(bodyweight.ok && bodyweight.payload.exercises[0].sets[0].weight).toBe(0);
    const loaded = buildSessionPayload({ ...base, sets: { bench: [set({ completed: true })], pushup: [] } });
    expect(loaded).toEqual({ ok: false, issues: [{ exerciseId: 'bench', setIndex: 0, field: 'weight', code: 'required' }] });
  });

  it('keeps an explicit weight on a bodyweight exercise (weighted variant)', () => {
    const result = buildSessionPayload({ ...base, sets: { bench: [], pushup: [set({ completed: true, reps: '12', weight: '10' })] } });
    expect(result.ok && result.payload.exercises[0].sets[0].weight).toBe(10);
  });

  it('validates optional RIR, RPE and rest without inventing values', () => {
    const ok = buildSessionPayload({
      ...base,
      sets: { bench: [set({ completed: true, weight: '50', rir: '2', rpe: '8,5', restSeconds: '' })], pushup: [] },
    });
    expect(ok.ok && ok.payload.exercises[0].sets[0]).toMatchObject({ rir: 2, rpe: 8.5, restSeconds: undefined });
    const bad = buildSessionPayload({
      ...base,
      sets: { bench: [set({ completed: true, weight: '50', rir: '9', rpe: '11', restSeconds: 'x' })], pushup: [] },
    });
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.issues.map((issue) => issue.field)).toEqual(['rir', 'rpe', 'restSeconds']);
  });

  it('ignores invalid fields on sets that are not completed', () => {
    const result = buildSessionPayload({
      ...base,
      sets: { bench: [set({ completed: true, weight: '50' }), set({ reps: '', weight: 'abc' })], pushup: [] },
    });
    expect(result.ok).toBe(true);
  });

  it('trims notes and drops empty ones', () => {
    const result = buildSessionPayload({ ...base, notes: '  felt strong  ', sets: { bench: [set({ completed: true, weight: '50' })], pushup: [] } });
    expect(result.ok && result.payload.notes).toBe('felt strong');
  });
});
