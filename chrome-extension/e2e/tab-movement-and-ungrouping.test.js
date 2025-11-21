/**
 * E2E Tests: Scenarios 4, 5, and 6
 *
 * Scenario 4: Tab Movement Between Groups (Add/Remove)
 * Scenario 5: Single Tabs (Ungrouping)
 * Scenario 6: Mixed Create and Update
 *
 * Each test is independent and cleans up state before running.
 */

const puppeteer = require('puppeteer');
const { getPuppeteerConfig } = require('./test-config');

describe('Scenarios 4, 5, 6: Tab Movement, Ungrouping, Mixed Operations', () => {
  let browser;
  let page;
  let extensionId;
  let serviceWorker;

  beforeAll(async () => {
    browser = await puppeteer.launch(getPuppeteerConfig());

    // Wait a bit for browser to fully initialize
    await new Promise(resolve => setTimeout(resolve, 1000));

    const extensionTarget = await browser.waitForTarget(
      target => target.type() === 'service_worker' && target.url().includes('chrome-extension://'),
      { timeout: 30000 }
    );

    const extensionUrl = extensionTarget.url();
    extensionId = extensionUrl.split('/')[2];
    console.log(`Extension loaded with ID: ${extensionId}`);

    const pages = await browser.pages();
    page = pages[0];

    // Get service worker reference
    serviceWorker = await extensionTarget.worker();
  }, 60000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  // Helper function to clean up all tabs and groups before each test
  async function cleanupTabs() {
    // Close all pages except the first one
    const allPages = await browser.pages();
    for (let i = 1; i < allPages.length; i++) {
      await allPages[i].close();
    }

    // Navigate first page to about:blank
    await page.goto('about:blank');
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Helper function to organize tabs
  async function organizeTabs() {
    const popupPage = await browser.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    await popupPage.waitForSelector('#organizeBtn');
    await popupPage.click('#organizeBtn');
    await popupPage.waitForFunction(
      () => {
        const status = document.getElementById('status');
        return status && status.style.display !== 'none';
      },
      { timeout: 10000 }
    );
    await new Promise(resolve => setTimeout(resolve, 2000));
    await popupPage.close();
  }

  test('Scenario 4: should move tabs between groups when domain changes', async () => {
    console.log('=== Scenario 4: Tab Movement Between Groups ===');

    // Clean up from any previous test
    await cleanupTabs();

    // Open initial tabs
    const urls = [
      'https://github.com/facebook/react',
      'https://github.com/vuejs/vue',
      'https://github.com/angular/angular',
      'https://www.google.com/search?q=javascript',
      'https://www.google.com/search?q=typescript'
    ];

    for (let i = 0; i < urls.length; i++) {
      if (i === 0) {
        await page.goto(urls[i], { waitUntil: 'load', timeout: 60000 });
      } else {
        const newPage = await browser.newPage();
        await newPage.goto(urls[i], { waitUntil: 'load', timeout: 60000 });
      }
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Organize
    await organizeTabs();

    // Get initial groups
    const initialGroups = await serviceWorker.evaluate(async () => {
      const groups = await chrome.tabGroups.query({});
      return groups.map(g => ({ id: g.id, title: g.title }));
    });

    console.log('Initial groups:', initialGroups);
    expect(initialGroups.length).toBe(2);

    const githubGroup = initialGroups.find(g => g.title.includes('github.com'));
    const googleGroup = initialGroups.find(g => g.title.includes('google.com'));

    expect(githubGroup.title).toBe('github.com (3)');
    expect(googleGroup.title).toBe('google.com (2)');

    // Navigate a GitHub tab to google.com
    console.log('Changing one GitHub tab to google.com...');
    const allTabs = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      return tabs.map(t => ({ id: t.id, url: t.url, groupId: t.groupId }));
    });

    const githubTabs = allTabs.filter(t => t.url.includes('github.com'));
    const tabToChange = githubTabs[0];

    // Navigate this tab to Google
    await serviceWorker.evaluate(async (tabId) => {
      await chrome.tabs.update(tabId, { url: 'https://www.google.com/search?q=puppeteer' });
    }, tabToChange.id);

    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for navigation

    // Re-organize
    await organizeTabs();

    // Verify groups updated
    const updatedGroups = await serviceWorker.evaluate(async () => {
      const groups = await chrome.tabGroups.query({});
      return groups.map(g => ({ id: g.id, title: g.title }));
    });

    console.log('Updated groups after tab movement:', updatedGroups);

    const updatedGithub = updatedGroups.find(g => g.title.includes('github.com'));
    const updatedGoogle = updatedGroups.find(g => g.title.includes('google.com'));

    // GitHub should have 1 less, Google should have 1 more
    expect(updatedGithub.title).toBe('github.com (2)');
    expect(updatedGoogle.title).toBe('google.com (3)');

    console.log('✅ Scenario 4 passed! Tab moved between groups correctly.');
  }, 120000);

  test('Scenario 5: should ungroup when domain drops to 1 tab', async () => {
    console.log('=== Scenario 5: Single Tabs (Ungrouping) ===');

    // Clean up from any previous test
    await cleanupTabs();

    // Open 2 example.com tabs (use query params to make them unique)
    await page.goto('https://example.com?page=1', { waitUntil: 'load', timeout: 60000 });

    const examplePage2 = await browser.newPage();
    await examplePage2.goto('https://example.com?page=2', { waitUntil: 'load', timeout: 60000 });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Organize - should create example.com group
    await organizeTabs();

    const groupsBefore = await serviceWorker.evaluate(async () => {
      const groups = await chrome.tabGroups.query({});
      return groups.map(g => ({ id: g.id, title: g.title }));
    });

    console.log('Groups before closing tab:', groupsBefore);
    const exampleGroup = groupsBefore.find(g => g.title.includes('example.com'));
    expect(exampleGroup).toBeDefined();
    expect(exampleGroup.title).toBe('example.com (2)');

    // Close one example.com tab
    console.log('Closing one example.com tab...');
    await examplePage2.close();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Re-organize
    await organizeTabs();

    // Verify example.com group is gone
    const groupsAfter = await serviceWorker.evaluate(async () => {
      const groups = await chrome.tabGroups.query({});
      return groups.map(g => ({ id: g.id, title: g.title }));
    });

    console.log('Groups after closing tab:', groupsAfter);
    const exampleGroupAfter = groupsAfter.find(g => g.title.includes('example.com'));
    expect(exampleGroupAfter).toBeUndefined(); // Group should not exist

    // Verify the single tab is ungrouped
    const allTabs = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      return tabs.map(t => ({ id: t.id, url: t.url, groupId: t.groupId }));
    });

    const exampleTabs = allTabs.filter(t => t.url.includes('example.com'));
    expect(exampleTabs.length).toBe(1);
    expect(exampleTabs[0].groupId).toBe(-1); // -1 means ungrouped

    console.log('✅ Scenario 5 passed! Single tab was ungrouped correctly.');
  }, 120000);

  test('Scenario 6: should handle mixed create and update operations', async () => {
    console.log('=== Scenario 6: Mixed Create and Update ===');

    // Clean up from any previous test
    await cleanupTabs();

    // Set up initial state: create github and google groups
    const initialUrls = [
      'https://github.com/facebook/react',
      'https://github.com/vuejs/vue',
      'https://www.google.com/search?q=javascript',
      'https://www.google.com/search?q=typescript'
    ];

    for (let i = 0; i < initialUrls.length; i++) {
      if (i === 0) {
        await page.goto(initialUrls[i], { waitUntil: 'load', timeout: 60000 });
      } else {
        const newPage = await browser.newPage();
        await newPage.goto(initialUrls[i], { waitUntil: 'load', timeout: 60000 });
      }
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Organize to create initial groups
    await organizeTabs();

    // Add stackoverflow tabs (new domain) and more github tabs
    const newUrls = [
      'https://stackoverflow.com/questions/1',
      'https://stackoverflow.com/questions/2',
      'https://stackoverflow.com/questions/3',
      'https://github.com/nodejs/node',
      'https://github.com/microsoft/vscode'
    ];

    for (const url of newUrls) {
      const newPage = await browser.newPage();
      await newPage.goto(url, { waitUntil: 'load', timeout: 60000 });
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get groups before mixed operation
    const groupsBefore = await serviceWorker.evaluate(async () => {
      const groups = await chrome.tabGroups.query({});
      return groups.map(g => ({ id: g.id, title: g.title }));
    });

    console.log('Groups before mixed operation:', groupsBefore);
    expect(groupsBefore.some(g => g.title.includes('stackoverflow'))).toBe(false);

    // Organize
    await organizeTabs();

    // Get groups after
    const groupsAfter = await serviceWorker.evaluate(async () => {
      const groups = await chrome.tabGroups.query({});
      return groups.map(g => ({ id: g.id, title: g.title }));
    });

    console.log('Groups after mixed operation:', groupsAfter);

    // Should have created stackoverflow group
    const stackoverflowGroup = groupsAfter.find(g => g.title.includes('stackoverflow.com'));
    expect(stackoverflowGroup).toBeDefined();
    expect(stackoverflowGroup.title).toBe('stackoverflow.com (3)');

    // Should have updated github group (2 initial + 2 new = 4)
    const githubGroup = groupsAfter.find(g => g.title.includes('github.com'));
    expect(githubGroup.title).toBe('github.com (4)');

    console.log('✅ Scenario 6 passed! Mixed create and update worked correctly.');
  }, 120000);
});
