/**
 * E2E Test: Combine Groups Feature
 *
 * Tests the combine groups functionality:
 * - Creates multiple tab groups
 * - Combines source group(s) into a target group
 * - Verifies tabs are moved and source groups dissolve
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
  ],
  stackoverflow: [
    'https://stackoverflow.com/questions/tagged/javascript',
    'https://stackoverflow.com/questions/tagged/react'
  ]
};

describe('Combine Groups Feature', () => {
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

  test('should combine two groups into one', async () => {
    console.log('=== Test: Combine Two Groups ===');

    // Get fresh service worker
    serviceWorker = await getServiceWorker();

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
    const googleGroup = initialGroups.find(g => g.title.includes('google.com'));
    expect(githubGroup).toBeDefined();
    expect(googleGroup).toBeDefined();

    // Step 3: Click "Combine Groups" button
    console.log('Clicking Combine Groups button...');
    await popupPage.click('#combineGroupsBtn');

    await popupPage.waitForSelector('#combineGroupsSelector', { visible: true });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 4: Verify group selectors are populated
    const sourceOptions = await popupPage.evaluate(() => {
      const select = document.getElementById('sourceGroupSelect');
      return Array.from(select.options).map(o => ({ value: o.value, text: o.textContent }));
    });

    console.log('Source group options:', sourceOptions);
    expect(sourceOptions.length).toBe(2);

    const targetOptions = await popupPage.evaluate(() => {
      const select = document.getElementById('targetGroupSelect');
      return Array.from(select.options).map(o => ({ value: o.value, text: o.textContent }));
    });

    console.log('Target group options:', targetOptions);
    // Target should exclude the selected source (first option selected by default)
    expect(targetOptions.length).toBe(1);

    // Step 5: Select Google group as source and GitHub as target
    console.log('Selecting source group (Google)...');
    await popupPage.select('#sourceGroupSelect', String(googleGroup.id));

    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify target options updated to exclude selected source
    const updatedTargetOptions = await popupPage.evaluate(() => {
      const select = document.getElementById('targetGroupSelect');
      return Array.from(select.options).map(o => ({ value: o.value, text: o.textContent }));
    });

    console.log('Updated target options after source selection:', updatedTargetOptions);
    expect(updatedTargetOptions.length).toBe(1);
    expect(updatedTargetOptions[0].text).toContain('github.com');

    // Step 6: Click Combine
    console.log('Clicking Combine button...');
    await popupPage.click('#combineSelectedBtn');

    // Wait for status to show success
    await popupPage.waitForFunction(
      () => {
        const status = document.getElementById('status');
        return status && (status.textContent.includes('Merged') || status.textContent.includes('Error'));
      },
      { timeout: 10000 }
    );

    const statusMessage = await popupPage.evaluate(() => {
      return document.getElementById('status').textContent;
    });

    console.log('Status message:', statusMessage);

    // Check for error
    if (statusMessage.includes('Error')) {
      console.log('ERROR: Combine failed with:', statusMessage);
    }

    expect(statusMessage).toContain('Merged');
    expect(statusMessage).toContain('github.com');

    // Step 7: Verify only one group remains
    const finalGroups = await serviceWorker.evaluate(async () => {
      const groups = await chrome.tabGroups.query({});
      return groups.map(g => ({ id: g.id, title: g.title }));
    });

    console.log('Final groups:', finalGroups);
    expect(finalGroups.length).toBe(1);
    expect(finalGroups[0].title).toContain('github.com');
    expect(finalGroups[0].title).toContain('5'); // 3 github + 2 google tabs

    console.log('✅ Combine two groups test passed!');

    await popupPage.close();
  }, 90000);

  test('should combine multiple source groups into target', async () => {
    console.log('=== Test: Combine Multiple Source Groups ===');

    // Get fresh service worker
    serviceWorker = await getServiceWorker();

    // Step 1: Open tabs from 3 domains
    console.log('Opening test tabs from 3 domains...');

    const allUrls = [...TEST_URLS.github, ...TEST_URLS.google, ...TEST_URLS.stackoverflow];

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

    // Verify 3 groups were created
    const initialGroups = await serviceWorker.evaluate(async () => {
      const groups = await chrome.tabGroups.query({});
      return groups.map(g => ({ id: g.id, title: g.title }));
    });

    console.log('Groups created:', initialGroups);
    expect(initialGroups.length).toBe(3);

    const githubGroup = initialGroups.find(g => g.title.includes('github.com'));
    const googleGroup = initialGroups.find(g => g.title.includes('google.com'));
    const stackGroup = initialGroups.find(g => g.title.includes('stackoverflow.com'));
    expect(githubGroup).toBeDefined();
    expect(googleGroup).toBeDefined();
    expect(stackGroup).toBeDefined();

    // Step 3: Click "Combine Groups" button
    console.log('Clicking Combine Groups button...');
    await popupPage.click('#combineGroupsBtn');

    await popupPage.waitForSelector('#combineGroupsSelector', { visible: true });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 4: Multi-select Google and StackOverflow as source groups
    console.log('Multi-selecting source groups (Google + StackOverflow)...');

    // Clear existing selection and select both groups
    await popupPage.evaluate((googleId, stackId) => {
      const select = document.getElementById('sourceGroupSelect');
      // Deselect all first
      Array.from(select.options).forEach(opt => opt.selected = false);
      // Select both google and stackoverflow
      Array.from(select.options).forEach(opt => {
        if (opt.value === String(googleId) || opt.value === String(stackId)) {
          opt.selected = true;
        }
      });
      // Trigger change event
      select.dispatchEvent(new Event('change'));
    }, googleGroup.id, stackGroup.id);

    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify target options updated to exclude both selected sources
    const targetOptions = await popupPage.evaluate(() => {
      const select = document.getElementById('targetGroupSelect');
      return Array.from(select.options).map(o => ({ value: o.value, text: o.textContent }));
    });

    console.log('Target options after multi-select:', targetOptions);
    expect(targetOptions.length).toBe(1);
    expect(targetOptions[0].text).toContain('github.com');

    // Step 5: Click Combine
    console.log('Clicking Combine button...');
    await popupPage.click('#combineSelectedBtn');

    // Wait for status to show success
    await popupPage.waitForFunction(
      () => {
        const status = document.getElementById('status');
        return status && (status.textContent.includes('Merged') || status.textContent.includes('Error'));
      },
      { timeout: 10000 }
    );

    const statusMessage = await popupPage.evaluate(() => {
      return document.getElementById('status').textContent;
    });

    console.log('Status message:', statusMessage);

    // Check for error
    if (statusMessage.includes('Error')) {
      console.log('ERROR: Combine failed with:', statusMessage);
    }

    expect(statusMessage).toContain('Merged');
    expect(statusMessage).toContain('2 group(s)'); // Combined 2 source groups
    expect(statusMessage).toContain('4 tabs'); // 2 google + 2 stackoverflow tabs
    expect(statusMessage).toContain('github.com');

    // Step 6: Verify only one group remains
    const finalGroups = await serviceWorker.evaluate(async () => {
      const groups = await chrome.tabGroups.query({});
      return groups.map(g => ({ id: g.id, title: g.title }));
    });

    console.log('Final groups:', finalGroups);
    expect(finalGroups.length).toBe(1);
    expect(finalGroups[0].title).toContain('github.com');
    expect(finalGroups[0].title).toContain('7'); // 3 github + 2 google + 2 stackoverflow

    console.log('✅ Combine multiple source groups test passed!');

    await popupPage.close();
  }, 90000);

  test('should show error when less than 2 groups exist', async () => {
    console.log('=== Test: Need At Least 2 Groups ===');

    // Get fresh service worker
    serviceWorker = await getServiceWorker();

    // Only create 1 group
    console.log('Opening tabs for a single group...');

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

    await new Promise(resolve => setTimeout(resolve, 500));

    // Click Combine Groups
    await popupPage.click('#combineGroupsBtn');

    // Wait for status message
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
    expect(statusMessage).toBe('Need at least 2 groups to combine');

    console.log('✅ Need at least 2 groups error test passed!');

    await popupPage.close();
  }, 60000);

  test('should cancel combine group selection', async () => {
    console.log('=== Test: Cancel Combine Selection ===');

    // Get fresh service worker
    serviceWorker = await getServiceWorker();

    // Create 2 groups
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

    // Click Combine Groups
    await popupPage.click('#combineGroupsBtn');
    await popupPage.waitForSelector('#combineGroupsSelector', { visible: true });

    // Verify selector is visible
    const selectorVisible = await popupPage.evaluate(() => {
      return document.getElementById('combineGroupsSelector').style.display === 'block';
    });
    expect(selectorVisible).toBe(true);

    // Click Cancel
    console.log('Clicking Cancel button...');
    await popupPage.click('#cancelCombineBtn');

    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify selector is hidden and main buttons are visible
    const afterCancel = await popupPage.evaluate(() => {
      return {
        selectorDisplay: document.getElementById('combineGroupsSelector').style.display,
        mainButtonDisplay: document.getElementById('organizeBtn').style.display
      };
    });

    console.log('After cancel:', afterCancel);
    expect(afterCancel.selectorDisplay).toBe('none');
    expect(afterCancel.mainButtonDisplay).toBe('block');

    // Verify groups are unchanged
    const groups = await serviceWorker.evaluate(async () => {
      return await chrome.tabGroups.query({});
    });

    expect(groups.length).toBe(2);

    console.log('✅ Cancel combine selection test passed!');

    await popupPage.close();
  }, 60000);
});
