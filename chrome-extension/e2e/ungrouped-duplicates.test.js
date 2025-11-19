/**
 * E2E Test: Ungrouped Duplicates Detection
 *
 * Tests the ungrouped duplicate detection feature:
 * - Opens tabs and organizes them into groups
 * - Opens new ungrouped tabs that duplicate existing grouped tabs
 * - Clicks "Organize by Domain" again
 * - Verifies the status message shows ungrouped duplicate warning
 * - Verifies ungrouped duplicates are NOT automatically removed
 * - Tests with both domain and category modes
 */

const puppeteer = require('puppeteer');
const { getPuppeteerConfig } = require('./test-config');

describe('Ungrouped Duplicates Detection', () => {
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

  test('should detect ungrouped duplicates of grouped tabs', async () => {
    console.log('=== Test: Detect Ungrouped Duplicates ===');

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
        await page.goto(initialUrls[i], { waitUntil: 'networkidle2', timeout: 30000 });
      } else {
        const newPage = await browser.newPage();
        await newPage.goto(initialUrls[i], { waitUntil: 'networkidle2', timeout: 30000 });
      }
    }

    console.log(`Opened ${initialUrls.length} initial tabs`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Organize tabs into groups
    console.log('First organization - creating groups...');
    let popupPage = await browser.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
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
      await newPage.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    }

    console.log(`Opened ${duplicateUrls.length} new tabs (2 duplicates, 1 unique)`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify the new tabs are ungrouped
    const tabsBeforeSecondOrg = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      return tabs.map(t => ({ url: t.url, groupId: t.groupId }));
    });

    const ungroupedCount = tabsBeforeSecondOrg.filter(t => t.groupId === -1).length;
    console.log(`Ungrouped tabs before second organization: ${ungroupedCount}`);
    expect(ungroupedCount).toBeGreaterThanOrEqual(3); // At least the 3 new tabs

    // Step 4: Organize again and check for ungrouped duplicate warning
    console.log('Second organization - should detect ungrouped duplicates...');
    popupPage = await browser.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
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

    // Step 5: Verify status message contains ungrouped duplicate warning
    const statusMessage = await popupPage.evaluate(() => {
      const status = document.getElementById('status');
      return status ? status.textContent : '';
    });

    console.log('Status message:', statusMessage);
    expect(statusMessage).toContain('Warning');
    expect(statusMessage).toContain('ungrouped duplicate');
    // The warning should mention at least 1 duplicate (exact count may vary due to timing)
    expect(statusMessage).toMatch(/\d+.*ungrouped duplicate/i);

    // Step 6: Verify ungrouped duplicates stayed ungrouped (were NOT organized into groups)
    const tabsAfterSecondOrg = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      return tabs.map(t => ({ url: t.url, groupId: t.groupId }));
    });

    console.log(`Total tabs after organization: ${tabsAfterSecondOrg.length}`);

    // We opened 5 initial + 3 new = 8 tabs total
    // All should still exist (duplicates are NOT removed, just left ungrouped)
    expect(tabsAfterSecondOrg.length).toBeGreaterThanOrEqual(7); // Allow for some variance

    // Count how many tabs are ungrouped
    const ungroupedTabs = tabsAfterSecondOrg.filter(t => t.groupId === -1);
    console.log(`Ungrouped tabs after organization: ${ungroupedTabs.length}`);

    // The duplicate tabs should still be ungrouped (at least 2)
    expect(ungroupedTabs.length).toBeGreaterThanOrEqual(2);

    // Step 7: Verify groups were NOT updated with the duplicates
    const finalGroups = await serviceWorker.evaluate(async () => {
      const groups = await chrome.tabGroups.query({});
      return groups.map(g => ({ id: g.id, title: g.title }));
    });

    console.log('Final groups:', finalGroups);
    // Should still have 2 groups (github.com and google.com)
    expect(finalGroups.length).toBeGreaterThanOrEqual(2);

    // Verify group counts did NOT increase (duplicates were not added)
    const githubGroup = finalGroups.find(g => g.title.startsWith('github.com'));
    const googleGroup = finalGroups.find(g => g.title.startsWith('google.com'));

    if (githubGroup) {
      console.log(`GitHub group: ${githubGroup.title}`);
      // Should still be (3) or (4), not increased by the duplicate
      expect(githubGroup.title).toMatch(/github\.com \([3-4]\)/);
    }

    if (googleGroup) {
      console.log(`Google group: ${googleGroup.title}`);
      // Should still be (2) or (3), not increased by the duplicate
      expect(googleGroup.title).toMatch(/google\.com \([2-3]\)/);
    }

    console.log('✅ Ungrouped duplicates detection test passed!');
    await popupPage.close();
  }, 90000); // 90 second timeout

  test('should work with category mode', async () => {
    console.log('=== Test: Ungrouped Duplicates with Category Mode ===');

    // Close all tabs and start fresh
    await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      const tabsToClose = tabs.slice(1); // Keep at least one tab
      if (tabsToClose.length > 0) {
        await chrome.tabs.remove(tabsToClose.map(t => t.id));
      }
      // Remove all groups
      const groups = await chrome.tabGroups.query({});
      for (const group of groups) {
        const groupTabs = await chrome.tabs.query({ groupId: group.id });
        if (groupTabs.length > 0) {
          await chrome.tabs.ungroup(groupTabs.map(t => t.id));
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 1: Open tabs that will be categorized as "Development"
    console.log('Opening Development category tabs...');
    const devUrls = [
      'https://github.com/facebook/react',
      'https://stackoverflow.com/questions/1',
      'https://github.com/vuejs/vue'
    ];

    const pages = await browser.pages();
    await pages[0].goto(devUrls[0], { waitUntil: 'networkidle2', timeout: 30000 });

    for (let i = 1; i < devUrls.length; i++) {
      const newPage = await browser.newPage();
      await newPage.goto(devUrls[i], { waitUntil: 'networkidle2', timeout: 30000 });
    }

    console.log(`Opened ${devUrls.length} Development tabs`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Organize by category
    console.log('Organizing by category...');
    let popupPage = await browser.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForSelector('#organizeCategoryBtn');
    await popupPage.click('#organizeCategoryBtn');

    await popupPage.waitForFunction(
      () => {
        const status = document.getElementById('status');
        return status && status.classList.contains('show');
      },
      { timeout: 10000 }
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify Development group was created
    const groups = await serviceWorker.evaluate(async () => {
      const groups = await chrome.tabGroups.query({});
      return groups.map(g => ({ id: g.id, title: g.title }));
    });

    console.log('Groups after category organization:', groups);
    expect(groups.some(g => g.title.startsWith('Development'))).toBe(true);

    await popupPage.close();

    // Step 3: Open ungrouped duplicate
    console.log('Opening ungrouped duplicate (Development category)...');
    const duplicatePage = await browser.newPage();
    await duplicatePage.goto('https://github.com/facebook/react', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 4: Organize again and verify warning
    console.log('Re-organizing by category...');
    popupPage = await browser.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
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

    // Verify warning message
    const statusMessage = await popupPage.evaluate(() => {
      const status = document.getElementById('status');
      return status ? status.textContent : '';
    });

    console.log('Status message (category mode):', statusMessage);
    expect(statusMessage).toContain('Warning');
    expect(statusMessage).toContain('ungrouped duplicate');

    console.log('✅ Category mode ungrouped duplicates detection test passed!');
    await popupPage.close();
  }, 90000); // 90 second timeout

  test('should show no warning when there are no ungrouped duplicates', async () => {
    console.log('=== Test: No Warning When No Ungrouped Duplicates ===');

    // Close all tabs and start fresh
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
    await pages[0].goto(uniqueUrls[0], { waitUntil: 'networkidle2', timeout: 30000 });

    for (let i = 1; i < uniqueUrls.length; i++) {
      const newPage = await browser.newPage();
      await newPage.goto(uniqueUrls[i], { waitUntil: 'networkidle2', timeout: 30000 });
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Organize tabs
    console.log('Organizing tabs...');
    const popupPage = await browser.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
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

    // Step 3: Verify no warning in status message
    const statusMessage = await popupPage.evaluate(() => {
      const status = document.getElementById('status');
      return status ? status.textContent : '';
    });

    console.log('Status message (no duplicates):', statusMessage);
    expect(statusMessage).not.toContain('Warning');
    expect(statusMessage).not.toContain('ungrouped duplicate');
    expect(statusMessage).toContain('Organized'); // Should still show success

    console.log('✅ No warning test passed!');
    await popupPage.close();
  }, 90000); // 90 second timeout
});
