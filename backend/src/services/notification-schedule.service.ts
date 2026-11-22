/**
 * Notification dispatch scheduling.
 *
 * Mode `interval` (default, legacy): every NOTIFICATION_DISPATCH_INTERVAL_MINUTES the full
 * dispatch runs (and queries the database) regardless of whether anything is due.
 *
 * Mode `lazy` (NOTIFICATION_DISPATCH_MODE=lazy): the database is only queried
 *  - to (re)load the distinct reminder times of users with reminders enabled
 *    (at start, every NOTIFICATION_LAZY_REFRESH_MINUTES, and never on profile/user changes: those
 *    are applied to the in-memory set with `noteReminderTime`), and
 *  - when a reminder window opens (`now >= nextDueAt`), to run the unchanged dispatch once.
 * This lets Neon scale to zero between reminder windows.
 *
 * The in-memory set is only valid for a single backend instance; the periodic refresh bounds
 * staleness when several instances or external data changes exist.
 */
import { prisma } from '../config/database';
import { env } from '../config/env';

export const DEFAULT_REMINDER_TIME = '20:00';
export const LAZY_TICK_MS = 60 * 1000;

export type DispatchMode = 'interval' | 'lazy';

export function resolveDispatchMode(value: string | undefined): DispatchMode {
  return value === 'lazy' ? 'lazy' : 'interval';
}

// Same semantics as the legacy dispatcher: today's reminder time in the server's local timezone.
export function buildScheduledDate(reminderTime: string | null, now: Date) {
  const scheduled = new Date(now);
  const [hour, minute] = (reminderTime || DEFAULT_REMINDER_TIME)
    .split(':')
    .map((value) => Number.parseInt(value, 10));
  scheduled.setHours(hour || 20, minute || 0, 0, 0);
  return scheduled;
}

export function isDueWithinWindow(scheduledFor: Date, now: Date, windowMs?: number) {
  const window = windowMs ?? env.notificationDispatchIntervalMinutes * 60 * 1000;
  const diffMs = now.getTime() - scheduledFor.getTime();
  return diffMs >= 0 && diffMs <= window;
}

const normalizeTime = (time: string | null | undefined) => time || DEFAULT_REMINDER_TIME;
const dayKey = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Earliest instant at which a dispatch is needed: `now` if a reminder window is open and not yet
 * handled, otherwise the next window start (today or tomorrow). `null` when nobody has reminders.
 */
export function computeNextDueAt(
  times: Iterable<string>,
  now: Date,
  windowMs: number,
  handled: ReadonlySet<string> = new Set(),
): Date | null {
  let next: Date | null = null;
  for (const time of times) {
    const start = buildScheduledDate(time, now);
    let candidate: Date;
    if (isDueWithinWindow(start, now, windowMs)) {
      candidate = handled.has(`${dayKey(now)}:${time}`) ? tomorrow(start) : now;
    } else if (now.getTime() < start.getTime()) {
      candidate = start;
    } else {
      candidate = tomorrow(start);
    }
    if (!next || candidate.getTime() < next.getTime()) {
      next = candidate;
    }
  }
  return next;
}

function tomorrow(date: Date) {
  const result = new Date(date);
  result.setDate(result.getDate() + 1);
  return result;
}

export interface LazyScheduler {
  tick(now?: Date): Promise<boolean>;
  noteReminderTime(
    remindersEnabled: boolean | null | undefined,
    reminderTime: string | null | undefined,
    now?: Date,
  ): void;
  refresh(now?: Date): Promise<void>;
  getNextDueAt(): Date | null;
}

export interface LazySchedulerOptions {
  dispatch: () => Promise<unknown>;
  loadReminderTimes: () => Promise<Array<string | null>>;
  windowMs: number;
  refreshMs: number;
}

export function createLazyScheduler(options: LazySchedulerOptions): LazyScheduler {
  const { dispatch, loadReminderTimes, windowMs, refreshMs } = options;
  let times: Set<string> | null = null;
  let lastRefreshAt = 0;
  let nextDueAt: Date | null = null;
  const handled = new Set<string>();

  const recompute = (now: Date) => {
    nextDueAt = computeNextDueAt(times ?? [], now, windowMs, handled);
  };

  const refresh = async (now: Date = new Date()) => {
    const loaded = await loadReminderTimes();
    times = new Set(loaded.map(normalizeTime));
    lastRefreshAt = now.getTime();
    recompute(now);
  };

  return {
    getNextDueAt: () => nextDueAt,
    refresh,
    noteReminderTime(remindersEnabled, reminderTime, now = new Date()) {
      if (remindersEnabled === false || times === null) return;
      times.add(normalizeTime(reminderTime));
      recompute(now);
    },
    async tick(now: Date = new Date()) {
      // Safety refresh (also the first load). Only database access outside a due window.
      if (times === null || now.getTime() - lastRefreshAt >= refreshMs) {
        await refresh(now);
      }
      if (!nextDueAt || now.getTime() < nextDueAt.getTime()) {
        return false; // nothing due: no database access
      }

      await dispatch();
      for (const time of times ?? []) {
        if (isDueWithinWindow(buildScheduledDate(time, now), now, windowMs)) {
          handled.add(`${dayKey(now)}:${time}`);
        }
      }
      // Keep the handled set small: only today's entries matter.
      for (const key of handled) {
        if (!key.startsWith(dayKey(now))) handled.delete(key);
      }
      recompute(now);
      return true;
    },
  };
}

// --- Process-wide singleton used by the server and the mutation hooks ---------------------------

let activeScheduler: LazyScheduler | null = null;

/** Called by services that create/modify users' reminder settings. No-op unless mode is `lazy`. */
export function noteReminderTime(
  remindersEnabled: boolean | null | undefined,
  reminderTime: string | null | undefined,
) {
  activeScheduler?.noteReminderTime(remindersEnabled, reminderTime);
}

/** Starts the dispatch loop for the configured mode. Returns a stop function. */
export function startNotificationScheduler(dispatch: () => Promise<unknown>): () => void {
  const intervalMs = Math.max(5, env.notificationDispatchIntervalMinutes) * 60 * 1000;
  // Lazy windows must match what dispatchDueNotifications() accepts (isDueWithinWindow default).
  const windowMs = Math.max(1, env.notificationDispatchIntervalMinutes) * 60 * 1000;
  const onError = (error: unknown) => console.error('⚠️ Error al despachar notificaciones:', error);

  if (resolveDispatchMode(env.notificationDispatchMode) !== 'lazy') {
    const timer = setInterval(() => {
      dispatch().catch(onError);
    }, intervalMs);
    return () => clearInterval(timer);
  }

  const scheduler = createLazyScheduler({
    dispatch,
    windowMs,
    refreshMs: Math.max(5, env.notificationLazyRefreshMinutes) * 60 * 1000,
    loadReminderTimes: async () => {
      const rows = await prisma.user.findMany({
        where: { remindersEnabled: true },
        select: { reminderTime: true },
        distinct: ['reminderTime'],
      });
      return rows.map((row) => row.reminderTime);
    },
  });
  activeScheduler = scheduler;

  const timer = setInterval(() => {
    scheduler.tick().catch(onError);
  }, LAZY_TICK_MS);
  scheduler.tick().catch(onError);

  return () => {
    clearInterval(timer);
    activeScheduler = null;
  };
}
