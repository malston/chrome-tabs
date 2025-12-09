/**
 * E2E Test: Automatic Duplicate Removal During Organize
 *
 * Tests that duplicate tabs are automatically closed when organizing:
 * - Opens tabs with duplicates
 * - Clicks "Organize by Domain" or "Organize by Category"
 * - Verifies duplicates are automatically closed
 * - Verifies status message reports duplicates removed
 * - Tests both domain and category modes
 */

const puppeteer = require('puppeteer');
const { getPuppeteerConfig } = require('./test-config');

describe('Automatic Duplicate Removal During Organize', () => {
  let browser;
  let page;
  let extensionId;
  let serviceWorker;

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

    // Get service worker for API calls
    serviceWorker = await extensionTarget.worker();

    // Get the first page
    const pages = await browser.pages();
    page = pages[0];
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('should close ungrouped duplicates of grouped tabs during organize', async () => {
    console.log('=== Test: Close Ungrouped Duplicates of Grouped Tabs ===');

    // Step 1: Open initial tabs across multiple domains
    console.log('Opening initial tabs...');
    const initialUrls = [
      'https://github.com/facebook/react',
      'https://github.com/vuejs/vue',
      'https://github.com/angular/angular',
      'https://google.com/search?q=javascript',
      'https://google.com/search?q=typescript'
    ];

    for (let i = 0; i < initialUrls.length; i++) {
      if (i === 0) {
        await page.goto(initialUrls[i], { waitUntil: 'load', timeout: 60000 });
      } else {
        const newPage = await browser.newPage();
        await newPage.goto(initialUrls[i], { waitUntil: 'load', timeout: 60000 });
      }
    }

    console.log(`Opened ${initialUrls.length} initial tabs`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Organize tabs into groups
    console.log('First organization - creating groups...');
    let popupPage = await browser.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    await popupPage.waitForSelector('#organizeBtn');
    await popupPage.click('#organizeBtn');

    // Wait for organization to complete
    await popupPage.waitForFunction(
      () => {
        const status = document.getElementById('status');
        return status && status.classList.contains('show');
      },
      { timeout: 10000 }
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify groups were created
    const groupsAfterFirstOrg = await serviceWorker.evaluate(async () => {
      const groups = await chrome.tabGroups.query({});
      return groups.map(g => ({ id: g.id, title: g.title }));
    });

    console.log('Groups created:', groupsAfterFirstOrg);
    expect(groupsAfterFirstOrg.length).toBe(2); // github.com and google.com

    // Close popup
    await popupPage.close();

    // Step 3: Open new ungrouped tabs that duplicate existing grouped tabs
    console.log('Opening ungrouped duplicate tabs...');
    const duplicateUrls = [
      'https://github.com/facebook/react',  // Duplicate of grouped tab
      'https://google.com/search?q=javascript', // Duplicate of grouped tab
      'https://example.com/unique' // Not a duplicate
    ];

    for (const url of duplicateUrls) {
      const newPage = await browser.newPage();
      await newPage.goto(url, { waitUntil: 'load', timeout: 60000 });
    }

    console.log(`Opened ${duplicateUrls.length} new tabs (2 duplicates, 1 unique)`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Count tabs before second organization
    const tabsBeforeSecondOrg = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      return tabs.filter(t =>
        !t.url.startsWith('chrome://') &&
        !t.url.startsWith('chrome-extension://') &&
        t.url !== 'about:blank'
      ).length;
    });

    console.log(`Tabs before second organization: ${tabsBeforeSecondOrg}`);
    expect(tabsBeforeSecondOrg).toBe(8); // 5 initial + 3 new

    // Step 4: Organize again - duplicates should be automatically closed
    console.log('Second organization - should close duplicates...');
    popupPage = await browser.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    await popupPage.waitForSelector('#organizeBtn');
    await popupPage.click('#organizeBtn');

    // Wait for organization to complete
    await popupPage.waitForFunction(
      () => {
        const status = document.getElementById('status');
        return status && status.classList.contains('show');
      },
      { timeout: 10000 }
    );

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 5: Verify status message reports duplicates removed
    const statusMessage = await popupPage.evaluate(() => {
      const status = document.getElementById('status');
      return status ? status.textContent : '';
    });

    console.log('Status message:', statusMessage);
    expect(statusMessage).toContain('Removed');
    expect(statusMessage).toContain('duplicate');
    // Should report at least 1 duplicate removed (timing may affect exact count)
    expect(statusMessage).toMatch(/Removed \d+ duplicate/i);

    // Step 6: Verify duplicates were actually closed
    const tabsAfterSecondOrg = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      return tabs.filter(t =>
        !t.url.startsWith('chrome://') &&
        !t.url.startsWith('chrome-extension://') &&
        t.url !== 'about:blank'
      ).map(t => ({ url: t.url, groupId: t.groupId }));
    });

    console.log(`Total tabs after organization: ${tabsAfterSecondOrg.length}`);
    console.log('Tabs:', tabsAfterSecondOrg.map(t => t.url));

    // Should have fewer tabs than before (duplicates were closed)
    expect(tabsAfterSecondOrg.length).toBeLessThan(tabsBeforeSecondOrg);
    // Should have at least 6 tabs (5 initial + 1 unique, or more if timing affected duplicate detection)
    expect(tabsAfterSecondOrg.length).toBeGreaterThanOrEqual(6);

    // Verify no duplicate URLs exist
    const urls = tabsAfterSecondOrg.map(t => t.url);
    const uniqueUrls = new Set(urls);
    expect(uniqueUrls.size).toBe(urls.length); // All URLs should be unique

    console.log('✅ Ungrouped duplicates of grouped tabs closed successfully!');
    await popupPage.close();
  }, 90000); // 90 second timeout

  test('should close multiple ungrouped tabs with same URL during organize', async () => {
    console.log('=== Test: Close Multiple Ungrouped Duplicates ===');

    // Clean up from previous test
    await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      const tabsToClose = tabs.slice(1);
      if (tabsToClose.length > 0) {
        await chrome.tabs.remove(tabsToClose.map(t => t.id));
      }
      const groups = await chrome.tabGroups.query({});
      for (const group of groups) {
        const groupTabs = await chrome.tabs.query({ groupId: group.id });
        if (groupTabs.length > 0) {
          await chrome.tabs.ungroup(groupTabs.map(t => t.id));
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 1: Open multiple ungrouped tabs with same URL
    console.log('Opening ungrouped duplicate tabs...');
    const duplicateUrl = 'https://github.com/facebook/react';
    const uniqueUrls = [
      'https://github.com/vuejs/vue',
      'https://github.com/angular/angular'
    ];

    // Open first unique URL
    const pages = await browser.pages();
    await pages[0].goto(uniqueUrls[0], { waitUntil: 'load', timeout: 60000 });

    // Open 3 copies of the duplicate URL
    for (let i = 0; i < 3; i++) {
      const newPage = await browser.newPage();
      await newPage.goto(duplicateUrl, { waitUntil: 'load', timeout: 60000 });
    }

    // Open second unique URL
    const newPage = await browser.newPage();
    await newPage.goto(uniqueUrls[1], { waitUntil: 'load', timeout: 60000 });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Count tabs before organization
    const tabsBefore = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      return tabs.filter(t =>
        !t.url.startsWith('chrome://') &&
        !t.url.startsWith('chrome-extension://') &&
        t.url !== 'about:blank'
      ).length;
    });

    console.log(`Tabs before organization: ${tabsBefore}`);
    expect(tabsBefore).toBe(5); // 3 duplicates + 2 unique

    // Step 2: Organize - should keep first occurrence, close rest
    console.log('Organizing - should close duplicate occurrences...');
    const popupPage = await browser.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    await popupPage.waitForSelector('#organizeBtn');
    await popupPage.click('#organizeBtn');

    await popupPage.waitForFunction(
      () => {
        const status = document.getElementById('status');
        return status && status.classList.contains('show');
      },
      { timeout: 10000 }
    );

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 3: Verify status message reports 2 duplicates removed
    const statusMessage = await popupPage.evaluate(() => {
      const status = document.getElementById('status');
      return status ? status.textContent : '';
    });

    console.log('Status message:', statusMessage);
    expect(statusMessage).toContain('Removed 2 duplicate');

    // Step 4: Verify only first occurrence kept
    const tabsAfter = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      return tabs.filter(t =>
        !t.url.startsWith('chrome://') &&
        !t.url.startsWith('chrome-extension://') &&
        t.url !== 'about:blank'
      ).map(t => t.url);
    });

    console.log(`Tabs after organization: ${tabsAfter.length}`);
    expect(tabsAfter.length).toBe(3); // 3 unique URLs (2 duplicates closed)

    // Verify all URLs are unique
    const uniqueUrlsSet = new Set(tabsAfter);
    expect(uniqueUrlsSet.size).toBe(3);

    console.log('✅ Multiple ungrouped duplicates closed successfully!');
    await popupPage.close();
  }, 90000);

  test('should work with category mode', async () => {
    console.log('=== Test: Duplicate Removal with Category Mode ===');

    // Clean up from previous test
    await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      const tabsToClose = tabs.slice(1);
      if (tabsToClose.length > 0) {
        await chrome.tabs.remove(tabsToClose.map(t => t.id));
      }
      const groups = await chrome.tabGroups.query({});
      for (const group of groups) {
        const groupTabs = await chrome.tabs.query({ groupId: group.id });
        if (groupTabs.length > 0) {
          await chrome.tabs.ungroup(groupTabs.map(t => t.id));
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 1: Open Development category tabs
    console.log('Opening Development category tabs...');
    const devUrls = [
      'https://github.com/facebook/react',
      'https://stackoverflow.com/questions/1',
      'https://github.com/vuejs/vue'
    ];

    const pages = await browser.pages();
    await pages[0].goto(devUrls[0], { waitUntil: 'load', timeout: 60000 });

    for (let i = 1; i < devUrls.length; i++) {
      const newPage = await browser.newPage();
      await newPage.goto(devUrls[i], { waitUntil: 'load', timeout: 60000 });
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Organize by category
    console.log('Organizing by category...');
    let popupPage = await browser.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    await popupPage.waitForSelector('#organizeCategoryBtn');
    await popupPage.click('#organizeCategoryBtn');

    await popupPage.waitForFunction(
      () => {
        const status = document.getElementById('status');
        return status && status.classList.contains('show');
      },
      { timeout: 10000 }
    );

    await popupPage.close();
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 3: Open ungrouped duplicate
    console.log('Opening ungrouped duplicate (Development category)...');
    const duplicatePage = await browser.newPage();
    await duplicatePage.goto('https://github.com/facebook/react', {
      waitUntil: 'load',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Count tabs before re-organizing
    const tabsBefore = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      return tabs.filter(t =>
        !t.url.startsWith('chrome://') &&
        !t.url.startsWith('chrome-extension://') &&
        t.url !== 'about:blank'
      ).length;
    });

    console.log(`Tabs before re-organization: ${tabsBefore}`);
    expect(tabsBefore).toBe(4); // 3 initial + 1 duplicate

    // Step 4: Organize again - duplicate should be closed
    console.log('Re-organizing by category...');
    popupPage = await browser.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    await popupPage.waitForSelector('#organizeCategoryBtn');
    await popupPage.click('#organizeCategoryBtn');

    await popupPage.waitForFunction(
      () => {
        const status = document.getElementById('status');
        return status && status.classList.contains('show');
      },
      { timeout: 10000 }
    );

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify status message reports duplicate removed
    const statusMessage = await popupPage.evaluate(() => {
      const status = document.getElementById('status');
      return status ? status.textContent : '';
    });

    console.log('Status message (category mode):', statusMessage);
    expect(statusMessage).toContain('Removed 1 duplicate');

    // Verify duplicate was closed
    const tabsAfter = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      return tabs.filter(t =>
        !t.url.startsWith('chrome://') &&
        !t.url.startsWith('chrome-extension://') &&
        t.url !== 'about:blank'
      ).length;
    });

    console.log(`Tabs after re-organization: ${tabsAfter}`);
    expect(tabsAfter).toBe(3); // Duplicate closed

    console.log('✅ Category mode duplicate removal test passed!');
    await popupPage.close();
  }, 90000);

  test('should show no duplicate message when there are no duplicates', async () => {
    console.log('=== Test: No Message When No Duplicates ===');

    // Clean up
    await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      const tabsToClose = tabs.slice(1);
      if (tabsToClose.length > 0) {
        await chrome.tabs.remove(tabsToClose.map(t => t.id));
      }
      const groups = await chrome.tabGroups.query({});
      for (const group of groups) {
        const groupTabs = await chrome.tabs.query({ groupId: group.id });
        if (groupTabs.length > 0) {
          await chrome.tabs.ungroup(groupTabs.map(t => t.id));
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 1: Open unique tabs (no duplicates)
    console.log('Opening unique tabs...');
    const uniqueUrls = [
      'https://github.com/facebook/react',
      'https://github.com/vuejs/vue',
      'https://google.com/search?q=javascript',
      'https://google.com/search?q=typescript'
    ];

    const pages = await browser.pages();
    await pages[0].goto(uniqueUrls[0], { waitUntil: 'load', timeout: 60000 });

    for (let i = 1; i < uniqueUrls.length; i++) {
      const newPage = await browser.newPage();
      await newPage.goto(uniqueUrls[i], { waitUntil: 'load', timeout: 60000 });
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Organize tabs
    console.log('Organizing tabs...');
    const popupPage = await browser.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    await popupPage.waitForSelector('#organizeBtn');
    await popupPage.click('#organizeBtn');

    await popupPage.waitForFunction(
      () => {
        const status = document.getElementById('status');
        return status && status.classList.contains('show');
      },
      { timeout: 10000 }
    );

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 3: Verify no duplicate message in status
    const statusMessage = await popupPage.evaluate(() => {
      const status = document.getElementById('status');
      return status ? status.textContent : '';
    });

    console.log('Status message (no duplicates):', statusMessage);
    expect(statusMessage).not.toContain('Removed');
    expect(statusMessage).not.toContain('duplicate');
    expect(statusMessage).toContain('Organized'); // Should still show success

    console.log('✅ No duplicate message test passed!');
    await popupPage.close();
  }, 90000);
});
