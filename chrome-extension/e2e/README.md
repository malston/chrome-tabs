# E2E Tests for Tab Organizer Extension

This directory contains end-to-end (E2E) tests for the Tab Organizer Chrome extension using Puppeteer.

## Prerequisites

1. **Puppeteer installed**: Already included as a dev dependency
2. **Chrome browser**: Puppeteer will download Chromium automatically

## Running E2E Tests

### Run all E2E tests
```bash
npm run test:e2e
```

### Run only unit tests (exclude E2E)
```bash
npm run test:unit
```

### Run all tests (unit + E2E)
```bash
npm test        # Only unit tests (E2E excluded by default)
```

## Test Scenarios

### Scenario 1: First-Time Organization
**File**: `scenario1.test.js`

Tests the initial tab organization flow:
- Opens 12 tabs across 3 domains (GitHub, Google, Example)
- Clicks "Organize by Domain" button
- Verifies 3 tab groups are created
- Verifies tabs are sorted alphabetically within each group
- Verifies console logs show "Created new group" messages

**Run time**: ~30-45 seconds

## How E2E Tests Work

1. **Browser Launch**: Puppeteer launches Chrome with the extension loaded
2. **Extension Loading**: The extension is loaded from the current directory
3. **Tab Creation**: Test opens multiple tabs with different URLs
4. **Extension Interaction**: Test opens the popup and clicks buttons
5. **Verification**: Test checks tab groups, tab order, and console logs
6. **Cleanup**: Browser closes automatically after test completes

## Debugging E2E Tests

### Watch the test in action
E2E tests run in **headed mode** (browser window visible) by default, so you can watch what's happening.

### View console logs
The test captures and prints service worker console logs with `[Service Worker]` prefix.

### Increase timeout
If tests are timing out, increase the timeout in the test:
```javascript
test('...', async () => {
  // test code
}, 90000); // 90 seconds
```

### Manual debugging
Add `await new Promise(resolve => setTimeout(resolve, 10000))` to pause the test for 10 seconds and inspect manually.

## Test Structure

```javascript
describe('Test Suite', () => {
  beforeAll(async () => {
    // Launch browser with extension
  });

  afterAll(async () => {
    // Close browser
  });

  test('test name', async () => {
    // Test steps
  });
});
```

## Common Issues

### Extension ID not found
If you get an error about the extension not loading, check that:
1. `manifest.json` is valid
2. Extension files are in the correct directory
3. No syntax errors in background.js

### Timeout errors
E2E tests may timeout if:
1. Network is slow (opening tabs takes time)
2. Extension hasn't finished loading
3. Test is waiting for an element that doesn't exist

Solution: Increase timeout or add `waitUntil: 'domcontentloaded'` when navigating.

### Browser doesn't close
If the browser stays open after test failure:
1. Kill Chrome processes manually
2. Make sure `afterAll` hook is running
3. Check for errors in the test output

## Adding New E2E Tests

To add a new scenario test:

1. Create a new file: `e2e/scenarioX.test.js`
2. Copy the structure from `scenario1.test.js`
3. Modify the test steps for your scenario
4. Run with `npm run test:e2e`

## CI/CD Considerations

For running E2E tests in CI:
1. Use `headless: 'new'` mode (add environment variable check)
2. Install Chrome/Chromium in CI environment
3. Set longer timeouts for slower CI machines
4. Consider using xvfb for Linux environments

Example:
```javascript
headless: process.env.CI === 'true' ? 'new' : false
```
