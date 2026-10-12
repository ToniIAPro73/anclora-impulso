/**
 * Refuses to run integration tests against anything except the authorized local test database.
 * Layer 1 (sync, before the test file is evaluated): URL must be loopback, port/name must match the
 * values exported by scripts/test-db.sh. Layer 2 (beforeAll): the live server must carry the test marker.
 * No credentials are ever printed.
 */
import { describeDatabaseTarget } from './db-target';

jest.mock('dotenv', () => ({ __esModule: true, default: { config: () => ({ parsed: {} }) }, config: () => ({ parsed: {} }) }));

const expectedPort = process.env.IMPULSO_TEST_DB_PORT;
const expectedName = process.env.IMPULSO_TEST_DB_NAME;
const expectedUser = process.env.IMPULSO_TEST_DB_USER;
const target = describeDatabaseTarget(process.env.DATABASE_URL);

if (!expectedPort || !expectedName) {
  throw new Error('Integration guard: run through scripts/test-db.sh (IMPULSO_TEST_DB_* not set)');
}
if (!target.ok) {
  throw new Error(`Integration guard: refusing to run — ${target.reason}`);
}
if (target.port !== expectedPort || target.database !== expectedName) {
  throw new Error('Integration guard: refusing to run — database port/name differ from the authorized test database');
}
if (expectedUser && target.user !== expectedUser) {
  throw new Error('Integration guard: refusing to run — database user differs from the authorized test user');
}
if (process.env.GROQ_API_KEY || process.env.SMTP_HOST) {
  throw new Error('Integration guard: external service credentials present in test environment');
}

beforeAll(async () => {
  const { prisma } = await import('../../src/config/database');
  const rows = await prisma.$queryRaw<Array<{ db: string; marker: string | null }>>`
    SELECT current_database() AS db, current_setting('anclora.test_marker', true) AS marker`;
  if (rows[0]?.db !== expectedName || rows[0]?.marker !== 'impulso-test-v1') {
    throw new Error('Integration guard: live database does not carry the test marker — aborting');
  }
});

afterAll(async () => {
  const { prisma } = await import('../../src/config/database');
  await prisma.$disconnect();
});
