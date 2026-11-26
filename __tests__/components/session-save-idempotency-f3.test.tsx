/**
 * Session save idempotency F3 — client side. A retry after a failed save must resend the SAME frozen payload with the
 * SAME Idempotency-Key, even after time passed or the page was reloaded, so the server can deduplicate it.
 * Written before the fix (red on purpose). Spec: sdd/features/session-save-idempotency-f3/.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ActiveWorkoutPage from '@/app/workouts/[id]/start/page';
import { sessionsApi, workoutsApi, type Workout } from '@/lib/api';
import { ApiError } from '@/lib/api/client';

// Full-page renders with several interactions: the 5 s default is too tight when the whole suite runs in parallel.
jest.setTimeout(20000);

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'workout-1' }),
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
}));
jest.mock('@/components/protected-dashboard-page', () => ({
  ProtectedDashboardPage: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/lib/contexts/language-context', () => ({ useLanguage: () => ({ language: 'es', setLanguage: jest.fn() }) }));
jest.mock('@/lib/contexts/auth-context', () => ({ useAuth: () => ({ user: { id: 'user-1', email: 'qa@example.test' } }) }));
jest.mock('@/lib/product-events', () => ({ trackProductEvent: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/localized-exercise-copy', () => ({
  getLocalizedExerciseCopy: (exercise: { name: string }) => ({ name: exercise.name, description: '', instructions: [] }),
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
const mockedCreate = sessionsApi.create as unknown as jest.Mock;

const workout = {
  id: 'workout-1',
  userId: 'user-1',
  name: 'Upper body',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  exercises: [
    {
      id: 'we-1', exerciseId: 'ex-bench', sets: 2, reps: 10, rest: 90, order: 0,
      exercise: { id: 'ex-bench', name: 'Bench Press', category: 'strength', muscleGroup: 'chest', equipment: 'barbell', difficulty: 'beginner', description: '', instructions: [] },
    },
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

async function completeOneSetAndFinish() {
  await screen.findByLabelText('Bench Press serie 1 repeticiones');
  fireEvent.change(screen.getByLabelText('Bench Press serie 1 peso en kilogramos'), { target: { value: '60' } });
  fireEvent.click(screen.getByRole('button', { name: 'Bench Press · serie 1 · marcar serie' }));
  fireEvent.click(screen.getByRole('button', { name: /Finalizar y registrar/ }));
}

const finishAgain = () => fireEvent.click(screen.getByRole('button', { name: /Finalizar y registrar/ }));
const DRAFT_KEY = 'anclora-active-workout:user-1:workout-1';
const keyOf = (call: unknown[]) => (call[1] as { idempotencyKey?: string } | undefined)?.idempotencyKey;

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  mockedGetById.mockResolvedValue(workout);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('session save idempotency F3 — client', () => {
  it('F3-AC06 sends an Idempotency-Key with the save', async () => {
    mockedCreate.mockResolvedValueOnce({ id: 'session-1' });
    renderPage();
    await completeOneSetAndFinish();

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    expect(keyOf(mockedCreate.mock.calls[0])).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);
  });

  it('F3-AC07 a retry after a failed save resends the same frozen payload with the same key, even minutes later', async () => {
    jest.useFakeTimers({ advanceTimers: true });
    mockedCreate.mockRejectedValueOnce(new Error('Network down')).mockResolvedValueOnce({ id: 'session-1' });
    renderPage();
    await completeOneSetAndFinish();
    await screen.findByRole('alert');

    jest.setSystemTime(Date.now() + 3 * 60 * 1000); // the user retries three minutes later
    finishAgain();

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(2));
    const [first, second] = mockedCreate.mock.calls;
    expect(keyOf(second)).toBe(keyOf(first));
    expect(second[0]).toEqual(first[0]); // same duration and sets: the server sees the same request hash
  });

  it('F3-AC08 the pending key and payload survive a reload of the page', async () => {
    mockedCreate.mockRejectedValueOnce(new Error('Network down')).mockResolvedValueOnce({ id: 'session-1' });
    const view = renderPage();
    await completeOneSetAndFinish();
    await screen.findByRole('alert');
    view.unmount();

    renderPage();
    await screen.findByLabelText('Bench Press serie 1 repeticiones');
    finishAgain();

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(2));
    const [first, second] = mockedCreate.mock.calls;
    expect(keyOf(second)).toBe(keyOf(first));
    expect(second[0]).toEqual(first[0]);
  });

  it('F3-AC09 after a successful save the next session of the same routine uses a new key', async () => {
    mockedCreate.mockResolvedValue({ id: 'session-x' });
    const view = renderPage();
    await completeOneSetAndFinish();
    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/progress'));
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull(); // no ghost draft after a saved session
    view.unmount();

    renderPage();
    await completeOneSetAndFinish();
    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(2));
    expect(keyOf(mockedCreate.mock.calls[1])).not.toBe(keyOf(mockedCreate.mock.calls[0]));
  });

  it('F3 D1 while a save is pending the sets are locked and the draft can be discarded', async () => {
    mockedCreate.mockRejectedValueOnce(new Error('Network down'));
    renderPage();
    await completeOneSetAndFinish();
    await screen.findByRole('alert');

    expect(screen.getByLabelText('Bench Press serie 1 peso en kilogramos')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bench Press · serie 1 · hecha' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('registro pendiente');

    fireEvent.click(screen.getByRole('button', { name: 'Descartar y empezar de nuevo' }));
    expect(screen.getByLabelText('Bench Press serie 1 peso en kilogramos')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Bench Press · serie 1 · marcar serie' })).toBeEnabled();
  });

  it('F3 D2 a 422 conflict says the session was already saved and offers to discard the draft', async () => {
    mockedCreate.mockRejectedValueOnce(new ApiError('Idempotency-Key was already used with a different session', 422));
    renderPage();
    await completeOneSetAndFinish();

    expect(await screen.findByRole('alert')).toHaveTextContent('ya se registró con otros datos');
    expect(screen.getByRole('button', { name: /Finalizar y registrar/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar borrador e ir a Progreso' }));
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/progress');
  });
});
