/**
 * E2E Test: Scenario 1 - First-Time Organization (Create New Groups)
 *
 * Tests the initial tab organization flow:
 * - Opens multiple tabs across different domains
 * - Clicks "Organize by Domain"
 * - Verifies groups are created
 * - Verifies tabs are sorted alphabetically
 * - Verifies console logs show "Created new group"
 */

const puppeteer = require('puppeteer');
const path = require('path');

// Extension path (relative to e2e directory)
const EXTENSION_PATH = path.resolve(__dirname, '..');
const EXTENSION_ID = 'lfgdhkjngeggkemgninmehdfohiebdnj'; // You may need to get this dynamically

// Test URLs to open
const TEST_URLS = {
  github: [
    'https://github.com/facebook/react',
    'https://github.com/vuejs/vue',
    'https://github.com/angular/angular',
    'https://github.com/nodejs/node',
    'https://github.com/microsoft/vscode'
  ],
  google: [
    'https://www.google.com/search?q=javascript',
    'https://www.google.com/search?q=typescript',
    'https://www.google.com/search?q=nodejs',
    'https://www.google.com/maps'
  ],
  example: [
    'https://example.com/page1',
    'https://example.com/page2',
    'https://example.com/page3'
  ]
};

describe('Scenario 1: First-Time Organization (Create New Groups)', () => {
  let browser;
  let page;
  let extensionId;

  beforeAll(async () => {
    // Launch browser with extension loaded
    browser = await puppeteer.launch({
      headless: false, // Run in headed mode to see what's happening
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ],
      defaultViewport: null
    });

    // Get the extension's service worker target
    const targets = await browser.targets();
    const extensionTarget = targets.find(
      target => target.type() === 'service_worker' && target.url().includes('chrome-extension://')
    );

    if (!extensionTarget) {
      throw new Error('Extension service worker not found');
    }

    // Extract extension ID from URL
    const extensionUrl = extensionTarget.url();
    extensionId = extensionUrl.split('/')[2];
    console.log(`Extension loaded with ID: ${extensionId}`);

    // Get the first page
    const pages = await browser.pages();
    page = pages[0];
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('should create groups when organizing tabs for the first time', async () => {
    // Step 1: Open 10-15 tabs across 3-4 domains
    console.log('Opening test tabs...');

    const allUrls = [
      ...TEST_URLS.github,
      ...TEST_URLS.google,
      ...TEST_URLS.example
    ];

    // Open all tabs
    for (const url of allUrls) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await browser.newPage(); // Create a new page for the next URL
    }

    // Close the last empty page
    const pages = await browser.pages();
    await pages[pages.length - 1].close();

    console.log(`Opened ${allUrls.length} tabs`);

    // Wait a moment for tabs to settle
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 2: Get service worker for console log monitoring
    const serviceWorkerTarget = await browser.waitForTarget(
      target => target.type() === 'service_worker' && target.url().includes(extensionId)
    );
    const serviceWorker = await serviceWorkerTarget.worker();

    // Capture console logs from service worker
    const consoleLogs = [];
    serviceWorker.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(text);
      console.log(`[Service Worker] ${text}`);
    });

    // Step 3: Open extension popup and click "Organize by Domain"
    console.log('Opening extension popup...');
    const popupUrl = `chrome-extension://${extensionId}/popup.html`;
    const popupPage = await browser.newPage();
    await popupPage.goto(popupUrl);

    // Wait for the popup to load
    await popupPage.waitForSelector('#organizeBtn');

    // Click "Organize by Domain" button
    console.log('Clicking "Organize by Domain" button...');
    await popupPage.click('#organizeBtn');

    // Wait for organization to complete (check for status message)
    await popupPage.waitForFunction(
      () => {
        const status = document.getElementById('status');
        return status && status.style.display !== 'none';
      },
      { timeout: 10000 }
    );

    // Give it extra time to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 4: Verify groups were created
    console.log('Verifying tab groups...');

    // Get tab groups using Chrome API through service worker
    const groups = await serviceWorker.evaluate(async () => {
      const groups = await chrome.tabGroups.query({});
      return groups.map(g => ({ id: g.id, title: g.title, color: g.color }));
    });

    console.log('Groups found:', groups);

    // Verify we have 3 groups (github, google, example)
    expect(groups.length).toBe(3);

    // Verify group titles match expected domains
    const groupTitles = groups.map(g => g.title).sort();
    expect(groupTitles).toContain('example.com (3)');
    expect(groupTitles).toContain('github.com (5)');
    expect(groupTitles).toContain('google.com (4)');

    // Step 5: Verify tabs are sorted alphabetically within each group
    const tabs = await serviceWorker.evaluate(async () => {
      const allTabs = await chrome.tabs.query({});
      return allTabs.map(t => ({
        id: t.id,
        title: t.title,
        url: t.url,
        groupId: t.groupId
      }));
    });

    // Group tabs by their groupId
    const tabsByGroup = {};
    for (const tab of tabs) {
      if (tab.groupId !== -1) {
        if (!tabsByGroup[tab.groupId]) {
          tabsByGroup[tab.groupId] = [];
        }
        tabsByGroup[tab.groupId].push(tab);
      }
    }

    // Verify tabs within each group are sorted
    for (const [groupId, groupTabs] of Object.entries(tabsByGroup)) {
      const titles = groupTabs.map(t => t.title);
      const sortedTitles = [...titles].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

      console.log(`Group ${groupId} tabs:`, titles);
      expect(titles).toEqual(sortedTitles);
    }

    // Step 6: Verify console logs show "Created new group"
    const createLogs = consoleLogs.filter(log => log.includes('Created new group'));
    expect(createLogs.length).toBe(3); // Should have 3 "Created new group" messages

    expect(createLogs.some(log => log.includes('github.com'))).toBe(true);
    expect(createLogs.some(log => log.includes('google.com'))).toBe(true);
    expect(createLogs.some(log => log.includes('example.com'))).toBe(true);

    console.log('✅ Scenario 1 test passed!');
  }, 60000); // 60 second timeout for this test
});
