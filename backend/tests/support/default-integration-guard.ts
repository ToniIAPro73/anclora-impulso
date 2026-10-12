/**
 * Default jest config guard: integration tests write to the database, so they only run
 * (a) through scripts/test-db.sh (jest.integration.config.js adds the full guard), or
 * (b) in CI against the loopback service database.
 * Without this, `pnpm test` would load backend/.env (production-backed) and write to production.
 * The decision is a pure function (evaluateIntegrationAccess) covered by unit tests.
 */
import { evaluateIntegrationAccess } from './db-target';

const testPath = expect.getState().testPath ?? '';

if (testPath.includes('/tests/integration/')) {
  const verdict = evaluateIntegrationAccess({
    databaseUrl: process.env.DATABASE_URL,
    scriptPort: process.env.IMPULSO_TEST_DB_PORT,
    scriptName: process.env.IMPULSO_TEST_DB_NAME,
    scriptUser: process.env.IMPULSO_TEST_DB_USER,
    ci: process.env.CI,
  });

  if (!verdict.allowed) {
    throw new Error(
      `Integration tests are blocked under the default jest config (${verdict.reason}). ` +
        'Use `scripts/test-db.sh test` (isolated local PostgreSQL) or run in CI against the loopback service.',
    );
  }
}
