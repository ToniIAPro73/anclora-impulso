/**
 * Session recording F2 — reproduces the current recording defects of the active-workout page
 * (`app/workouts/[id]/start/page.tsx`). Written BEFORE the fix (red on purpose): each test states the
 * F2 acceptance behaviour; all of them failed against the pre-F2 code (6/6 red on 2026-11-26). See sdd/features/session-recording-f2/.
 *
 * Out of scope here: idempotent save / retries (F3).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ActiveWorkoutPage from '@/app/workouts/[id]/start/page';
import { sessionsApi, workoutsApi, type Workout } from '@/lib/api';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'workout-1' }),
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
}));

jest.mock('@/components/protected-dashboard-page', () => ({
  ProtectedDashboardPage: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/lib/contexts/language-context', () => ({
  useLanguage: () => ({ language: 'es', setLanguage: jest.fn() }),
}));

jest.mock('@/lib/contexts/auth-context', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'qa@example.test' } }),
}));

jest.mock('@/lib/product-events', () => ({
  trackProductEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/localized-exercise-copy', () => ({
  getLocalizedExerciseCopy: (exercise: { name: string; description?: string }) => ({
    name: exercise.name,
    description: exercise.description ?? '',
    instructions: [],
  }),
}));

jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return {
    ...actual,
    workoutsApi: { ...actual.workoutsApi, getById: jest.fn() },
    sessionsApi: { ...actual.sessionsApi, create: jest.fn() },
  };
});

const mockedGetById = workoutsApi.getById as jest.MockedFunction<typeof workoutsApi.getById>;
const mockedCreate = sessionsApi.create as jest.MockedFunction<typeof sessionsApi.create>;

const DRAFT_KEY = 'anclora-active-workout:user-1:workout-1';
const MAX_ACCEPTED_DURATION_SECONDS = 4 * 60 * 60; // inactivity threshold decided by Toni (4 h); see decisions D1/D3

function exercise(id: string, name: string, equipment: string) {
  return {
    id,
    name,
    category: 'strength',
    muscleGroup: 'chest',
    equipment,
    difficulty: 'beginner',
    description: `${name} description`,
    instructions: [],
  };
}

const workout = {
  id: 'workout-1',
  userId: 'user-1',
  name: 'Upper body',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  exercises: [
    { id: 'we-1', exerciseId: 'ex-bench', sets: 3, reps: 10, rest: 90, order: 0, exercise: exercise('ex-bench', 'Bench Press', 'barbell') },
    { id: 'we-2', exerciseId: 'ex-pushup', sets: 2, reps: 12, rest: 60, order: 1, exercise: exercise('ex-pushup', 'Push-ups', 'bodyweight') },
  ],
} as unknown as Workout;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ActiveWorkoutPage />
    </QueryClientProvider>,
  );
}

async function waitForExercise(name: string) {
  await screen.findByLabelText(`${name} serie 1 repeticiones`);
}

function setField(exerciseName: string, setNumber: number, field: 'repeticiones' | 'peso en kilogramos', value: string) {
  fireEvent.change(screen.getByLabelText(`${exerciseName} serie ${setNumber} ${field}`), { target: { value } });
}

function markSetDone(exerciseName: string, setNumber: number) {
  fireEvent.click(screen.getByRole('button', { name: `${exerciseName} · serie ${setNumber} · marcar serie` }));
}

function finish() {
  fireEvent.click(screen.getByRole('button', { name: /Finalizar y registrar/ }));
}

type SentPayload = Parameters<typeof sessionsApi.create>[0];
const sentPayload = (): SentPayload => mockedCreate.mock.calls[0][0];

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  mockedGetById.mockResolvedValue(workout);
  mockedCreate.mockResolvedValue({ id: 'session-1' } as Awaited<ReturnType<typeof sessionsApi.create>>);
});

describe('session recording F2 — active-workout page', () => {
  it('F2-AC01 sends only the sets marked as completed', async () => {
    renderPage();
    await waitForExercise('Bench Press');

    setField('Bench Press', 1, 'repeticiones', '8');
    setField('Bench Press', 1, 'peso en kilogramos', '60');
    markSetDone('Bench Press', 1);
    finish();

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    const payload = sentPayload();
    // Current defect: all 5 planned sets are sent (3 bench + 2 push-ups), completed or not.
    expect(payload.exercises).toHaveLength(1);
    expect(payload.exercises[0].exerciseId).toBe('ex-bench');
    expect(payload.exercises[0].sets).toHaveLength(1);
    expect(payload.exercises[0].sets[0]).toMatchObject({ reps: 8, weight: 60 });
  });

  it('F2-AC02 a completed set with empty reps is not filled with the target reps', async () => {
    renderPage();
    await waitForExercise('Bench Press');

    setField('Bench Press', 1, 'repeticiones', '');
    setField('Bench Press', 1, 'peso en kilogramos', '60');
    markSetDone('Bench Press', 1);
    finish();

    // Current defect: `Number('') || exercise.reps` records 10 reps that were never entered.
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('F2-AC03 accepts a decimal comma in the weight ("12,5" -> 12.5)', async () => {
    renderPage();
    await waitForExercise('Bench Press');

    setField('Bench Press', 1, 'repeticiones', '10');
    setField('Bench Press', 1, 'peso en kilogramos', '12,5');
    markSetDone('Bench Press', 1);
    finish();

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    // Current defect: Number('12,5') is NaN and `|| 0` records 0 kg.
    expect(sentPayload().exercises[0].sets[0].weight).toBe(12.5);
  });

  it('F2-AC04 the duration is not measured from the start of an old restored draft', async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        startedAt: threeDaysAgo,
        notes: '',
        sets: {
          'ex-bench': [
            { reps: '10', weight: '50', rir: '', rpe: '', restSeconds: '90', completed: true },
            { reps: '10', weight: '50', rir: '', rpe: '', restSeconds: '90', completed: false },
            { reps: '10', weight: '50', rir: '', rpe: '', restSeconds: '90', completed: false },
          ],
          'ex-pushup': [
            { reps: '12', weight: '', rir: '', rpe: '', restSeconds: '60', completed: false },
            { reps: '12', weight: '', rir: '', rpe: '', restSeconds: '60', completed: false },
          ],
        },
      }),
    );

    renderPage();
    await waitForExercise('Bench Press');
    // Decision D3: a draft inactive for more than 4 h must be resumed (clock restarts) or discarded before finishing.
    expect(screen.getByRole('button', { name: /Finalizar y registrar/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reanudar borrador' }));
    finish();

    await waitFor(() => expect(mockedCreate).toHaveBeenCalled());
    // Pre-F2 defect: duration = now - draft.startedAt (about 259 200 s for a 3-day-old draft).
    expect(sentPayload().duration).toBeLessThanOrEqual(MAX_ACCEPTED_DURATION_SECONDS);
    // The set marked in the old draft is kept after resuming.
    expect(sentPayload().exercises[0].sets[0]).toMatchObject({ reps: 10, weight: 50, order: 0 });
  });

  it('F2-AC04 (D3) discarding an old draft starts the session from scratch', async () => {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        startedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        notes: 'old',
        sets: { 'ex-bench': [{ reps: '10', weight: '50', rir: '', rpe: '', restSeconds: '90', completed: true }], 'ex-pushup': [] },
      }),
    );
    renderPage();
    await waitForExercise('Bench Press');
    fireEvent.click(screen.getByRole('button', { name: 'Descartar borrador' }));

    expect(screen.queryByRole('button', { name: 'Reanudar borrador' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bench Press · serie 1 · marcar serie' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Bench Press · serie \d · marcar serie/ })).toHaveLength(3);
  });

  it('F2-AC07 an empty weight is accepted on a bodyweight exercise and blocked on a loaded one', async () => {
    renderPage();
    await waitForExercise('Bench Press');

    markSetDone('Bench Press', 1); // reps prefilled with the plan, weight left empty
    finish();
    expect(await screen.findByRole('alert')).toHaveTextContent('Bench Press, serie 1: indica peso.');
    expect(screen.getByLabelText('Bench Press serie 1 peso en kilogramos')).toHaveAttribute('aria-invalid', 'true');
    expect(mockedCreate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Bench Press · serie 1 · hecha' })); // unmark the loaded set
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente ejercicio' }));
    await waitForExercise('Push-ups');
    markSetDone('Push-ups', 1);
    finish();

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    expect(sentPayload().exercises).toEqual([
      { exerciseId: 'ex-pushup', sets: [{ reps: 12, weight: 0, rir: undefined, rpe: undefined, restSeconds: 60, order: 0 }] },
    ]);
  });

  it('F2-AC09 finishing without any completed set is blocked and the draft is kept', async () => {
    renderPage();
    await waitForExercise('Bench Press');
    finish();

    expect(await screen.findByRole('alert')).toHaveTextContent('Marca como hecha al menos una serie');
    expect(mockedCreate).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull();
  });

  it('F2-AC05 a failed save shows an error, keeps the draft and does not navigate away', async () => {
    mockedCreate.mockRejectedValueOnce(new Error('Network down'));
    renderPage();
    await waitForExercise('Bench Press');

    setField('Bench Press', 1, 'repeticiones', '10');
    setField('Bench Press', 1, 'peso en kilogramos', '40');
    markSetDone('Bench Press', 1);
    finish();

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    // Current defect: try/finally without catch — the rejection escapes, nothing is shown to the user.
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Finalizar y registrar/ })).toBeEnabled();
  });

  it('F2-AC06 marks the session as a faithful recording (recordingVersion = 2)', async () => {
    renderPage();
    await waitForExercise('Bench Press');

    setField('Bench Press', 1, 'repeticiones', '10');
    setField('Bench Press', 1, 'peso en kilogramos', '40');
    markSetDone('Bench Press', 1);
    finish();

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    expect(sentPayload()).toMatchObject({ recordingVersion: 2 });
  });
});
