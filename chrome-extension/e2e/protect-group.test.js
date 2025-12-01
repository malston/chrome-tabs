/**
 * E2E Test: Protect Group Feature
 *
 * Tests the protect group functionality:
 * - Creates tab groups
 * - Protects a group (saves to bookmarks)
 * - Verifies bookmark folder is created with correct naming
 * - Verifies protection metadata is stored
 */

const puppeteer = require('puppeteer');
const { getPuppeteerConfig } = require('./test-config');

const TEST_URLS = {
  github: [
    'https://github.com/facebook/react',
    'https://github.com/vuejs/vue',
    'https://github.com/angular/angular'
  ],
  google: [
    'https://www.google.com/search?q=javascript',
    'https://www.google.com/search?q=typescript'
  ]
};

describe('Protect Group Feature', () => {
  let browser;
  let page;
  let extensionId;
  let serviceWorker;

  beforeAll(async () => {
    browser = await puppeteer.launch(getPuppeteerConfig());

    const extensionTarget = await browser.waitForTarget(
      target => target.type() === 'service_worker' && target.url().includes('chrome-extension://'),
      { timeout: 10000 }
    );

    if (!extensionTarget) {
      throw new Error('Extension service worker not found');
    }

    const extensionUrl = extensionTarget.url();
    extensionId = extensionUrl.split('/')[2];
    console.log(`Extension loaded with ID: ${extensionId}`);

    const pages = await browser.pages();
    page = pages[0];

    serviceWorker = await extensionTarget.worker();
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  async function getServiceWorker() {
    const extensionTarget = await browser.waitForTarget(
      target => target.type() === 'service_worker' && target.url().includes(extensionId),
      { timeout: 10000 }
    );
    return extensionTarget.worker();
  }

  async function cleanupProtectedBookmarks(sw) {
    try {
      await sw.evaluate(async () => {
        const tree = await chrome.bookmarks.getTree();
        // Check both "Other Bookmarks" and "Bookmarks Bar" for CI compatibility
        const possibleParents = tree[0].children.filter(c =>
          c.title === 'Other Bookmarks' || c.title === 'Bookmarks Bar' || c.title === 'Bookmarks bar'
        );

        for (const parent of possibleParents) {
          if (parent.children) {
            for (const child of parent.children) {
              if (child.title.startsWith('🔒')) {
                await chrome.bookmarks.removeTree(child.id);
              }
            }
          }
        }
        await chrome.storage.local.remove('protectedGroups');
      });
    } catch (e) {
      console.log('Cleanup warning:', e.message);
    }
  }

  beforeEach(async () => {
    // Close all tabs except first one (this also removes groups)
    const pages = await browser.pages();
    for (let i = 1; i < pages.length; i++) {
      await pages[i].close();
    }

    // Navigate first page to blank to ensure no groups remain
    await page.goto('about:blank');

    // Wait a moment for Chrome to clean up groups
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  test('should protect a tab group and save to bookmarks', async () => {
    console.log('=== Test: Protect a Tab Group ===');

    // Get fresh service worker
    serviceWorker = await getServiceWorker();
    await cleanupProtectedBookmarks(serviceWorker);

    // Step 1: Open tabs and organize them into groups
    console.log('Opening test tabs...');

    const allUrls = [...TEST_URLS.github, ...TEST_URLS.google];

    for (let i = 0; i < allUrls.length; i++) {
      const url = allUrls[i];
      if (i === 0) {
        await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      } else {
        const newPage = await browser.newPage();
        await newPage.goto(url, { waitUntil: 'load', timeout: 60000 });
      }
    }

    console.log(`Opened ${allUrls.length} tabs`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Organize tabs by domain
    console.log('Organizing tabs by domain...');
    const popupUrl = `chrome-extension://${extensionId}/src/popup/popup.html`;
    let popupPage = await browser.newPage();
    await popupPage.goto(popupUrl);
    await popupPage.waitForSelector('#organizeBtn');
    await popupPage.click('#organizeBtn');

    await popupPage.waitForFunction(
      () => {
        const status = document.getElementById('status');
        return status && status.textContent.includes('Organized');
      },
      { timeout: 10000 }
    );

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify groups were created
    const initialGroups = await serviceWorker.evaluate(async () => {
      const groups = await chrome.tabGroups.query({});
      return groups.map(g => ({ id: g.id, title: g.title }));
    });

    console.log('Groups created:', initialGroups);
    expect(initialGroups.length).toBe(2);

    const githubGroup = initialGroups.find(g => g.title.includes('github.com'));
    expect(githubGroup).toBeDefined();

    // Step 3: Click "Protect Group" button
    console.log('Clicking Protect Group button...');
    await popupPage.click('#protectGroupBtn');

    await popupPage.waitForSelector('#protectGroupSelector', { visible: true });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 4: Verify group selector is populated
    const options = await popupPage.evaluate(() => {
      const select = document.getElementById('protectGroupSelect');
      return Array.from(select.options).map(o => ({ value: o.value, text: o.textContent }));
    });

    console.log('Group options:', options);
    expect(options.length).toBe(2);

    // Step 5: Select the GitHub group and protect it
    console.log('Selecting GitHub group to protect...');
    await popupPage.select('#protectGroupSelect', String(githubGroup.id));

    // Small delay to ensure selection is registered
    await new Promise(resolve => setTimeout(resolve, 200));

    // Get current status before protect (to detect change)
    const statusBefore = await popupPage.evaluate(() => {
      return document.getElementById('status').textContent;
    });
    console.log('Status before protect:', statusBefore);

    console.log('Clicking Protect button...');
    await popupPage.click('#protectSelectedBtn');

    // Wait for status to change from before (longer timeout for CI)
    try {
      await popupPage.waitForFunction(
        (prevStatus) => {
          const status = document.getElementById('status');
          return status && status.textContent !== prevStatus && status.textContent.length > 0;
        },
        { timeout: 20000 },
        statusBefore
      );
    } catch (e) {
      // Log current state for debugging
      const debugInfo = await popupPage.evaluate(() => {
        const status = document.getElementById('status');
        const btn = document.getElementById('protectSelectedBtn');
        return {
          statusText: status ? status.textContent : 'no status element',
          statusDisplay: status ? status.style.display : 'no status',
          btnDisabled: btn ? btn.disabled : 'no btn',
          btnText: btn ? btn.textContent : 'no btn'
        };
      });
      console.log('Debug info on timeout:', debugInfo);
      throw e;
    }

    const statusMessage = await popupPage.evaluate(() => {
      return document.getElementById('status').textContent;
    });

    console.log('Status message:', statusMessage);

    // Check for error
    if (statusMessage.includes('Error')) {
      console.log('ERROR: Protection failed with:', statusMessage);
    }

    expect(statusMessage).toContain('Protected');
    expect(statusMessage).toContain('1 group');
    expect(statusMessage).toContain('3 tabs');

    // Step 6: Verify bookmark folder was created
    console.log('Verifying bookmark folder...');
    const bookmarkFolders = await serviceWorker.evaluate(async () => {
      const tree = await chrome.bookmarks.getTree();
      // Check both "Other Bookmarks" and "Bookmarks Bar" for CI compatibility
      const possibleParents = tree[0].children.filter(c =>
        c.title === 'Other Bookmarks' || c.title === 'Bookmarks Bar' || c.title === 'Bookmarks bar'
      );

      const protectedFolders = [];
      for (const parent of possibleParents) {
        if (parent.children) {
          const found = parent.children
            .filter(c => c.title.startsWith('🔒'))
            .map(c => ({ id: c.id, title: c.title }));
          protectedFolders.push(...found);
        }
      }
      return protectedFolders;
    });

    console.log('Protected bookmark folders:', bookmarkFolders);
    expect(bookmarkFolders.length).toBe(1);
    expect(bookmarkFolders[0].title).toContain('🔒 github.com');

    // Step 7: Verify bookmarks were created in the folder
    const bookmarks = await serviceWorker.evaluate(async (folderId) => {
      const children = await chrome.bookmarks.getChildren(folderId);
      return children.map(b => ({ title: b.title, url: b.url }));
    }, bookmarkFolders[0].id);

    console.log('Bookmarks in protected folder:', bookmarks);
    expect(bookmarks.length).toBe(3);
    expect(bookmarks.some(b => b.url.includes('github.com/facebook/react'))).toBe(true);

    // Step 8: Verify protection metadata in storage
    const protectedGroups = await serviceWorker.evaluate(async () => {
      const result = await chrome.storage.local.get('protectedGroups');
      return result.protectedGroups || {};
    });

    console.log('Protected groups in storage:', protectedGroups);
    expect(Object.keys(protectedGroups).length).toBe(1);

    const metadata = Object.values(protectedGroups)[0];
    expect(metadata.groupTitle).toContain('github.com');
    expect(metadata.tabCount).toBe(3);
    expect(metadata.bookmarkFolderId).toBe(bookmarkFolders[0].id);
    expect(metadata.protectedAt).toBeDefined();

    console.log('✅ Protect group test passed!');

    await popupPage.close();
  }, 90000);

  test('should show error when no groups to protect', async () => {
    console.log('=== Test: No Groups to Protect ===');

    // Get fresh service worker
    serviceWorker = await getServiceWorker();

    // Verify there are no groups
    const existingGroups = await serviceWorker.evaluate(async () => {
      return await chrome.tabGroups.query({});
    });
    console.log('Existing groups before test:', existingGroups);

    // If there are groups, the test setup failed - skip with clear message
    if (existingGroups.length > 0) {
      console.log('Warning: Groups still exist from previous test, removing them...');
      // Ungroup all tabs to remove groups
      await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        const groupedTabs = tabs.filter(t => t.groupId !== -1);
        if (groupedTabs.length > 0) {
          await chrome.tabs.ungroup(groupedTabs.map(t => t.id));
        }
      });
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Open popup
    const popupUrl = `chrome-extension://${extensionId}/src/popup/popup.html`;
    const popupPage = await browser.newPage();
    await popupPage.goto(popupUrl);
    await popupPage.waitForSelector('#protectGroupBtn');

    // Click protect group
    await popupPage.click('#protectGroupBtn');

    // Wait for status message to appear
    await popupPage.waitForFunction(
      () => {
        const status = document.getElementById('status');
        return status && status.style.display !== 'none' && status.textContent.length > 0;
      },
      { timeout: 10000 }
    );

    const statusMessage = await popupPage.evaluate(() => {
      return document.getElementById('status').textContent;
    });

    console.log('Status message:', statusMessage);
    expect(statusMessage).toBe('No groups to protect');

    console.log('✅ No groups error test passed!');

    await popupPage.close();
  }, 30000);

  test('should cancel protect group selection', async () => {
    console.log('=== Test: Cancel Protect Selection ===');

    // Get fresh service worker
    serviceWorker = await getServiceWorker();
    await cleanupProtectedBookmarks(serviceWorker);

    // Create a group first
    console.log('Opening test tabs...');
    for (let i = 0; i < TEST_URLS.github.length; i++) {
      const url = TEST_URLS.github[i];
      if (i === 0) {
        await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      } else {
        const newPage = await browser.newPage();
        await newPage.goto(url, { waitUntil: 'load', timeout: 60000 });
      }
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Organize tabs
    const popupUrl = `chrome-extension://${extensionId}/src/popup/popup.html`;
    const popupPage = await browser.newPage();
    await popupPage.goto(popupUrl);
    await popupPage.waitForSelector('#organizeBtn');
    await popupPage.click('#organizeBtn');

    await popupPage.waitForFunction(
      () => {
        const status = document.getElementById('status');
        return status && status.textContent.includes('Organized');
      },
      { timeout: 10000 }
    );

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Click Protect Group
    await popupPage.click('#protectGroupBtn');
    await popupPage.waitForSelector('#protectGroupSelector', { visible: true });

    // Verify selector is visible
    const selectorVisible = await popupPage.evaluate(() => {
      return document.getElementById('protectGroupSelector').style.display === 'block';
    });
    expect(selectorVisible).toBe(true);

    // Click Cancel
    console.log('Clicking Cancel button...');
    await popupPage.click('#cancelProtectBtn');

    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify selector is hidden and main buttons are visible
    const afterCancel = await popupPage.evaluate(() => {
      return {
        selectorDisplay: document.getElementById('protectGroupSelector').style.display,
        mainButtonDisplay: document.getElementById('organizeBtn').style.display
      };
    });

    console.log('After cancel:', afterCancel);
    expect(afterCancel.selectorDisplay).toBe('none');
    expect(afterCancel.mainButtonDisplay).toBe('block');

    // Verify no bookmarks were created
    const bookmarkFolders = await serviceWorker.evaluate(async () => {
      const tree = await chrome.bookmarks.getTree();
      const otherBookmarks = tree[0].children.find(c => c.title === 'Other Bookmarks');
      if (!otherBookmarks || !otherBookmarks.children) return [];
      return otherBookmarks.children.filter(c => c.title.startsWith('🔒'));
    });

    expect(bookmarkFolders.length).toBe(0);

    console.log('✅ Cancel protect selection test passed!');

    await popupPage.close();
  }, 60000);
});
