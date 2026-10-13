/**
 * Log files are rotated by winston-daily-rotate-file, which stamps them with the LOCAL date (datePattern YYYY-MM-DD).
 * Tests that read today's log file must use the same convention: a UTC date differs from the local one during the hours
 * between local midnight and the UTC offset (the "log suites fail between 00:00 and 02:00 CEST" defect).
 *
 * NOTE: changing process.env.TZ inside Jest does NOT change the process time zone, so the defect scenario is reproduced with a
 * Date-like object whose local getters and UTC serialisation disagree, which is independent of the machine's zone.
 */
import { logDateStamp } from '../support/log-date';

const moment = require(require.resolve('moment', { paths: [require.resolve('winston-daily-rotate-file')] }));

describe('logDateStamp', () => {
  it('uses the LOCAL calendar date, not the UTC one (zone-independent reproduction of the defect)', () => {
    // 2026-10-13 01:30 local (Madrid, CEST) is still 2026-10-12 23:30 in UTC.
    const lateEvening = {
      getFullYear: () => 2026,
      getMonth: () => 9, // October (zero-based)
      getDate: () => 13,
      toISOString: () => '2026-10-12T23:30:00.000Z',
    } as unknown as Date;

    expect(lateEvening.toISOString().split('T')[0]).toBe('2026-10-12'); // what the old tests computed
    expect(logDateStamp(lateEvening)).toBe('2026-10-13'); // what the logger writes
  });

  it('pads single-digit months and days', () => {
    const early = { getFullYear: () => 2027, getMonth: () => 0, getDate: () => 5 } as unknown as Date;
    expect(logDateStamp(early)).toBe('2027-01-05');
  });

  it.each([
    '2026-10-12T23:30:00Z',
    '2026-10-12T12:00:00Z',
    '2026-12-31T23:59:59Z',
    '2026-03-29T00:30:00Z',
    '2026-01-01T00:00:00Z',
  ])("equals the logger's own formatter (moment, local zone of this process) for %s", (iso) => {
    const now = new Date(iso);
    expect(logDateStamp(now)).toBe(moment(now).format('YYYY-MM-DD'));
  });

  it('defaults to the current instant', () => {
    expect(logDateStamp()).toBe(moment().format('YYYY-MM-DD'));
  });
});
