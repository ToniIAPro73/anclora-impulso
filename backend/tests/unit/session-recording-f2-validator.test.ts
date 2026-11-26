/**
 * Session recording F2 — request validation of POST /api/sessions (no database).
 * Spec: sdd/features/session-recording-f2/session-recording-f2-spec-v1.md (F2-AC06, F2-AC08). Decisions D1 and D4.
 */
import { createSessionSchema, MAX_SESSION_DURATION_SECONDS } from '../../src/utils/validators';

const workoutId = '6f1c2b8e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const exerciseId = '0b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e';
const set = (overrides: Record<string, unknown> = {}) => ({ reps: 10, weight: 12.5, order: 0, ...overrides });

const v2 = (overrides: Record<string, unknown> = {}) => ({
  workoutId,
  duration: 1800,
  recordingVersion: 2,
  exercises: [{ exerciseId, sets: [set()] }],
  ...overrides,
});

const legacy = (overrides: Record<string, unknown> = {}) => {
  const { recordingVersion: _omit, ...rest } = v2(overrides);
  return rest;
};

describe('createSessionSchema — faithful sessions (recordingVersion 2)', () => {
  it('accepts a valid faithful session', () => {
    expect(createSessionSchema.safeParse(v2()).success).toBe(true);
  });

  it('D1: rejects a duration above 4 h and accepts exactly 4 h', () => {
    expect(MAX_SESSION_DURATION_SECONDS).toBe(14_400);
    expect(createSessionSchema.safeParse(v2({ duration: 14_400 })).success).toBe(true);
    expect(createSessionSchema.safeParse(v2({ duration: 14_401 })).success).toBe(false);
  });

  it('rejects a session without exercises or an exercise without sets', () => {
    expect(createSessionSchema.safeParse(v2({ exercises: [] })).success).toBe(false);
    expect(createSessionSchema.safeParse(v2({ exercises: [{ exerciseId, sets: [] }] })).success).toBe(false);
  });

  it('rejects reps below 1 and weights with more than 2 decimals', () => {
    expect(createSessionSchema.safeParse(v2({ exercises: [{ exerciseId, sets: [set({ reps: 0 })] }] })).success).toBe(false);
    expect(createSessionSchema.safeParse(v2({ exercises: [{ exerciseId, sets: [set({ weight: 12.555 })] }] })).success).toBe(false);
    expect(createSessionSchema.safeParse(v2({ exercises: [{ exerciseId, sets: [set({ weight: 0 })] }] })).success).toBe(true);
  });

  it('rejects unknown recording versions', () => {
    expect(createSessionSchema.safeParse(v2({ recordingVersion: 3 })).success).toBe(false);
  });
});

describe('createSessionSchema — legacy clients (no recordingVersion, decision D4)', () => {
  it('keeps the pre-F2 rules: no duration ceiling, empty exercise list allowed', () => {
    expect(createSessionSchema.safeParse(legacy({ duration: 259_200 })).success).toBe(true);
    expect(createSessionSchema.safeParse(legacy({ exercises: [] })).success).toBe(true);
  });

  it('still rejects reps below 1 as before', () => {
    expect(createSessionSchema.safeParse(legacy({ exercises: [{ exerciseId, sets: [set({ reps: 0 })] }] })).success).toBe(false);
  });
});
