/**
 * Jest configuration for E2E tests
 * Separate from unit tests to avoid conflicts
 */

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/e2e/**/*.test.js'],
  testTimeout: 60000, // 60 seconds for E2E tests
  verbose: true,
  bail: true, // Stop on first failure
  maxWorkers: 1, // Run tests serially (browser can't run multiple instances)
};
