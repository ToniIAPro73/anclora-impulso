/**
 * Log files are rotated by winston-daily-rotate-file, which stamps them with the LOCAL date (datePattern YYYY-MM-DD).
 * Tests that read today's log file must use the same convention: a UTC date differs from the local one during the hours
 * between local midnight and the UTC offset (the B-review "log suites fail between 00:00 and 02:00 CEST" defect).
 */
import { logDateStamp } from '../support/log-date';

const moment = require(require.resolve('moment', { paths: [require.resolve('winston-daily-rotate-file')] }));

const INSTANTS = [
  '2026-10-12T23:30:00Z', // 01:30 the next day in Madrid (CEST): UTC date != local date
  '2026-10-12T12:00:00Z',
  '2026-12-31T23:59:59Z', // year boundary in Madrid (CET)
  '2026-03-29T00:30:00Z', // DST change night in Madrid
];

describe('logDateStamp', () => {
  const originalTz = process.env.TZ;
  afterAll(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it.each(['Europe/Madrid', 'UTC', 'America/Los_Angeles', 'Pacific/Auckland'])('matches the logger convention in %s', (tz) => {
    process.env.TZ = tz;
    for (const iso of INSTANTS) {
      const now = new Date(iso);
      expect(logDateStamp(now)).toBe(moment(now).format('YYYY-MM-DD'));
    }
  });

  it('differs from the UTC date when local midnight has passed but UTC midnight has not', () => {
    process.env.TZ = 'Europe/Madrid';
    const now = new Date('2026-10-12T23:30:00Z');
    expect(now.toISOString().split('T')[0]).toBe('2026-10-12');
    expect(logDateStamp(now)).toBe('2026-10-13');
  });
});
