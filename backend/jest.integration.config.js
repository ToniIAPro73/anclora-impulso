/** Integration tests against the isolated local PostgreSQL only (see scripts/test-db.sh). */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/support/integration-guard.ts'],
  roots: ['<rootDir>/tests/integration'],
  testTimeout: 30000,
  reporters: ['default', '<rootDir>/tests/support/failure-reporter.js'],
};
