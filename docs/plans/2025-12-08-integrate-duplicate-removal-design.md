# Integrate Duplicate Removal into Organize Operations

## Overview

Remove the standalone "Remove Duplicates" button and integrate duplicate removal directly into the "Organize by Domain" and "Organize by Category" operations. Duplicates should be closed automatically when organizing tabs, not as a separate manual step.

## Motivation

There's no practical reason to keep duplicate tabs after organizing. If someone clicks "Organize by Domain" or "Organize by Category", they want their tabs organized - having identical URLs open in the same group is never useful.

## Design Decisions

### Duplicate Removal Rules

1. **Ungrouped duplicate of grouped tab**: Close the ungrouped tab (grouped tab was explicitly organized)
2. **Multiple ungrouped tabs with same URL**: Keep the first one (by tab order), close the rest
3. **Cross-group duplicates**: Keep both (same URL in different groups is considered intentional)

### Scope of Changes

**Files to modify:**
- `src/popup/popup.html` - Remove "Remove Duplicates" button
- `src/popup/popup.js` - Remove button handler
- `src/background/background.js` - Remove `removeDuplicates` message handler
- `src/background/organizeTabs.js` - Add duplicate removal logic
- `src/background/organizeTabs.test.js` - Add tests for duplicate removal

**Files to delete:**
- `src/background/removeDuplicateTabs.js`
- `src/background/removeDuplicateTabs.test.js`

**E2E tests:**
- Remove tests for "Remove Duplicates" button
- Add tests verifying organize operations close duplicates

## Implementation Details

### Single-Window Organize

Before the existing organize logic, add a duplicate removal pass:

```javascript
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
const seenUngroupedUrls = new Map();
const tabsToClose = [];

for (const tab of tabs) {
  if (shouldSkipUrl(tab.url)) continue;
  if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) continue;

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
}

// Step 4: Re-query tabs and proceed with organize
tabs = await chrome.tabs.query({ currentWindow: true });
```

### All-Windows Organize

Update existing duplicate detection (lines 32-79) to prioritize grouped tabs using the same logic as single-window.

### Status Message

Update the status message to report duplicates closed:
- Before: "Organized 45 tabs into 8 groups"
- After: "Organized 45 tabs into 8 groups (3 duplicates removed)"

## Test Coverage

### Unit Tests (organizeTabs.test.js)

1. Ungrouped duplicate of grouped tab gets closed
2. Multiple ungrouped tabs with same URL - keep first, close rest
3. Cross-group duplicates are preserved
4. All-windows organize prioritizes grouped tabs
5. Return value includes accurate `duplicatesClosed` count

### E2E Tests

1. Organize by domain closes duplicates
2. Organize by category closes duplicates
3. Status message reports duplicates closed
4. Remove obsolete "Remove Duplicates" button tests

## Cleanup

Remove all code related to the standalone duplicate removal feature:
- Button in popup.html
- Click handler in popup.js
- Message handler in background.js
- The removeDuplicateTabs module and its tests
