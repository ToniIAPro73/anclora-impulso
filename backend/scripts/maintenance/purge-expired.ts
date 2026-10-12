/**
 * Manual/scheduled retention job: physically removes logically expired idempotency records and sessions.
 * Prints counts only. Safe to run concurrently and repeatedly. Nothing schedules it; production scheduling is a
 * deployment decision (see sdd/features/impulso-pilot-release-plan, D10 §8).
 *
 *   pnpm exec tsx scripts/maintenance/purge-expired.ts [--dry-run]
 */
import { prisma } from '../../src/config/database';
import { env } from '../../src/config/env';
import { purgeExpiredIdempotencyRecords } from '../../src/services/idempotency.service';
import { purgeExpiredSessions } from '../../src/services/session.service';

async function main() {
  const options = { graceSeconds: env.retentionPurgeGraceSeconds, batchSize: env.retentionPurgeBatchSize };

  if (process.argv.includes('--dry-run')) {
    const cutoff = new Date(Date.now() - options.graceSeconds * 1000);
    const [idem, sessions] = await Promise.all([
      prisma.idempotencyRecord.count({ where: { expiresAt: { lte: cutoff }, NOT: { status: 'in_progress', lockedUntil: { gt: new Date() } } } }),
      prisma.authSession.count({ where: { expiresAt: { lte: cutoff } } }),
    ]);
    console.log(JSON.stringify({ dryRun: true, idempotencyRecords: idem, sessions }));
    return;
  }

  const idempotencyRecords = await purgeExpiredIdempotencyRecords(new Date(), options);
  const sessions = await purgeExpiredSessions(new Date(), options);
  console.log(JSON.stringify({ dryRun: false, idempotencyRecords, sessions }));
}

main()
  .catch((error) => {
    console.error('purge failed:', error instanceof Error ? error.message : 'unknown');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
