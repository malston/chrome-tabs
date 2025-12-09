# Integrate Duplicate Removal into Organize Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the standalone "Remove Duplicates" button and integrate duplicate removal directly into organize operations.

**Architecture:** Before organizing tabs, detect and close ungrouped duplicates (tabs whose URL already exists in a group, or duplicate ungrouped tabs). Cross-group duplicates are preserved.

**Tech Stack:** JavaScript, Chrome Extension APIs (chrome.tabs, chrome.tabGroups)

---

## Task 1: Add Unit Tests for Duplicate Removal in organizeTabs

**Files:**
- Modify: `chrome-extension/src/background/organizeTabs.test.js`

**Step 1: Write failing test - ungrouped duplicate of grouped tab gets closed**

Add this test after the existing "Ungrouped Duplicates Detection" describe block (around line 1106):

```javascript
describe('Automatic Duplicate Removal', () => {
  test('should close ungrouped tab that duplicates a grouped tab', async () => {
    const mockTabs = [
      // Grouped tabs
      { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: 5, windowId: 1 },
      { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: 5, windowId: 1 },
      // Ungrouped duplicate of grouped tab - should be CLOSED
      { id: 3, url: 'https://github.com/repo1', title: 'Repo 1 Duplicate', groupId: -1, windowId: 1 }
    ];

    const mockGroups = [
      { id: 5, title: 'github.com (2)' }
    ];

    chrome.tabs.query.mockResolvedValue(mockTabs);
    chrome.tabGroups.query.mockResolvedValue(mockGroups);
    chrome.tabs.remove.mockResolvedValue(undefined);

    const result = await organizeTabs('domain', false);

    // Should have closed the ungrouped duplicate (tab 3)
    expect(chrome.tabs.remove).toHaveBeenCalledWith([3]);
    expect(result.duplicatesClosed).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/markalston/workspace/chrome-tabs/.worktrees/integrate-dedupe/chrome-extension && npm test -- --testPathPattern=organizeTabs.test.js --testNamePattern="should close ungrouped tab that duplicates a grouped tab"`

Expected: FAIL - current implementation doesn't call chrome.tabs.remove for single-window organize

**Step 3: Write failing test - multiple ungrouped duplicates**

Add after the previous test:

```javascript
  test('should close multiple ungrouped tabs with same URL, keeping first', async () => {
    const mockTabs = [
      // Three ungrouped tabs with same URL
      { id: 1, url: 'https://github.com/repo1', title: 'First', groupId: -1, windowId: 1 },
      { id: 2, url: 'https://github.com/repo1', title: 'Second', groupId: -1, windowId: 1 },
      { id: 3, url: 'https://github.com/repo1', title: 'Third', groupId: -1, windowId: 1 },
      // Another domain to form a group
      { id: 4, url: 'https://github.com/repo2', title: 'Repo 2', groupId: -1, windowId: 1 }
    ];

    chrome.tabs.query
      .mockResolvedValueOnce(mockTabs) // Initial query
      .mockResolvedValueOnce([mockTabs[0], mockTabs[3]]); // After removing duplicates
    chrome.tabGroups.query.mockResolvedValue([]);
    chrome.tabs.remove.mockResolvedValue(undefined);
    chrome.tabs.group.mockResolvedValue(1);

    const result = await organizeTabs('domain', false);

    // Should have closed tabs 2 and 3 (duplicates of tab 1)
    expect(chrome.tabs.remove).toHaveBeenCalledWith([2, 3]);
    expect(result.duplicatesClosed).toBe(2);
  });
```

**Step 4: Run test to verify it fails**

Run: `cd /Users/markalston/workspace/chrome-tabs/.worktrees/integrate-dedupe/chrome-extension && npm test -- --testPathPattern=organizeTabs.test.js --testNamePattern="should close multiple ungrouped tabs"`

Expected: FAIL

**Step 5: Write failing test - cross-group duplicates preserved**

Add after the previous test:

```javascript
  test('should preserve cross-group duplicates (same URL in different groups)', async () => {
    const mockTabs = [
      // Same URL in two different groups
      { id: 1, url: 'https://github.com/repo1', title: 'In Dev Group', groupId: 5, windowId: 1 },
      { id: 2, url: 'https://github.com/repo2', title: 'In Dev Group', groupId: 5, windowId: 1 },
      { id: 3, url: 'https://github.com/repo1', title: 'In Domain Group', groupId: 7, windowId: 1 },
      { id: 4, url: 'https://example.com/page', title: 'In Domain Group', groupId: 7, windowId: 1 }
    ];

    const mockGroups = [
      { id: 5, title: 'Development (2)' },
      { id: 7, title: 'github.com (2)' }
    ];

    chrome.tabs.query.mockResolvedValue(mockTabs);
    chrome.tabGroups.query.mockResolvedValue(mockGroups);

    const result = await organizeTabs('domain', false);

    // Should NOT close any tabs - cross-group duplicates are allowed
    expect(chrome.tabs.remove).not.toHaveBeenCalled();
    expect(result.duplicatesClosed).toBe(0);
  });
```

**Step 6: Run test to verify it passes (baseline)**

Run: `cd /Users/markalston/workspace/chrome-tabs/.worktrees/integrate-dedupe/chrome-extension && npm test -- --testPathPattern=organizeTabs.test.js --testNamePattern="should preserve cross-group duplicates"`

Expected: PASS (no removal happens currently)

**Step 7: Commit tests**

```bash
cd /Users/markalston/workspace/chrome-tabs/.worktrees/integrate-dedupe/chrome-extension
git add src/background/organizeTabs.test.js
git commit -m "$(cat <<'EOF'
test: Add failing tests for automatic duplicate removal

Tests for:
- Closing ungrouped duplicate of grouped tab
- Closing multiple ungrouped tabs with same URL
- Preserving cross-group duplicates
EOF
)"
```

---

## Task 2: Implement Duplicate Removal in organizeTabs (Single-Window)

**Files:**
- Modify: `chrome-extension/src/background/organizeTabs.js:11-79`

**Step 1: Add duplicate removal logic after auto-merge, before organizing**

In `organizeTabs.js`, replace lines 24-79 (after auto-merge, before `const currentWindow`) with:

```javascript
  // Get current window for reference
  const currentWindow = await chrome.windows.getCurrent();

  // Get all tabs - either from current window or all windows
  let tabs = await chrome.tabs.query(allWindows ? {} : { currentWindow: true });
  let duplicatesClosed = 0;
  let tabsMoved = 0;

  // If organizing across all windows, first remove duplicates and move all tabs to current window
  if (allWindows) {
    // First pass: identify grouped tabs (prioritized)
    const groupedUrls = new Map(); // url -> tab
    for (const tab of tabs) {
      if (shouldSkipUrl(tab.url)) continue;
      if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
        if (!groupedUrls.has(tab.url)) {
          groupedUrls.set(tab.url, tab);
        }
      }
    }

    // Second pass: find duplicates and tabs to move
    const seenUrls = new Map(); // url -> tab (first seen)
    const tabsToClose = [];
    const tabsToMove = [];

    for (const tab of tabs) {
      if (shouldSkipUrl(tab.url)) continue;

      // Check if this is a duplicate of a grouped tab
      if (groupedUrls.has(tab.url) && groupedUrls.get(tab.url).id !== tab.id) {
        tabsToClose.push(tab.id);
      } else if (seenUrls.has(tab.url)) {
        // Duplicate of another seen tab
        tabsToClose.push(tab.id);
      } else {
        seenUrls.set(tab.url, tab);
        // If tab is in a different window, mark for moving
        if (tab.windowId !== currentWindow.id) {
          tabsToMove.push(tab);
        }
      }
    }

    // Close duplicate tabs
    if (tabsToClose.length > 0) {
      await chrome.tabs.remove(tabsToClose);
      duplicatesClosed = tabsToClose.length;
    }

    // Move tabs from other windows to current window
    if (tabsToMove.length > 0) {
      for (const tab of tabsToMove) {
        try {
          await chrome.tabs.move(tab.id, { windowId: currentWindow.id, index: -1 });
          tabsMoved++;
        } catch (e) {
          console.error(`Error moving tab ${tab.id}:`, e);
        }
      }
    }

    // Re-query tabs in current window after moving
    tabs = await chrome.tabs.query({ currentWindow: true });
  } else {
    // Single-window mode: remove ungrouped duplicates
    // Step 1: Identify grouped tab URLs (these take priority)
    const groupedUrls = new Map(); // url -> tab
    for (const tab of tabs) {
      if (shouldSkipUrl(tab.url)) continue;
      if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
        if (!groupedUrls.has(tab.url)) {
          groupedUrls.set(tab.url, tab);
        }
      }
    }

    // Step 2: Find ungrouped duplicates to close
    const seenUngroupedUrls = new Map(); // url -> tab
    const tabsToClose = [];

    for (const tab of tabs) {
      if (shouldSkipUrl(tab.url)) continue;
      if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) continue; // Skip grouped tabs

      if (groupedUrls.has(tab.url)) {
        // Ungrouped duplicate of grouped tab - close it
        tabsToClose.push(tab.id);
      } else if (seenUngroupedUrls.has(tab.url)) {
        // Ungrouped duplicate of another ungrouped tab - close it
        tabsToClose.push(tab.id);
      } else {
        seenUngroupedUrls.set(tab.url, tab);
      }
    }

    // Step 3: Close duplicates
    if (tabsToClose.length > 0) {
      await chrome.tabs.remove(tabsToClose);
      duplicatesClosed = tabsToClose.length;
    }

    // Step 4: Re-query tabs after removing duplicates
    if (duplicatesClosed > 0) {
      tabs = await chrome.tabs.query({ currentWindow: true });
    }
  }
```

**Step 2: Remove the old ungrouped duplicates detection code**

Delete lines 81-111 (the old ungroupedDuplicates detection that just counted but didn't remove).

Also remove the `ungroupedDuplicates` and `ungroupedDuplicateUrls` variables and their usage in the grouping loop (lines 117-131) - we no longer need to skip ungrouped duplicates since we removed them.

**Step 3: Update the return value**

Change the return value to remove `ungroupedDuplicates` (line ~277):

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
    ungroupedTabsMoved: ungroupedTabsMoved,
    duplicateGroupsMerged: mergeResult?.mergedGroups || 0,
    tabsMovedFromMerge: mergeResult?.tabsMoved || 0,
    mergeErrors: mergeResult?.errors || 0
  };
```

**Step 4: Run tests to verify they pass**

Run: `cd /Users/markalston/workspace/chrome-tabs/.worktrees/integrate-dedupe/chrome-extension && npm test -- --testPathPattern=organizeTabs.test.js`

Expected: All new tests pass, some old "ungroupedDuplicates" tests may fail (update them next)

**Step 5: Update existing tests that check ungroupedDuplicates**

Update the tests in "Ungrouped Duplicates Detection" describe block to expect `duplicatesClosed` instead of `ungroupedDuplicates`, and verify tabs are actually removed.

**Step 6: Run all tests**

Run: `cd /Users/markalston/workspace/chrome-tabs/.worktrees/integrate-dedupe/chrome-extension && npm test`

Expected: All 260+ tests pass

**Step 7: Commit implementation**

```bash
cd /Users/markalston/workspace/chrome-tabs/.worktrees/integrate-dedupe/chrome-extension
git add src/background/organizeTabs.js src/background/organizeTabs.test.js
git commit -m "$(cat <<'EOF'
feat: Integrate duplicate removal into organize operations

- Close ungrouped tabs that duplicate grouped tabs
- Close duplicate ungrouped tabs (keep first)
- Preserve cross-group duplicates (intentional)
- Remove ungroupedDuplicates detection (now actually removes them)
EOF
)"
```

---

## Task 3: Remove the "Remove Duplicates" Button from UI

**Files:**
- Modify: `chrome-extension/src/popup/popup.html:286-288`

**Step 1: Remove the button from HTML**

Delete these lines from `popup.html`:

```html
  <button id="dedupeBtn" class="primary main-action-btn">
    Remove Duplicates
  </button>
```

**Step 2: Run tests to verify no breaking changes**

Run: `cd /Users/markalston/workspace/chrome-tabs/.worktrees/integrate-dedupe/chrome-extension && npm test`

Expected: popup.test.js may have tests that reference dedupeBtn - they'll fail

**Step 3: Commit UI change**

```bash
cd /Users/markalston/workspace/chrome-tabs/.worktrees/integrate-dedupe/chrome-extension
git add src/popup/popup.html
git commit -m "$(cat <<'EOF'
feat: Remove "Remove Duplicates" button from UI

Duplicate removal is now integrated into organize operations.
EOF
)"
```

---

## Task 4: Remove Button Handler from popup.js

**Files:**
- Modify: `chrome-extension/src/popup/popup.js:8,199-224`

**Step 1: Remove dedupeBtn element reference**

Delete line 8:
```javascript
const dedupeBtn = document.getElementById('dedupeBtn');
```

**Step 2: Remove the click handler**

Delete lines 199-224 (the entire `dedupeBtn.addEventListener` block).

**Step 3: Update status message handling for organize buttons**

In the organize button handlers (lines 41-75 for domain, 77-111 for category), update the status message to include duplicates closed:

For `organizeBtn` handler, update the message building (around line 54):
```javascript
      let message = `✓ Organized ${response.groupedTabs} tabs into ${response.groups} groups!`;
      if (response.duplicatesClosed > 0) {
        message += ` Removed ${response.duplicatesClosed} duplicate(s).`;
      }
      if (response.duplicateGroupsMerged > 0) {
        message += ` Merged ${response.duplicateGroupsMerged} duplicate groups.`;
      }
      // ... rest of message building
```

Remove the `ungroupedDuplicates` warning since we now remove them:
```javascript
      // DELETE this block:
      // if (response.ungroupedDuplicates > 0) {
      //   message += ` Warning: ${response.ungroupedDuplicates} ungrouped duplicate(s) found.`;
      // }
```

Apply same changes to:
- `organizeCategoryBtn` handler (lines 77-111)
- `organizeAllWindowsBtn` handler (lines 113-154) - already shows duplicatesClosed
- `organizeAllWindowsCategoryBtn` handler (lines 156-197) - already shows duplicatesClosed

**Step 4: Run tests**

Run: `cd /Users/markalston/workspace/chrome-tabs/.worktrees/integrate-dedupe/chrome-extension && npm test`

Expected: May need to update popup.test.js

**Step 5: Commit changes**

```bash
cd /Users/markalston/workspace/chrome-tabs/.worktrees/integrate-dedupe/chrome-extension
git add src/popup/popup.js
git commit -m "$(cat <<'EOF'
feat: Remove dedupe button handler, update status messages

- Remove dedupeBtn element and click handler
- Update organize handlers to show duplicatesClosed count
- Remove ungroupedDuplicates warning (now removed automatically)
EOF
)"
```

---

## Task 5: Remove Message Handler from background.js

**Files:**
- Modify: `chrome-extension/src/background/background.js:5,36-41`

**Step 1: Remove the import**

Delete line 5:
```javascript
import { removeDuplicateTabs } from './removeDuplicateTabs.js';
```

**Step 2: Remove the message handler**

Delete lines 36-41:
```javascript
  if (request.action === 'removeDuplicates') {
    removeDuplicateTabs()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
```

**Step 3: Run tests**

Run: `cd /Users/markalston/workspace/chrome-tabs/.worktrees/integrate-dedupe/chrome-extension && npm test`

Expected: Pass

**Step 4: Commit changes**

```bash
cd /Users/markalston/workspace/chrome-tabs/.worktrees/integrate-dedupe/chrome-extension
git add src/background/background.js
git commit -m "$(cat <<'EOF'
feat: Remove removeDuplicates message handler

Duplicate removal now happens within organizeTabs.
EOF
)"
```

---

## Task 6: Delete removeDuplicateTabs Module

**Files:**
- Delete: `chrome-extension/src/background/removeDuplicateTabs.js`
- Delete: `chrome-extension/src/background/removeDuplicateTabs.test.js`

**Step 1: Delete the files**

```bash
cd /Users/markalston/workspace/chrome-tabs/.worktrees/integrate-dedupe/chrome-extension
rm src/background/removeDuplicateTabs.js
rm src/background/removeDuplicateTabs.test.js
```

**Step 2: Run tests to verify nothing broke**

Run: `cd /Users/markalston/workspace/chrome-tabs/.worktrees/integrate-dedupe/chrome-extension && npm test`

Expected: Tests should pass (module no longer imported anywhere)

**Step 3: Commit deletion**

```bash
cd /Users/markalston/workspace/chrome-tabs/.worktrees/integrate-dedupe/chrome-extension
git add -A
git commit -m "$(cat <<'EOF'
feat: Delete removeDuplicateTabs module

No longer needed - functionality integrated into organizeTabs.
EOF
)"
```

---

## Task 7: Update popup.test.js

**Files:**
- Modify: `chrome-extension/src/popup/popup.test.js`

**Step 1: Remove tests for dedupeBtn**

Search for and remove any tests that reference `dedupeBtn` or "Remove Duplicates".

**Step 2: Add/update tests for organize showing duplicatesClosed**

Add test verifying organize status message includes duplicate count when duplicates were closed.

**Step 3: Run tests**

Run: `cd /Users/markalston/workspace/chrome-tabs/.worktrees/integrate-dedupe/chrome-extension && npm test -- --testPathPattern=popup.test.js`

Expected: All popup tests pass

**Step 4: Commit changes**

```bash
cd /Users/markalston/workspace/chrome-tabs/.worktrees/integrate-dedupe/chrome-extension
git add src/popup/popup.test.js
git commit -m "$(cat <<'EOF'
test: Update popup tests for duplicate removal integration

- Remove dedupeBtn tests
- Update organize tests to verify duplicatesClosed in status
EOF
)"
```

---

## Task 8: Update E2E Tests

**Files:**
- Modify: `chrome-extension/e2e/ungrouped-duplicates.test.js`

**Step 1: Update test expectations**

The current test expects:
- Ungrouped duplicates are NOT removed
- Warning message is shown

Change to expect:
- Ungrouped duplicates ARE removed
- Status message shows duplicates removed count

Update the test around lines 167-183 to verify tabs are closed:

```javascript
    // Step 6: Verify ungrouped duplicates were CLOSED (not just left ungrouped)
    const tabsAfterSecondOrg = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      return tabs.map(t => ({ url: t.url, groupId: t.groupId }));
    });

    console.log(`Total tabs after organization: ${tabsAfterSecondOrg.length}`);

    // Should have fewer tabs now - duplicates were removed
    // Started with 5 initial + 3 new = 8, but 2 duplicates removed = 6
    expect(tabsAfterSecondOrg.length).toBeLessThan(8);
```

Update the status message check (around line 161):
```javascript
    // Status should show duplicates removed (not warning)
    expect(statusMessage).toContain('Removed');
    expect(statusMessage).toContain('duplicate');
    // Should NOT show warning about ungrouped duplicates
    expect(statusMessage).not.toContain('Warning');
```

**Step 2: Run e2e tests**

Run: `cd /Users/markalston/workspace/chrome-tabs/.worktrees/integrate-dedupe/chrome-extension && HEADLESS=true npm run test:e2e -- --testPathPattern=ungrouped-duplicates`

Expected: Tests pass with new expectations

**Step 3: Commit changes**

```bash
cd /Users/markalston/workspace/chrome-tabs/.worktrees/integrate-dedupe/chrome-extension
git add e2e/ungrouped-duplicates.test.js
git commit -m "$(cat <<'EOF'
test: Update e2e tests for automatic duplicate removal

- Change expectations: duplicates are now closed, not left ungrouped
- Verify status shows "Removed X duplicates" instead of warning
EOF
)"
```

---

## Task 9: Update CLAUDE.md Documentation

**Files:**
- Modify: `chrome-extension/../CLAUDE.md` (project root)

**Step 1: Update the popup description**

Remove "Remove Duplicates" from the button list in the popup description.

**Step 2: Update manual testing workflow**

Remove step 4 about clicking "Remove Duplicates" - it's now automatic.

**Step 3: Remove "Modify Duplicate Removal Logic" section**

Since the module is deleted, remove this section.

**Step 4: Commit changes**

```bash
cd /Users/markalston/workspace/chrome-tabs/.worktrees/integrate-dedupe
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: Update CLAUDE.md for duplicate removal integration

- Remove Remove Duplicates button from popup description
- Update manual testing workflow
- Remove section about modifying duplicate removal logic
EOF
)"
```

---

## Task 10: Final Verification and Cleanup

**Step 1: Run all unit tests**

Run: `cd /Users/markalston/workspace/chrome-tabs/.worktrees/integrate-dedupe/chrome-extension && npm test`

Expected: All tests pass

**Step 2: Run all e2e tests**

Run: `cd /Users/markalston/workspace/chrome-tabs/.worktrees/integrate-dedupe/chrome-extension && HEADLESS=true npm run test:e2e`

Expected: All e2e tests pass

**Step 3: Run coverage**

Run: `cd /Users/markalston/workspace/chrome-tabs/.worktrees/integrate-dedupe/chrome-extension && npm run test:coverage`

Expected: Coverage remains high, new code is covered

**Step 4: Git log review**

Run: `cd /Users/markalston/workspace/chrome-tabs/.worktrees/integrate-dedupe && git log --oneline -10`

Verify all commits are in place.

**Step 5: Final commit if needed**

If any cleanup needed, commit it.

---

## Summary of Changes

| File | Action | Description |
|------|--------|-------------|
| `organizeTabs.js` | Modify | Add duplicate removal before organizing |
| `organizeTabs.test.js` | Modify | Add tests for duplicate removal |
| `popup.html` | Modify | Remove "Remove Duplicates" button |
| `popup.js` | Modify | Remove handler, update status messages |
| `popup.test.js` | Modify | Remove/update dedupe tests |
| `background.js` | Modify | Remove message handler and import |
| `removeDuplicateTabs.js` | Delete | No longer needed |
| `removeDuplicateTabs.test.js` | Delete | No longer needed |
| `ungrouped-duplicates.test.js` | Modify | Update e2e expectations |
| `CLAUDE.md` | Modify | Update documentation |
