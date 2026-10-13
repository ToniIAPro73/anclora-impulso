/**
 * Date stamp (YYYY-MM-DD) of the rotated log files, in the LOCAL time zone.
 * winston-daily-rotate-file names `combined-%DATE%.log` with the local date; using `toISOString()` (UTC) made the
 * log-file suites fail between local midnight and the UTC offset hour (00:00-02:00 in Spain).
 */
export function logDateStamp(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
