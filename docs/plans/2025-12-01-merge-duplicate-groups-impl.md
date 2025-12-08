# Merge Duplicate Groups Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add feature-flagged ability to merge duplicate tab groups (groups with the same base name).

**Architecture:** New `mergeDuplicateGroups.js` module that finds groups with matching base names and consolidates them. Protected groups can absorb but never dissolve. Feature gated by options page toggle that shows/hides Advanced section in popup.

**Tech Stack:** JavaScript, Chrome Extension APIs (tabs, tabGroups, storage), Jest for testing

---

## Task 1: Create mergeDuplicateGroups Core Module

**Files:**
- Create: `chrome-extension/src/background/mergeDuplicateGroups.js`
- Create: `chrome-extension/src/background/mergeDuplicateGroups.test.js`

**Step 1: Write the failing test for basic duplicate detection and merging**

```javascript
// chrome-extension/src/background/mergeDuplicateGroups.test.js

// Mock Chrome API
global.chrome = {
  tabs: {
    query: jest.fn(),
    group: jest.fn(),
  },
  tabGroups: {
    query: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
  },
  storage: {
    local: {
      get: jest.fn(),
    },
  },
  windows: {
    WINDOW_ID_CURRENT: -2,
  },
};

const { mergeDuplicateGroups } = require('./mergeDuplicateGroups');

describe('mergeDuplicateGroups', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no protected groups
    chrome.storage.local.get.mockResolvedValue({ protectedGroups: {} });
  });

  describe('Basic Merging', () => {
    test('should merge smaller duplicate group into larger one', async () => {
      // Two github.com groups: one with 10 tabs, one with 5 tabs
      const groups = [
        { id: 1, title: 'github.com (10)', windowId: -2 },
        { id: 2, title: 'github.com (5)', windowId: -2 },
      ];
      const group1Tabs = Array.from({ length: 10 }, (_, i) => ({ id: 100 + i, groupId: 1 }));
      const group2Tabs = Array.from({ length: 5 }, (_, i) => ({ id: 200 + i, groupId: 2 }));

      chrome.tabGroups.query.mockResolvedValue(groups);
      chrome.tabs.query
        .mockResolvedValueOnce(group1Tabs)  // tabs for group 1
        .mockResolvedValueOnce(group2Tabs); // tabs for group 2
      chrome.tabs.group.mockResolvedValue(1);
      chrome.tabGroups.update.mockResolvedValue(groups[0]);

      const result = await mergeDuplicateGroups();

      expect(chrome.tabs.group).toHaveBeenCalledWith({
        tabIds: [200, 201, 202, 203, 204],
        groupId: 1,
      });
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(1, {
        title: 'github.com (15)',
      });
      expect(result.mergedGroups).toBe(1);
      expect(result.tabsMoved).toBe(5);
    });

    test('should not merge groups with different base names', async () => {
      const groups = [
        { id: 1, title: 'github.com (10)', windowId: -2 },
        { id: 2, title: 'gitlab.com (5)', windowId: -2 },
      ];

      chrome.tabGroups.query.mockResolvedValue(groups);

      const result = await mergeDuplicateGroups();

      expect(chrome.tabs.group).not.toHaveBeenCalled();
      expect(result.mergedGroups).toBe(0);
      expect(result.tabsMoved).toBe(0);
    });

    test('should skip groups with only numeric names', async () => {
      const groups = [
        { id: 1, title: '5', windowId: -2 },
        { id: 2, title: '5', windowId: -2 },
      ];

      chrome.tabGroups.query.mockResolvedValue(groups);

      const result = await mergeDuplicateGroups();

      expect(chrome.tabs.group).not.toHaveBeenCalled();
      expect(result.mergedGroups).toBe(0);
    });

    test('should skip groups with empty names', async () => {
      const groups = [
        { id: 1, title: '', windowId: -2 },
        { id: 2, title: '', windowId: -2 },
      ];

      chrome.tabGroups.query.mockResolvedValue(groups);

      const result = await mergeDuplicateGroups();

      expect(chrome.tabs.group).not.toHaveBeenCalled();
      expect(result.mergedGroups).toBe(0);
    });
  });

  describe('Protected Groups', () => {
    test('should merge into protected group even if it is smaller', async () => {
      const groups = [
        { id: 1, title: 'github.com (10)', windowId: -2 },
        { id: 2, title: 'github.com (5)', windowId: -2 },
      ];
      const group1Tabs = Array.from({ length: 10 }, (_, i) => ({ id: 100 + i, groupId: 1 }));
      const group2Tabs = Array.from({ length: 5 }, (_, i) => ({ id: 200 + i, groupId: 2 }));

      // Group 2 (smaller) is protected
      chrome.storage.local.get.mockResolvedValue({
        protectedGroups: { 2: { groupTitle: 'github.com' } }
      });

      chrome.tabGroups.query.mockResolvedValue(groups);
      chrome.tabs.query
        .mockResolvedValueOnce(group1Tabs)
        .mockResolvedValueOnce(group2Tabs);
      chrome.tabs.group.mockResolvedValue(2);
      chrome.tabGroups.update.mockResolvedValue(groups[1]);

      const result = await mergeDuplicateGroups();

      // Should merge group 1 INTO group 2 (protected), not the other way around
      expect(chrome.tabs.group).toHaveBeenCalledWith({
        tabIds: [100, 101, 102, 103, 104, 105, 106, 107, 108, 109],
        groupId: 2,
      });
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(2, {
        title: 'github.com (15)',
      });
    });

    test('should skip merging when multiple duplicates are protected', async () => {
      const groups = [
        { id: 1, title: 'github.com (10)', windowId: -2 },
        { id: 2, title: 'github.com (5)', windowId: -2 },
      ];

      // Both are protected
      chrome.storage.local.get.mockResolvedValue({
        protectedGroups: {
          1: { groupTitle: 'github.com' },
          2: { groupTitle: 'github.com' }
        }
      });

      chrome.tabGroups.query.mockResolvedValue(groups);

      const result = await mergeDuplicateGroups();

      expect(chrome.tabs.group).not.toHaveBeenCalled();
      expect(result.mergedGroups).toBe(0);
      expect(result.skippedProtected).toBe(1);
    });
  });

  describe('Multiple Duplicate Sets', () => {
    test('should handle multiple sets of duplicates', async () => {
      const groups = [
        { id: 1, title: 'github.com (10)', windowId: -2 },
        { id: 2, title: 'github.com (5)', windowId: -2 },
        { id: 3, title: 'gitlab.com (8)', windowId: -2 },
        { id: 4, title: 'gitlab.com (3)', windowId: -2 },
      ];

      chrome.tabGroups.query.mockResolvedValue(groups);
      chrome.tabs.query
        .mockResolvedValueOnce(Array.from({ length: 10 }, (_, i) => ({ id: 100 + i, groupId: 1 })))
        .mockResolvedValueOnce(Array.from({ length: 5 }, (_, i) => ({ id: 200 + i, groupId: 2 })))
        .mockResolvedValueOnce(Array.from({ length: 8 }, (_, i) => ({ id: 300 + i, groupId: 3 })))
        .mockResolvedValueOnce(Array.from({ length: 3 }, (_, i) => ({ id: 400 + i, groupId: 4 })));
      chrome.tabs.group.mockResolvedValue(1);
      chrome.tabGroups.update.mockResolvedValue({});

      const result = await mergeDuplicateGroups();

      expect(result.mergedGroups).toBe(2);
      expect(result.tabsMoved).toBe(8); // 5 from github + 3 from gitlab
    });
  });

  describe('Edge Cases', () => {
    test('should return message when no duplicates found', async () => {
      const groups = [
        { id: 1, title: 'github.com (10)', windowId: -2 },
        { id: 2, title: 'gitlab.com (5)', windowId: -2 },
      ];

      chrome.tabGroups.query.mockResolvedValue(groups);

      const result = await mergeDuplicateGroups();

      expect(result.message).toBe('No duplicate groups to merge');
    });

    test('should handle groups with no tabs gracefully', async () => {
      const groups = [
        { id: 1, title: 'github.com (10)', windowId: -2 },
        { id: 2, title: 'github.com (0)', windowId: -2 },
      ];

      chrome.tabGroups.query.mockResolvedValue(groups);
      chrome.tabs.query
        .mockResolvedValueOnce(Array.from({ length: 10 }, (_, i) => ({ id: 100 + i, groupId: 1 })))
        .mockResolvedValueOnce([]); // Empty group

      const result = await mergeDuplicateGroups();

      // Should not attempt to merge empty group
      expect(chrome.tabs.group).not.toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd chrome-extension && npm test -- mergeDuplicateGroups.test.js`
Expected: FAIL with "Cannot find module './mergeDuplicateGroups'"

**Step 3: Write minimal implementation**

```javascript
// chrome-extension/src/background/mergeDuplicateGroups.js

// ABOUTME: Merges duplicate tab groups with the same base name.
// ABOUTME: Respects protected groups - they can absorb but never dissolve.

import { extractGroupBaseName } from '../utils/extractGroupBaseName.js';
import { getProtectedGroupsFromStorage } from './protectGroup.js';

/**
 * Checks if a group name is valid for merging (not just numbers or empty)
 * @param {string} name - The base name to check
 * @returns {boolean} True if valid for merging
 */
function isValidGroupName(name) {
  if (!name || name.trim() === '') return false;
  // Skip groups that are just numbers
  if (/^\d+$/.test(name.trim())) return false;
  return true;
}

/**
 * Merges duplicate tab groups by moving tabs from smaller groups into larger ones.
 * @returns {Promise<{mergedGroups: number, tabsMoved: number, skippedProtected: number, message: string}>}
 */
async function mergeDuplicateGroups() {
  // Get all groups in current window
  const allGroups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });

  // Get protected groups
  const protectedGroups = await getProtectedGroupsFromStorage();
  const protectedGroupIds = new Set(Object.keys(protectedGroups).map(id => parseInt(id)));

  // Group by base name
  const groupsByBaseName = new Map();

  for (const group of allGroups) {
    const baseName = extractGroupBaseName(group.title);

    if (!isValidGroupName(baseName)) {
      continue;
    }

    if (!groupsByBaseName.has(baseName)) {
      groupsByBaseName.set(baseName, []);
    }
    groupsByBaseName.get(baseName).push(group);
  }

  let mergedGroups = 0;
  let tabsMoved = 0;
  let skippedProtected = 0;

  // Process each set of duplicates
  for (const [baseName, groups] of groupsByBaseName) {
    if (groups.length < 2) continue; // No duplicates

    // Get tab counts for each group
    const groupsWithTabs = await Promise.all(
      groups.map(async (group) => {
        const tabs = await chrome.tabs.query({ groupId: group.id });
        return { group, tabs, tabCount: tabs.length };
      })
    );

    // Filter out empty groups
    const nonEmptyGroups = groupsWithTabs.filter(g => g.tabCount > 0);
    if (nonEmptyGroups.length < 2) continue;

    // Check protection status
    const protectedInSet = nonEmptyGroups.filter(g => protectedGroupIds.has(g.group.id));

    if (protectedInSet.length > 1) {
      // Multiple protected duplicates - skip this set
      skippedProtected++;
      continue;
    }

    // Determine target group:
    // - If one is protected, it becomes the target
    // - Otherwise, largest becomes target
    let targetGroupData;
    let sourceGroupsData;

    if (protectedInSet.length === 1) {
      targetGroupData = protectedInSet[0];
      sourceGroupsData = nonEmptyGroups.filter(g => g.group.id !== targetGroupData.group.id);
    } else {
      // Sort by tab count descending, largest first
      nonEmptyGroups.sort((a, b) => b.tabCount - a.tabCount);
      targetGroupData = nonEmptyGroups[0];
      sourceGroupsData = nonEmptyGroups.slice(1);
    }

    // Merge all source groups into target
    const allSourceTabIds = sourceGroupsData.flatMap(g => g.tabs.map(t => t.id));

    if (allSourceTabIds.length === 0) continue;

    await chrome.tabs.group({ tabIds: allSourceTabIds, groupId: targetGroupData.group.id });

    // Update target group title with new count
    const newTabCount = targetGroupData.tabCount + allSourceTabIds.length;
    await chrome.tabGroups.update(targetGroupData.group.id, {
      title: `${baseName} (${newTabCount})`
    });

    mergedGroups += sourceGroupsData.length;
    tabsMoved += allSourceTabIds.length;
  }

  return {
    mergedGroups,
    tabsMoved,
    skippedProtected,
    message: mergedGroups === 0 ? 'No duplicate groups to merge' : `Merged ${mergedGroups} groups (${tabsMoved} tabs moved)`
  };
}

export { mergeDuplicateGroups, isValidGroupName };
```

**Step 4: Run test to verify it passes**

Run: `cd chrome-extension && npm test -- mergeDuplicateGroups.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add chrome-extension/src/background/mergeDuplicateGroups.js chrome-extension/src/background/mergeDuplicateGroups.test.js
git commit -m "feat: add mergeDuplicateGroups core module

Consolidates duplicate tab groups by base name.
Largest group absorbs smaller ones.
Protected groups can absorb but never dissolve."
```

---

## Task 2: Add Message Handler in background.js

**Files:**
- Modify: `chrome-extension/src/background/background.js`

**Step 1: Write the failing test**

The existing `background.test.js` should be extended. For simplicity, we'll verify by integration.

**Step 2: Add the import and message handler**

```javascript
// At top of background.js, add import:
import { mergeDuplicateGroups } from './mergeDuplicateGroups.js';

// Inside the chrome.runtime.onMessage.addListener callback, add:
  if (request.action === 'mergeDuplicateGroups') {
    mergeDuplicateGroups()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
```

**Step 3: Run all tests to verify nothing broke**

Run: `cd chrome-extension && npm test`
Expected: PASS

**Step 4: Commit**

```bash
git add chrome-extension/src/background/background.js
git commit -m "feat: add mergeDuplicateGroups message handler"
```

---

## Task 3: Add Settings Storage Keys

**Files:**
- Modify: `chrome-extension/src/options/options.js`
- Modify: `chrome-extension/src/options/options.html`

**Step 1: Add settings section to options.html**

Add before the footer in `options.html`:

```html
  <div class="settings-section">
    <h2>Advanced Features</h2>
    <div class="setting-item">
      <label class="toggle-label">
        <input type="checkbox" id="advancedFeaturesEnabled">
        Enable Advanced Features
      </label>
      <small>Shows additional tools for power users in the popup</small>
    </div>
    <div class="setting-item sub-setting" id="autoMergeSettingContainer" style="display: none;">
      <label class="toggle-label">
        <input type="checkbox" id="autoMergeDuplicates">
        Auto-merge duplicate groups during organize
      </label>
      <small>Automatically consolidates groups with the same name before organizing</small>
    </div>
  </div>
```

Add CSS for settings section:

```css
    .settings-section {
      background: white;
      border: 1px solid #e8eaed;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }

    .settings-section h2 {
      font-size: 16px;
      margin: 0 0 16px 0;
    }

    .setting-item {
      margin-bottom: 12px;
    }

    .setting-item small {
      display: block;
      margin-top: 4px;
      margin-left: 24px;
      color: #5f6368;
      font-size: 12px;
    }

    .sub-setting {
      margin-left: 24px;
      padding-left: 12px;
      border-left: 2px solid #e8eaed;
    }
```

**Step 2: Add settings logic to options.js**

Add at the end of `options.js`:

```javascript
// Advanced Features Settings
const advancedFeaturesCheckbox = document.getElementById('advancedFeaturesEnabled');
const autoMergeCheckbox = document.getElementById('autoMergeDuplicates');
const autoMergeContainer = document.getElementById('autoMergeSettingContainer');

async function loadAdvancedSettings() {
  const result = await chrome.storage.local.get(['advancedFeaturesEnabled', 'autoMergeDuplicates']);
  advancedFeaturesCheckbox.checked = result.advancedFeaturesEnabled || false;
  autoMergeCheckbox.checked = result.autoMergeDuplicates || false;
  autoMergeContainer.style.display = advancedFeaturesCheckbox.checked ? 'block' : 'none';
}

advancedFeaturesCheckbox.addEventListener('change', async () => {
  await chrome.storage.local.set({ advancedFeaturesEnabled: advancedFeaturesCheckbox.checked });
  autoMergeContainer.style.display = advancedFeaturesCheckbox.checked ? 'block' : 'none';
  if (!advancedFeaturesCheckbox.checked) {
    autoMergeCheckbox.checked = false;
    await chrome.storage.local.set({ autoMergeDuplicates: false });
  }
  showStatus('Settings saved!', 'success');
});

autoMergeCheckbox.addEventListener('change', async () => {
  await chrome.storage.local.set({ autoMergeDuplicates: autoMergeCheckbox.checked });
  showStatus('Settings saved!', 'success');
});

// Load settings on page load
loadAdvancedSettings();
```

**Step 3: Run tests and manually verify**

Run: `cd chrome-extension && npm test`
Then manually test: Go to options page, toggle settings, verify they persist.

**Step 4: Commit**

```bash
git add chrome-extension/src/options/options.html chrome-extension/src/options/options.js
git commit -m "feat: add advanced features settings to options page

Adds toggles for:
- Enable Advanced Features (shows/hides advanced section in popup)
- Auto-merge duplicate groups during organize"
```

---

## Task 4: Add Advanced Section to Popup UI

**Files:**
- Modify: `chrome-extension/src/popup/popup.html`
- Modify: `chrome-extension/src/popup/popup.js`

**Step 1: Add Advanced section HTML**

Add before the footer in `popup.html`:

```html
  <div id="advancedSection" class="advanced-section" style="display: none;">
    <div class="section-divider">Advanced</div>
    <button id="mergeDuplicatesBtn" class="secondary">
      Merge Duplicate Groups
    </button>
  </div>
```

Add CSS:

```css
    .advanced-section {
      margin-top: 16px;
      padding-top: 12px;
    }

    .section-divider {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-secondary);
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border-color);
    }
```

**Step 2: Add popup.js logic for Advanced section**

Add to `popup.js`:

```javascript
const advancedSection = document.getElementById('advancedSection');
const mergeDuplicatesBtn = document.getElementById('mergeDuplicatesBtn');

// Check if advanced features are enabled and show/hide section
async function initAdvancedSection() {
  const result = await chrome.storage.local.get('advancedFeaturesEnabled');
  if (result.advancedFeaturesEnabled) {
    advancedSection.style.display = 'block';
  }
}

mergeDuplicatesBtn.addEventListener('click', async () => {
  mergeDuplicatesBtn.disabled = true;
  mergeDuplicatesBtn.textContent = 'Merging...';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'mergeDuplicateGroups'
    });

    if (response.error) {
      showStatus(`Error: ${response.error}`, 'error');
    } else if (response.mergedGroups === 0) {
      showStatus('No duplicate groups to merge', 'success');
    } else {
      let message = `✓ Merged ${response.mergedGroups} groups (${response.tabsMoved} tabs moved)`;
      if (response.skippedProtected > 0) {
        message += ` (${response.skippedProtected} protected sets skipped)`;
      }
      showStatus(message, 'success');
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    mergeDuplicatesBtn.disabled = false;
    mergeDuplicatesBtn.textContent = 'Merge Duplicate Groups';
  }
});

// Initialize
initAdvancedSection();
```

**Step 3: Update mainButtonsSelector to include advanced section button**

Update the selector in `popup.js`:

```javascript
const mainButtonsSelector = '#organizeBtn, #organizeCategoryBtn, #organizeAllWindowsBtn, #organizeAllWindowsCategoryBtn, #dedupeBtn, #saveBookmarksBtn, #restoreBookmarksBtn, #combineGroupsBtn, #protectGroupBtn, #removeGroupsBtn, #mergeDuplicatesBtn';
```

**Step 4: Run tests and manually verify**

Run: `cd chrome-extension && npm test`
Manually test: Enable advanced features in options, verify button appears in popup.

**Step 5: Commit**

```bash
git add chrome-extension/src/popup/popup.html chrome-extension/src/popup/popup.js
git commit -m "feat: add Merge Duplicate Groups button to popup

Shows in Advanced section when advanced features enabled.
Displays merge results including tabs moved and protected groups skipped."
```

---

## Task 5: Integrate Auto-Merge into organizeTabs

**Files:**
- Modify: `chrome-extension/src/background/organizeTabs.js`
- Modify: `chrome-extension/src/background/organizeTabs.test.js`

**Step 1: Write failing test for auto-merge behavior**

Add to `organizeTabs.test.js`:

```javascript
describe('Auto-merge duplicate groups', () => {
  test('should merge duplicates before organizing when autoMergeDuplicates is enabled', async () => {
    chrome.storage.local.get.mockResolvedValue({ autoMergeDuplicates: true });
    // ... setup duplicate groups scenario
    // Verify mergeDuplicateGroups is called before organization
  });

  test('should not merge duplicates when autoMergeDuplicates is disabled', async () => {
    chrome.storage.local.get.mockResolvedValue({ autoMergeDuplicates: false });
    // ... verify mergeDuplicateGroups is not called
  });
});
```

**Step 2: Add auto-merge logic to organizeTabs**

At the start of `organizeTabs` function, add:

```javascript
import { mergeDuplicateGroups } from './mergeDuplicateGroups.js';

async function organizeTabs(mode = 'domain', allWindows = false) {
  console.log(`Organizing tabs by ${mode}${allWindows ? ' across all windows' : ''}...`);

  // Check if auto-merge is enabled
  let mergeResult = null;
  const settings = await chrome.storage.local.get('autoMergeDuplicates');
  if (settings.autoMergeDuplicates) {
    console.log('Auto-merging duplicate groups before organizing...');
    mergeResult = await mergeDuplicateGroups();
    console.log(`Auto-merge result: ${mergeResult.message}`);
  }

  // ... rest of existing code
```

Update the return statement to include merge info:

```javascript
  return {
    totalTabs: tabs.length,
    groupedTabs: groupedCount,
    groups: sortedGroups.length,
    groupsCreated: groupsCreated,
    groupsUpdated: groupsUpdated,
    ungroupedTabs: tabs.length - groupedCount,
    duplicatesClosed: duplicatesClosed,
    tabsMoved: tabsMoved,
    ungroupedDuplicates: ungroupedDuplicates,
    ungroupedTabsMoved: ungroupedTabsMoved,
    // New: auto-merge results
    duplicateGroupsMerged: mergeResult?.mergedGroups || 0,
    tabsMovedFromMerge: mergeResult?.tabsMoved || 0
  };
```

**Step 3: Run tests**

Run: `cd chrome-extension && npm test`
Expected: PASS

**Step 4: Update popup.js to show merge info in organize result**

In the organize button handlers, add to the message:

```javascript
if (response.duplicateGroupsMerged > 0) {
  message += ` Merged ${response.duplicateGroupsMerged} duplicate groups.`;
}
```

**Step 5: Commit**

```bash
git add chrome-extension/src/background/organizeTabs.js chrome-extension/src/popup/popup.js
git commit -m "feat: add auto-merge duplicate groups during organize

When 'Auto-merge duplicate groups during organize' is enabled,
mergeDuplicateGroups runs before organization begins."
```

---

## Task 6: Add Unit Tests for Options Page Settings

**Files:**
- Modify: `chrome-extension/src/options/options.test.js`

**Step 1: Write tests for advanced settings**

Add to `options.test.js`:

```javascript
describe('Advanced Features Settings', () => {
  test('should load and display advanced features toggle state', async () => {
    chrome.storage.local.get.mockResolvedValue({ advancedFeaturesEnabled: true });
    // Simulate page load
    // Verify checkbox is checked
  });

  test('should show sub-toggle when advanced features enabled', async () => {
    chrome.storage.local.get.mockResolvedValue({ advancedFeaturesEnabled: true });
    // Verify autoMergeSettingContainer is visible
  });

  test('should hide sub-toggle when advanced features disabled', async () => {
    chrome.storage.local.get.mockResolvedValue({ advancedFeaturesEnabled: false });
    // Verify autoMergeSettingContainer is hidden
  });

  test('should save settings when toggled', async () => {
    // Simulate checkbox change
    // Verify chrome.storage.local.set was called
  });
});
```

**Step 2: Run tests**

Run: `cd chrome-extension && npm test -- options.test.js`
Expected: PASS

**Step 3: Commit**

```bash
git add chrome-extension/src/options/options.test.js
git commit -m "test: add unit tests for advanced features settings"
```

---

## Task 7: Add Unit Tests for Popup Advanced Section

**Files:**
- Modify: `chrome-extension/src/popup/popup.test.js`

**Step 1: Write tests for advanced section visibility**

Add to `popup.test.js`:

```javascript
describe('Advanced Section', () => {
  test('should show advanced section when advancedFeaturesEnabled is true', async () => {
    chrome.storage.local.get.mockResolvedValue({ advancedFeaturesEnabled: true });
    // Call initAdvancedSection
    // Verify advancedSection.style.display === 'block'
  });

  test('should hide advanced section when advancedFeaturesEnabled is false', async () => {
    chrome.storage.local.get.mockResolvedValue({ advancedFeaturesEnabled: false });
    // Call initAdvancedSection
    // Verify advancedSection.style.display === 'none'
  });

  test('should send mergeDuplicateGroups action when button clicked', async () => {
    // Simulate button click
    // Verify chrome.runtime.sendMessage called with { action: 'mergeDuplicateGroups' }
  });
});
```

**Step 2: Run tests**

Run: `cd chrome-extension && npm test -- popup.test.js`
Expected: PASS

**Step 3: Commit**

```bash
git add chrome-extension/src/popup/popup.test.js
git commit -m "test: add unit tests for popup advanced section"
```

---

## Task 8: Final Integration Test and Cleanup

**Files:**
- Review all modified files

**Step 1: Run full test suite**

Run: `cd chrome-extension && npm test`
Expected: All tests PASS

**Step 2: Run coverage report**

Run: `cd chrome-extension && npm run test:coverage`
Verify new code has adequate coverage.

**Step 3: Manual end-to-end testing**

1. Load extension in Chrome
2. Go to Options → Enable Advanced Features → Enable Auto-merge
3. Create duplicate tab groups manually (multiple github.com groups)
4. Click extension → Verify "Advanced" section visible
5. Click "Merge Duplicate Groups" → Verify groups merged
6. Create more duplicates
7. Click "Organize by Domain" → Verify auto-merge happened first

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete merge duplicate groups feature

Closes #50

Summary:
- New mergeDuplicateGroups module with full test coverage
- Feature-flagged behind 'Enable Advanced Features' toggle
- Manual merge via new button in popup Advanced section
- Optional auto-merge during organize operations
- Respects protected groups (can absorb but never dissolve)
- Skips groups with numeric-only names"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Core mergeDuplicateGroups module | mergeDuplicateGroups.js, .test.js |
| 2 | Message handler in background.js | background.js |
| 3 | Settings in options page | options.html, options.js |
| 4 | Advanced section in popup | popup.html, popup.js |
| 5 | Auto-merge integration in organizeTabs | organizeTabs.js |
| 6 | Options page tests | options.test.js |
| 7 | Popup tests | popup.test.js |
| 8 | Integration testing & cleanup | All |
