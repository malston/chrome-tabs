/**
 * E2E Tests: Cross-Window Tab Organization
 *
 * Tests the cross-window organization feature which:
 * - Collects tabs from all open Chrome windows
 * - Removes duplicate URLs
 * - Moves all tabs to the current window
 * - Organizes them by domain or category
 */

const puppeteer = require('puppeteer');
const { getPuppeteerConfig } = require('./test-config');

describe('Cross-Window Tab Organization', () => {
  let browser;
  let window1Page;
  let window2Page;
  let extensionId;
  let serviceWorker;

  beforeAll(async () => {
    browser = await puppeteer.launch(getPuppeteerConfig());

    const extensionTarget = await browser.waitForTarget(
      target => target.type() === 'service_worker' && target.url().includes('chrome-extension://'),
      { timeout: 10000 }
    );

    const extensionUrl = extensionTarget.url();
    extensionId = extensionUrl.split('/')[2];
    console.log(`Extension loaded with ID: ${extensionId}`);

    const pages = await browser.pages();
    window1Page = pages[0];
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    // Get service worker
    const serviceWorkerTarget = await browser.waitForTarget(
      target => target.type() === 'service_worker' && target.url().includes(extensionId)
    );
    serviceWorker = await serviceWorkerTarget.worker();
  });

  async function organizeTabs(allWindows = false) {
    const popupPage = await browser.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForSelector('#organizeBtn');

    // Click appropriate button based on allWindows flag
    const buttonId = allWindows ? '#organizeAllWindowsBtn' : '#organizeBtn';
    await popupPage.click(buttonId);

    await popupPage.waitForFunction(
      () => {
        const status = document.getElementById('status');
        return status && status.style.display !== 'none';
      },
      { timeout: 15000 }
    );
    await new Promise(resolve => setTimeout(resolve, 2000));
    await popupPage.close();
  }

  test('should consolidate tabs from multiple windows into current window', async () => {
    console.log('=== Cross-Window: Consolidate Tabs ===');

    // Open tabs in window 1
    await window1Page.goto('https://github.com/facebook/react', { waitUntil: 'networkidle2', timeout: 15000 });
    const window1Tab2 = await browser.newPage();
    await window1Tab2.goto('https://github.com/vuejs/vue', { waitUntil: 'networkidle2', timeout: 15000 });

    // Create window 2 with new tabs
    window2Page = await browser.newPage();
    await window2Page.goto('https://github.com/angular/angular', { waitUntil: 'networkidle2', timeout: 15000 });
    const window2Tab2 = await browser.newPage();
    await window2Tab2.goto('https://example.com/page1', { waitUntil: 'networkidle2', timeout: 15000 });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get initial window count
    const windowsBefore = await browser.pages();
    console.log(`Windows before: ${windowsBefore.length} pages`);

    // Organize all windows
    await organizeTabs(true);

    // Verify all tabs are in groups
    const groups = await serviceWorker.evaluate(async () => {
      const groups = await chrome.tabGroups.query({});
      return groups.map(g => ({ id: g.id, title: g.title }));
    });

    console.log('Groups after cross-window organization:', groups);

    // Should have created github group with all tabs from both windows
    const githubGroup = groups.find(g => g.title.includes('github.com'));
    expect(githubGroup).toBeDefined();
    expect(githubGroup.title).toBe('github.com (3)');

    console.log('✅ Cross-window consolidation passed!');
  }, 120000);

  test('should remove duplicate URLs across windows', async () => {
    console.log('=== Cross-Window: Remove Duplicates ===');

    // Close all existing tabs first
    const allPages = await browser.pages();
    for (let i = 1; i < allPages.length; i++) {
      await allPages[i].close();
    }

    // Open tabs in window 1
    await window1Page.goto('https://github.com/facebook/react', { waitUntil: 'networkidle2', timeout: 15000 });
    const window1Tab2 = await browser.newPage();
    await window1Tab2.goto('https://example.com/page1', { waitUntil: 'networkidle2', timeout: 15000 });

    // Create tabs in window 2 (with duplicates)
    const window2Tab1 = await browser.newPage();
    await window2Tab1.goto('https://github.com/facebook/react', { waitUntil: 'networkidle2', timeout: 15000 }); // Duplicate
    const window2Tab2 = await browser.newPage();
    await window2Tab2.goto('https://github.com/vuejs/vue', { waitUntil: 'networkidle2', timeout: 15000 }); // Unique
    const window2Tab3 = await browser.newPage();
    await window2Tab3.goto('https://example.com/page1', { waitUntil: 'networkidle2', timeout: 15000 }); // Duplicate

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Count tabs before
    const tabsBefore = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      return tabs.length;
    });
    console.log(`Tabs before deduplication: ${tabsBefore}`);

    // Organize all windows (should remove duplicates)
    await organizeTabs(true);

    // Count tabs after
    const tabsAfter = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      return tabs.filter(t =>
        !t.url.startsWith('chrome://') &&
        !t.url.startsWith('chrome-extension://') &&
        t.url !== 'about:blank'
      ).length;
    });
    console.log(`Tabs after deduplication: ${tabsAfter}`);

    // Should have removed 2 duplicates (react and example.com)
    // Original: 5 tabs total, 2 duplicates = 3 unique tabs
    expect(tabsAfter).toBe(3);

    // Verify groups created correctly
    const groups = await serviceWorker.evaluate(async () => {
      const groups = await chrome.tabGroups.query({});
      return groups.map(g => ({ id: g.id, title: g.title }));
    });

    const githubGroup = groups.find(g => g.title.includes('github.com'));
    expect(githubGroup).toBeDefined();
    expect(githubGroup.title).toBe('github.com (2)'); // react + vue (angular duplicate removed)

    console.log('✅ Cross-window duplicate removal passed!');
  }, 120000);

  test('should work with category organization across windows', async () => {
    console.log('=== Cross-Window: Category Organization ===');

    // Close all existing tabs
    const allPages = await browser.pages();
    for (let i = 1; i < allPages.length; i++) {
      await allPages[i].close();
    }

    // Window 1 - Development sites
    await window1Page.goto('https://github.com/facebook/react', { waitUntil: 'networkidle2', timeout: 15000 });
    const window1Tab2 = await browser.newPage();
    await window1Tab2.goto('https://stackoverflow.com/questions/1', { waitUntil: 'networkidle2', timeout: 15000 });

    // Window 2 - More development sites
    const window2Tab1 = await browser.newPage();
    await window2Tab1.goto('https://github.com/vuejs/vue', { waitUntil: 'networkidle2', timeout: 15000 });
    const window2Tab2 = await browser.newPage();
    await window2Tab2.goto('https://stackoverflow.com/questions/2', { waitUntil: 'networkidle2', timeout: 15000 });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Organize by category across all windows
    const popupPage = await browser.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForSelector('#organizeAllWindowsCategoryBtn');
    await popupPage.click('#organizeAllWindowsCategoryBtn');
    await popupPage.waitForFunction(
      () => {
        const status = document.getElementById('status');
        return status && status.style.display !== 'none';
      },
      { timeout: 15000 }
    );
    await new Promise(resolve => setTimeout(resolve, 2000));
    await popupPage.close();

    // Verify all grouped under Development category
    const groups = await serviceWorker.evaluate(async () => {
      const groups = await chrome.tabGroups.query({});
      return groups.map(g => ({ id: g.id, title: g.title }));
    });

    console.log('Groups after category organization:', groups);

    const developmentGroup = groups.find(g => g.title.includes('Development'));
    expect(developmentGroup).toBeDefined();
    expect(developmentGroup.title).toBe('Development (4)');

    console.log('✅ Cross-window category organization passed!');
  }, 120000);

  test('should handle empty windows gracefully', async () => {
    console.log('=== Cross-Window: Empty Windows ===');

    // Close all tabs except one
    const allPages = await browser.pages();
    for (let i = 1; i < allPages.length; i++) {
      await allPages[i].close();
    }

    await window1Page.goto('about:blank');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Organize all windows (should handle empty gracefully)
    await organizeTabs(true);

    const groups = await serviceWorker.evaluate(async () => {
      const groups = await chrome.tabGroups.query({});
      return groups.map(g => ({ id: g.id, title: g.title }));
    });

    console.log('Groups after organizing empty windows:', groups);
    expect(groups.length).toBe(0); // No groups should be created

    console.log('✅ Empty windows handled gracefully!');
  }, 60000);

  test('should skip chrome internal pages in cross-window organization', async () => {
    console.log('=== Cross-Window: Skip Chrome Internal Pages ===');

    // Close all existing tabs
    const allPages = await browser.pages();
    for (let i = 1; i < allPages.length; i++) {
      await allPages[i].close();
    }

    // Window 1 - Regular tabs
    await window1Page.goto('https://github.com/facebook/react', { waitUntil: 'networkidle2', timeout: 15000 });
    const window1Tab2 = await browser.newPage();
    await window1Tab2.goto('https://github.com/vuejs/vue', { waitUntil: 'networkidle2', timeout: 15000 });

    // Window 2 - Mix of regular and special tabs
    const window2Tab1 = await browser.newPage();
    await window2Tab1.goto('about:blank');
    const window2Tab2 = await browser.newPage();
    await window2Tab2.goto('https://github.com/angular/angular', { waitUntil: 'networkidle2', timeout: 15000 });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Organize all windows
    await organizeTabs(true);

    // Verify only regular tabs are grouped
    const groups = await serviceWorker.evaluate(async () => {
      const groups = await chrome.tabGroups.query({});
      return groups.map(g => ({ id: g.id, title: g.title }));
    });

    console.log('Groups after skipping chrome pages:', groups);

    const githubGroup = groups.find(g => g.title.includes('github.com'));
    expect(githubGroup).toBeDefined();
    expect(githubGroup.title).toBe('github.com (3)'); // Only the 3 github tabs

    console.log('✅ Chrome internal pages skipped correctly!');
  }, 120000);
});
