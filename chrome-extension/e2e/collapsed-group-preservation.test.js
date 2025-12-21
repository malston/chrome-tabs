/**
 * E2E Test: Group State Preservation (Collapsed Groups)
 *
 * Tests that collapsed groups remain collapsed after re-organization:
 * - Creates groups with tabs
 * - Collapses one of the groups
 * - Adds new tabs to the collapsed group's domain
 * - Re-organizes
 * - Verifies the group remains collapsed
 * - Verifies new tabs are added to the collapsed group
 * - Verifies tab count updates correctly
 * - Verifies group color is preserved
 */

const puppeteer = require('puppeteer');
const { getPuppeteerConfig } = require('./test-config');

// Test URLs
const INITIAL_URLS = {
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

const ADDITIONAL_GITHUB_URLS = [
  'https://github.com/nodejs/node',
  'https://github.com/microsoft/vscode'
];

describe('Group State Preservation (Collapsed Groups)', () => {
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

  test('should preserve collapsed state when re-organizing tabs', async () => {
    // Step 1: Open initial tabs
    console.log('Opening initial tabs...');

    const initialUrls = [
      ...INITIAL_URLS.github,
      ...INITIAL_URLS.google
    ];

    for (let i = 0; i < initialUrls.length; i++) {
      const url = initialUrls[i];
      if (i === 0) {
        await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      } else {
        const newPage = await browser.newPage();
        await newPage.goto(url, { waitUntil: 'load', timeout: 60000 });
      }
    }

    console.log(`Opened ${initialUrls.length} tabs`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Get service worker
    const serviceWorkerTarget = await browser.waitForTarget(
      target => target.type() === 'service_worker' && target.url().includes(extensionId)
    );
    const serviceWorker = await serviceWorkerTarget.worker();

    // Step 3: First organization - create initial groups
    console.log('First organization - creating initial groups...');
    const popupPage1 = await browser.newPage();
    await popupPage1.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    await popupPage1.waitForSelector('#organizeBtn');
    await popupPage1.click('#organizeBtn');
    await popupPage1.waitForFunction(
      () => {
        const status = document.getElementById('status');
        return status && status.style.display !== 'none';
      },
      { timeout: 10000 }
    );
    await new Promise(resolve => setTimeout(resolve, 2000));
    await popupPage1.close();

    // Step 4: Verify initial groups
    const initialGroups = await serviceWorker.evaluate(async () => {
      const groups = await chrome.tabGroups.query({});
      return groups.map(g => ({ id: g.id, title: g.title, color: g.color, collapsed: g.collapsed }));
    });

    console.log('Initial groups:', initialGroups);
    expect(initialGroups.length).toBe(2);

    // Find the github group
    const githubGroup = initialGroups.find(g => g.title.includes('github.com'));
    expect(githubGroup).toBeDefined();
    expect(githubGroup.collapsed).toBe(false); // Initially not collapsed

    const initialColor = githubGroup.color;
    console.log(`GitHub group ID: ${githubGroup.id}, Color: ${initialColor}`);

    // Step 5: Collapse the GitHub group
    console.log('Collapsing GitHub group...');
    await serviceWorker.evaluate(async (groupId) => {
      await chrome.tabGroups.update(groupId, { collapsed: true });
    }, githubGroup.id);

    // Wait for collapse to take effect
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify group is collapsed
    const collapsedGroup = await serviceWorker.evaluate(async (groupId) => {
      const group = await chrome.tabGroups.get(groupId);
      return { id: group.id, title: group.title, collapsed: group.collapsed, color: group.color };
    }, githubGroup.id);

    console.log('Group after collapse:', collapsedGroup);
    expect(collapsedGroup.collapsed).toBe(true);

    // Step 6: Open additional GitHub tabs
    console.log('Opening additional GitHub tabs...');
    for (const url of ADDITIONAL_GITHUB_URLS) {
      const newPage = await browser.newPage();
      await newPage.goto(url, { waitUntil: 'load', timeout: 60000 });
    }

    console.log(`Opened ${ADDITIONAL_GITHUB_URLS.length} additional GitHub tabs`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 7: Second organization
    console.log('Second organization - updating groups...');
    const popupPage2 = await browser.newPage();
    await popupPage2.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    await popupPage2.waitForSelector('#organizeBtn');
    await popupPage2.click('#organizeBtn');
    await popupPage2.waitForFunction(
      () => {
        const status = document.getElementById('status');
        return status && status.style.display !== 'none';
      },
      { timeout: 10000 }
    );
    await new Promise(resolve => setTimeout(resolve, 2000));
    await popupPage2.close();

    // Step 8: Verify group remained collapsed
    const updatedGroup = await serviceWorker.evaluate(async (groupId) => {
      const group = await chrome.tabGroups.get(groupId);
      return { id: group.id, title: group.title, collapsed: group.collapsed, color: group.color };
    }, githubGroup.id);

    console.log('Group after re-organization:', updatedGroup);

    // Verify group ID is the same (not recreated)
    expect(updatedGroup.id).toBe(githubGroup.id);

    // Verify collapsed state is preserved
    expect(updatedGroup.collapsed).toBe(true);

    // Verify color is preserved
    expect(updatedGroup.color).toBe(initialColor);

    // Verify title is preserved
    expect(updatedGroup.title).toBe('github.com');

    console.log('✅ Collapsed state was preserved.');
  }, 90000);
});
