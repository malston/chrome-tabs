/**
 * Shared test configuration for E2E tests
 * Allows switching between headed and headless mode
 */

const path = require('path');

// Determine if we should run headless (for CI) or headed (for local dev)
const isCI = process.env.CI === 'true' || process.env.HEADLESS === 'true';

const EXTENSION_PATH = path.resolve(__dirname, '..');

/**
 * Get Puppeteer launch options for E2E tests
 * @returns {object} Puppeteer launch configuration
 */
function getPuppeteerConfig() {
  const config = {
    // Use 'new' headless mode which supports Chrome extensions
    // In CI, run headless. Locally, run headed for debugging.
    headless: isCI ? 'new' : false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ],
    defaultViewport: null
  };

  if (isCI) {
    console.log('Running in CI mode (headless)');
  } else {
    console.log('Running in local mode (headed)');
  }

  return config;
}

module.exports = {
  EXTENSION_PATH,
  getPuppeteerConfig
};
