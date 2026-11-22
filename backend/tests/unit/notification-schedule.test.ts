/**
 * Notification scheduler: lazy mode only touches the DB when a reminder window opens.
 * No real database: loaders/dispatchers are jest mocks.
 */
const mockFindMany = jest.fn();
const envMock = {
  notificationDispatchIntervalMinutes: 15,
  notificationDispatchMode: 'interval',
  notificationLazyRefreshMinutes: 120,
};

jest.mock('../../src/config/database', () => ({ prisma: { user: { findMany: mockFindMany } } }));
jest.mock('../../src/config/env', () => ({ env: envMock }));

import {
  computeNextDueAt,
  createLazyScheduler,
  noteReminderTime,
  resolveDispatchMode,
  startNotificationScheduler,
} from '../../src/services/notification-schedule.service';

const WINDOW = 15 * 60 * 1000;
const REFRESH = 120 * 60 * 1000;
const at = (h: number, m = 0, s = 0) => new Date(2026, 10, 22, h, m, s, 0);

function build(times: Array<string | null> = ['20:00']) {
  const dispatch = jest.fn().mockResolvedValue({ created: 0 });
  const loadReminderTimes = jest.fn().mockResolvedValue(times);
  const scheduler = createLazyScheduler({ dispatch, loadReminderTimes, windowMs: WINDOW, refreshMs: REFRESH });
  return { scheduler, dispatch, loadReminderTimes };
}

describe('computeNextDueAt', () => {
  it('returns today\'s start when before the window, tomorrow\'s when after', () => {
    expect(computeNextDueAt(['20:00'], at(10), WINDOW)).toEqual(at(20));
    const after = computeNextDueAt(['20:00'], at(21), WINDOW)!;
    expect(after.getDate()).toBe(23);
    expect(after.getHours()).toBe(20);
  });

  it('returns now while a window is open and unhandled; next day once handled', () => {
    const now = at(20, 5);
    expect(computeNextDueAt(['20:00'], now, WINDOW)).toEqual(now);
    expect(computeNextDueAt(['20:00'], now, WINDOW, new Set(['2026-11-22:20:00']))!.getDate()).toBe(23);
  });

  it('picks the earliest among several times and null when none', () => {
    expect(computeNextDueAt(['21:00', '08:30'], at(7), WINDOW)).toEqual(at(8, 30));
    expect(computeNextDueAt([], at(7), WINDOW)).toBeNull();
  });
});

describe('lazy scheduler', () => {
  it('does NOT query the database while now < nextDueAt', async () => {
    const { scheduler, dispatch, loadReminderTimes } = build();
    await scheduler.tick(at(10)); // first load only
    expect(loadReminderTimes).toHaveBeenCalledTimes(1);

    loadReminderTimes.mockRejectedValue(new Error('DB must not be queried'));
    dispatch.mockRejectedValue(new Error('DB must not be queried'));
    await expect(scheduler.tick(at(11))).resolves.toBe(false);
    await expect(scheduler.tick(at(11, 59))).resolves.toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
    expect(loadReminderTimes).toHaveBeenCalledTimes(1);
  });

  it('dispatches once when the window opens (within one tick) and not again in the same window', async () => {
    const { scheduler, dispatch } = build();
    await scheduler.tick(at(19, 59));
    await expect(scheduler.tick(at(20, 0, 30))).resolves.toBe(true);
    await expect(scheduler.tick(at(20, 1, 30))).resolves.toBe(false);
    await expect(scheduler.tick(at(20, 10))).resolves.toBe(false);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(scheduler.getNextDueAt()!.getDate()).toBe(23);
  });

  it('retries on the next tick if the dispatch fails', async () => {
    const { scheduler, dispatch } = build();
    await scheduler.tick(at(19));
    dispatch.mockRejectedValueOnce(new Error('boom'));
    await expect(scheduler.tick(at(20, 0, 10))).rejects.toThrow('boom');
    await expect(scheduler.tick(at(20, 1, 10))).resolves.toBe(true);
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it('recalculates nextDueAt when a reminder time is created or modified (no DB access)', async () => {
    const { scheduler, loadReminderTimes } = build(['20:00']);
    await scheduler.tick(at(10));
    expect(scheduler.getNextDueAt()).toEqual(at(20));

    scheduler.noteReminderTime(true, '08:30', at(10)); // user sets/creates reminder at 08:30 (already passed today)
    scheduler.noteReminderTime(true, '15:00', at(10));
    expect(scheduler.getNextDueAt()).toEqual(at(15));
    scheduler.noteReminderTime(true, null, at(10)); // default 20:00, already present
    scheduler.noteReminderTime(false, '09:00', at(10)); // disabled: ignored
    expect(loadReminderTimes).toHaveBeenCalledTimes(1);
    expect(scheduler.getNextDueAt()).toEqual(at(15));
  });

  it('refreshes from the DB on the safety interval and drops removed times', async () => {
    const { scheduler, loadReminderTimes } = build(['20:00', '07:00']);
    await scheduler.tick(at(1));
    expect(scheduler.getNextDueAt()).toEqual(at(7));

    loadReminderTimes.mockResolvedValue(['20:00']); // external change removed 07:00
    await scheduler.tick(at(1, 30)); // before refresh interval: no DB
    expect(loadReminderTimes).toHaveBeenCalledTimes(1);
    await scheduler.tick(at(3, 5)); // after 2h
    expect(loadReminderTimes).toHaveBeenCalledTimes(2);
    expect(scheduler.getNextDueAt()).toEqual(at(20));
  });

  it('treats null reminderTime as the default 20:00', async () => {
    const { scheduler } = build([null]);
    await scheduler.tick(at(10));
    expect(scheduler.getNextDueAt()).toEqual(at(20));
  });
});

describe('startNotificationScheduler modes', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockFindMany.mockReset();
    mockFindMany.mockResolvedValue([{ reminderTime: '20:00' }]);
  });
  afterEach(() => {
    jest.useRealTimers();
    envMock.notificationDispatchMode = 'interval';
  });

  it('resolves unknown/undefined mode to interval (current behaviour)', () => {
    expect(resolveDispatchMode(undefined)).toBe('interval');
    expect(resolveDispatchMode('whatever')).toBe('interval');
    expect(resolveDispatchMode('lazy')).toBe('lazy');
  });

  it('default mode keeps the legacy interval: dispatch every 15 min, no scheduler queries', () => {
    const dispatch = jest.fn().mockResolvedValue({});
    const stop = startNotificationScheduler(dispatch);

    jest.advanceTimersByTime(14 * 60 * 1000);
    expect(dispatch).not.toHaveBeenCalled();
    jest.advanceTimersByTime(60 * 1000);
    expect(dispatch).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(30 * 60 * 1000);
    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(mockFindMany).not.toHaveBeenCalled();
    stop();
  });

  it('lazy mode loads distinct reminder times once and never dispatches outside a window', async () => {
    envMock.notificationDispatchMode = 'lazy';
    jest.setSystemTime(at(10));
    const dispatch = jest.fn().mockResolvedValue({});
    const stop = startNotificationScheduler(dispatch);

    await jest.advanceTimersByTimeAsync(30 * 60 * 1000);
    expect(dispatch).not.toHaveBeenCalled();
    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockFindMany.mock.calls[0][0]).toMatchObject({ distinct: ['reminderTime'], where: { remindersEnabled: true } });

    noteReminderTime(true, '10:45'); // singleton hook reaches the active scheduler
    await jest.advanceTimersByTimeAsync(20 * 60 * 1000); // now 10:50, window 10:45-11:00 open
    expect(dispatch).toHaveBeenCalledTimes(1);
    stop();
    noteReminderTime(true, '11:00'); // no-op after stop
  });
});
