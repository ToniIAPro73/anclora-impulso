/**
 * Session recording F2 — rules that turn an active-workout draft into a faithful session payload.
 * Spec: sdd/features/session-recording-f2/session-recording-f2-spec-v1.md. Decisions D1–D4 approved by Toni (2026-11-26).
 *
 * Only completed sets are recorded, nothing the user did not enter is invented, and the duration is the active time.
 */

/** Sessions recorded with these rules. Legacy sessions (before F2) are version 1 and are excluded from records/progression. */
export const RECORDING_VERSION = 2 as const;

/** Inactivity threshold decided by Toni: a gap longer than this is not training time. */
export const INACTIVITY_THRESHOLD_MS = 4 * 60 * 60 * 1000;

/** D1: maximum duration accepted by the API for a faithful session (4 h). Kept in sync with the backend validator. */
export const MAX_SESSION_DURATION_SECONDS = 4 * 60 * 60;

/**
 * D2: equipment values whose exercises can be performed without an external load in kilograms, so an empty weight is
 * recorded as 0. `resistance_bands` is included because band tension has no kilogram value.
 */
export const BODYWEIGHT_EQUIPMENT: readonly string[] = [
  'bodyweight',
  'pull_up_bar',
  'plyo_box',
  'stairs',
  'jump_rope',
  'ab_wheel',
  'battle_ropes',
  'assault_bike',
  'resistance_bands',
];

const MAX_RIR = 5;
const MAX_RPE = 10;
const MAX_REST_SECONDS = 3600;

export type DraftSet = {
  reps: string;
  weight: string;
  rir: string;
  rpe: string;
  restSeconds: string;
  completed: boolean;
};

export type PlannedExercise = {
  exerciseId: string;
  equipment: string;
  reps: number;
  rest: number;
};

export type RecordedSet = {
  reps: number;
  weight: number;
  rir?: number;
  rpe?: number;
  restSeconds?: number;
  order: number;
};

export type SessionPayload = {
  workoutId: string;
  duration: number;
  notes?: string;
  recordingVersion: typeof RECORDING_VERSION;
  exercises: Array<{ exerciseId: string; sets: RecordedSet[] }>;
};

export type RecordingIssue = {
  exerciseId: string;
  setIndex: number;
  field: 'reps' | 'weight' | 'rir' | 'rpe' | 'restSeconds' | 'sets';
  code: 'required' | 'invalid' | 'no_completed_sets';
};

export type BuildResult = { ok: true; payload: SessionPayload } | { ok: false; issues: RecordingIssue[] };

const DECIMAL_PATTERN = /^\d+(?:[.,]\d{1,2})?$/;
const INTEGER_PATTERN = /^\d+$/;

/** `undefined` = empty input, `null` = invalid, otherwise the value. Accepts `,` or `.` and at most 2 decimals. */
export function parseDecimalInput(raw: string): number | null | undefined {
  const value = raw.trim();
  if (value === '') return undefined;
  if (!DECIMAL_PATTERN.test(value)) return null;
  return Number(value.replace(',', '.'));
}

/** `undefined` = empty input, `null` = invalid, otherwise the whole number. */
export function parseIntegerInput(raw: string): number | null | undefined {
  const value = raw.trim();
  if (value === '') return undefined;
  if (!INTEGER_PATTERN.test(value)) return null;
  return Number(value);
}

export function allowsBodyweight(equipment: string): boolean {
  return BODYWEIGHT_EQUIPMENT.includes(equipment);
}

/**
 * Active training time in seconds: from `startedAt` to now, or to the last activity when the user has been inactive for
 * longer than the threshold. A missing `lastActivityAt` (legacy draft) counts as the start. Clamped to [1, maximum].
 */
export function computeActiveDurationSeconds(input: { startedAt: string; lastActivityAt?: string; now: Date }): number {
  const start = new Date(input.startedAt).getTime();
  const lastActivity = input.lastActivityAt ? new Date(input.lastActivityAt).getTime() : start;
  const now = input.now.getTime();
  const end = now - lastActivity > INACTIVITY_THRESHOLD_MS ? lastActivity : now;
  const seconds = Math.round((end - start) / 1000);
  if (!Number.isFinite(seconds)) return 1;
  return Math.min(MAX_SESSION_DURATION_SECONDS, Math.max(1, seconds));
}

/** D3: a draft is stale when its last activity (or its start, for drafts created before F2) is older than 4 h. */
export function isDraftStale(draft: { startedAt: string; lastActivityAt?: string }, now: Date): boolean {
  const reference = new Date(draft.lastActivityAt ?? draft.startedAt).getTime();
  return Number.isFinite(reference) && now.getTime() - reference > INACTIVITY_THRESHOLD_MS;
}

function optionalNumber(
  raw: string,
  parse: (value: string) => number | null | undefined,
  max: number,
): { value?: number; invalid: boolean } {
  const parsed = parse(raw ?? '');
  if (parsed === undefined) return { invalid: false };
  if (parsed === null || parsed > max) return { invalid: true };
  return { value: parsed, invalid: false };
}

export function buildSessionPayload(input: {
  workoutId: string;
  exercises: PlannedExercise[];
  sets: Record<string, DraftSet[]>;
  notes: string;
  durationSeconds: number;
}): BuildResult {
  const issues: RecordingIssue[] = [];
  const recorded: SessionPayload['exercises'] = [];
  let completedCount = 0;

  for (const exercise of input.exercises) {
    const sets: RecordedSet[] = [];
    (input.sets[exercise.exerciseId] ?? []).forEach((set, setIndex) => {
      if (!set.completed) return;
      completedCount += 1;
      const issue = (field: RecordingIssue['field'], code: RecordingIssue['code']) =>
        issues.push({ exerciseId: exercise.exerciseId, setIndex, field, code });

      const reps = parseIntegerInput(set.reps ?? '');
      if (reps === undefined) issue('reps', 'required');
      else if (reps === null || reps < 1) issue('reps', 'invalid');

      let weight = parseDecimalInput(set.weight ?? '');
      if (weight === undefined) {
        if (allowsBodyweight(exercise.equipment)) weight = 0;
        else issue('weight', 'required');
      } else if (weight === null) {
        issue('weight', 'invalid');
      }

      const rir = optionalNumber(set.rir, parseIntegerInput, MAX_RIR);
      if (rir.invalid) issue('rir', 'invalid');
      const rpe = optionalNumber(set.rpe, parseDecimalInput, MAX_RPE);
      if (rpe.invalid) issue('rpe', 'invalid');
      const rest = optionalNumber(set.restSeconds, parseIntegerInput, MAX_REST_SECONDS);
      if (rest.invalid) issue('restSeconds', 'invalid');

      if (typeof reps === 'number' && reps >= 1 && typeof weight === 'number') {
        sets.push({ reps, weight, rir: rir.value, rpe: rpe.value, restSeconds: rest.value, order: setIndex });
      }
    });
    if (sets.length > 0) recorded.push({ exerciseId: exercise.exerciseId, sets });
  }

  if (completedCount === 0) {
    return { ok: false, issues: [{ exerciseId: '*', setIndex: -1, field: 'sets', code: 'no_completed_sets' }] };
  }
  if (issues.length > 0) return { ok: false, issues };

  const notes = input.notes.trim();
  return {
    ok: true,
    payload: {
      workoutId: input.workoutId,
      duration: input.durationSeconds,
      notes: notes === '' ? undefined : notes,
      recordingVersion: RECORDING_VERSION,
      exercises: recorded,
    },
  };
}
