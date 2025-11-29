// ABOUTME: E2E test for custom category pattern functionality.
// ABOUTME: Tests adding patterns to categories and verifying tabs are grouped correctly.

/**
 * E2E Test: Category Customization
 *
 * Tests the custom category pattern flow:
 * - Opens the options page
 * - Adds a custom pattern to an existing category
 * - Opens tabs matching that pattern
 * - Clicks "Organize by Category"
 * - Verifies tabs are grouped under the correct category
 */

const puppeteer = require('puppeteer');
const { getPuppeteerConfig } = require('./test-config');

// Test URLs - using a unique pattern that won't match default categories
const TEST_PATTERN = '*acmetest*';
const TEST_URLS = [
  'https://acmetest.example.com/page1',
  'https://acmetest.example.com/page2',
  'https://www.acmetest-corp.example.com/about'
];

describe('Category Customization', () => {
  let browser;
  let page;
  let extensionId;

  beforeAll(async () => {
    // Launch browser with extension loaded
    browser = await puppeteer.launch(getPuppeteerConfig());

    // Wait for the extension's service worker to load
    const extensionTarget = await browser.waitForTarget(
      target => target.type() === 'service_worker' && target.url().includes('chrome-extension://'),
      { timeout: 10000 }
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

  afterEach(async () => {
    // Reset categories to defaults after each test
    try {
      const serviceWorkerTarget = await browser.waitForTarget(
        target => target.type() === 'service_worker' && target.url().includes(extensionId),
        { timeout: 5000 }
      );
      const serviceWorker = await serviceWorkerTarget.worker();

      await serviceWorker.evaluate(async () => {
        await chrome.runtime.sendMessage({ action: 'resetCategories' });
      });
    } catch (e) {
      console.log('Could not reset categories (service worker may have terminated):', e.message);
    }
  });

  test('should group tabs by custom pattern added to category', async () => {
    // Step 1: Open options page
    console.log('Opening options page...');
    const optionsUrl = `chrome-extension://${extensionId}/src/options/options.html`;
    await page.goto(optionsUrl, { waitUntil: 'networkidle0' });

    // Wait for categories to load
    await page.waitForSelector('.category-card');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 2: Find and click Edit on the Shopping category
    console.log('Editing Shopping category...');

    // Find the Shopping category card and click its Edit button
    const editClicked = await page.evaluate(() => {
      const cards = document.querySelectorAll('.category-card');
      for (const card of cards) {
        const header = card.querySelector('h3');
        if (header && header.textContent === 'Shopping') {
          const editBtn = card.querySelector('button[data-action="edit"]');
          if (editBtn) {
            editBtn.click();
            return true;
          }
        }
      }
      return false;
    });

    expect(editClicked).toBe(true);

    // Wait for modal to open
    await page.waitForSelector('.modal-overlay.show');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 3: Add the custom pattern to the patterns textarea
    console.log(`Adding pattern: ${TEST_PATTERN}`);

    // Get current patterns and add our test pattern
    await page.evaluate((pattern) => {
      const textarea = document.getElementById('categoryPatterns');
      textarea.value = textarea.value + '\n' + pattern;
    }, TEST_PATTERN);

    // Click Save button
    await page.click('#saveModalBtn');

    // Wait for modal to close and save to complete
    await page.waitForFunction(
      () => !document.querySelector('.modal-overlay.show'),
      { timeout: 5000 }
    );

    // Wait for status message
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify the pattern was saved by re-opening the edit modal
    // (card only shows first 5 patterns, so we need to check the modal)
    await page.evaluate(() => {
      const cards = document.querySelectorAll('.category-card');
      for (const card of cards) {
        const header = card.querySelector('h3');
        if (header && header.textContent === 'Shopping') {
          const editBtn = card.querySelector('button[data-action="edit"]');
          if (editBtn) editBtn.click();
        }
      }
    });

    await page.waitForSelector('.modal-overlay.show');
    await new Promise(resolve => setTimeout(resolve, 500));

    const patternSaved = await page.evaluate(() => {
      const textarea = document.getElementById('categoryPatterns');
      return textarea.value.includes('acmetest');
    });

    expect(patternSaved).toBe(true);
    console.log('Pattern saved successfully');

    // Close the modal
    await page.click('#cancelModalBtn');
    await page.waitForFunction(
      () => !document.querySelector('.modal-overlay.show'),
      { timeout: 5000 }
    );

    // Step 4: Open test tabs matching the pattern
    console.log('Opening test tabs...');

    for (const url of TEST_URLS) {
      const newPage = await browser.newPage();
      // These URLs won't actually load, but that's fine - we just need the URL
      await newPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => {
        // Expected - these are fake URLs
      });
    }

    console.log(`Opened ${TEST_URLS.length} test tabs`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 5: Open popup and click "Organize by Category"
    console.log('Opening popup and organizing by category...');
    const popupUrl = `chrome-extension://${extensionId}/src/popup/popup.html`;
    const popupPage = await browser.newPage();
    await popupPage.goto(popupUrl);

    // Wait for popup to load
    await popupPage.waitForSelector('#organizeCategoryBtn');

    // Click "Organize by Category" button
    await popupPage.click('#organizeCategoryBtn');

    // Wait for organization to complete
    await popupPage.waitForFunction(
      () => {
        const status = document.getElementById('status');
        return status && status.style.display !== 'none';
      },
      { timeout: 10000 }
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 6: Verify tabs are grouped under Shopping
    console.log('Verifying tab groups...');

    const serviceWorkerTarget = await browser.waitForTarget(
      target => target.type() === 'service_worker' && target.url().includes(extensionId)
    );
    const serviceWorker = await serviceWorkerTarget.worker();

    // Get all tab groups
    const groups = await serviceWorker.evaluate(async () => {
      const groups = await chrome.tabGroups.query({});
      return groups.map(g => ({ id: g.id, title: g.title, color: g.color }));
    });

    console.log('Groups found:', groups);

    // Find the Shopping group
    const shoppingGroup = groups.find(g => g.title.startsWith('Shopping'));
    expect(shoppingGroup).toBeDefined();
    console.log('Shopping group:', shoppingGroup);

    // Get tabs in the Shopping group
    const shoppingTabs = await serviceWorker.evaluate(async (groupId) => {
      const tabs = await chrome.tabs.query({ groupId });
      return tabs.map(t => ({ title: t.title, url: t.url }));
    }, shoppingGroup.id);

    console.log('Tabs in Shopping group:', shoppingTabs);

    // Verify our test tabs are in the Shopping group
    const testTabsInGroup = shoppingTabs.filter(t =>
      t.url.includes('acmetest')
    );

    expect(testTabsInGroup.length).toBe(TEST_URLS.length);
    console.log(`✅ ${testTabsInGroup.length} test tabs correctly grouped under Shopping`);

  }, 60000); // 60 second timeout

  test('should persist custom patterns after extension reload', async () => {
    // Step 1: Close extra tabs from previous test to get a clean slate
    console.log('Cleaning up tabs from previous test...');
    const pages = await browser.pages();
    for (let i = pages.length - 1; i > 0; i--) {
      await pages[i].close();
    }
    page = pages[0];

    // Step 2: Add a custom pattern via options page
    console.log('Adding custom pattern...');
    const optionsUrl = `chrome-extension://${extensionId}/src/options/options.html`;
    await page.goto(optionsUrl, { waitUntil: 'networkidle0', timeout: 10000 });

    await page.waitForSelector('.category-card', { timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Edit Shopping category
    console.log('Editing Shopping category...');
    await page.evaluate(() => {
      const cards = document.querySelectorAll('.category-card');
      for (const card of cards) {
        const header = card.querySelector('h3');
        if (header && header.textContent === 'Shopping') {
          const editBtn = card.querySelector('button[data-action="edit"]');
          if (editBtn) editBtn.click();
        }
      }
    });

    await page.waitForSelector('.modal-overlay.show', { timeout: 5000 });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Add pattern
    console.log('Adding pattern to textarea...');
    await page.evaluate((pattern) => {
      const textarea = document.getElementById('categoryPatterns');
      textarea.value = textarea.value + '\n' + pattern;
    }, '*persisttest*');

    await page.click('#saveModalBtn');
    await page.waitForFunction(
      () => !document.querySelector('.modal-overlay.show'),
      { timeout: 5000 }
    );
    console.log('Pattern saved');

    // Step 3: Close and reopen options page (simulates "reload")
    console.log('Reopening options page...');
    await page.goto('about:blank');
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.goto(optionsUrl, { waitUntil: 'networkidle0', timeout: 10000 });

    await page.waitForSelector('.category-card', { timeout: 10000 });
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 4: Edit Shopping and verify pattern is still there
    console.log('Verifying pattern persisted...');
    await page.evaluate(() => {
      const cards = document.querySelectorAll('.category-card');
      for (const card of cards) {
        const header = card.querySelector('h3');
        if (header && header.textContent === 'Shopping') {
          const editBtn = card.querySelector('button[data-action="edit"]');
          if (editBtn) editBtn.click();
        }
      }
    });

    await page.waitForSelector('.modal-overlay.show', { timeout: 5000 });
    await new Promise(resolve => setTimeout(resolve, 500));

    const patternPersisted = await page.evaluate(() => {
      const textarea = document.getElementById('categoryPatterns');
      return textarea.value.includes('persisttest');
    });

    expect(patternPersisted).toBe(true);
    console.log('✅ Custom pattern persisted after page reload');

  }, 60000);
});
