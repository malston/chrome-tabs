# Chrome Extension Code Reorganization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorganize chrome-extension code into feature-based directory structure with colocated tests while maintaining 100% test coverage and zero functional changes.

**Architecture:** Extract functions from monolithic background.js into separate ES6 modules organized by feature (background/, popup/, utils/). Tests move alongside their source files. No build step - manifest.json points directly to source files using relative paths.

**Tech Stack:** Plain JavaScript, ES6 modules, Chrome Extension Manifest V3, Jest

---

## Pre-flight Verification

### Task 0: Verify Clean Baseline

**Files:**
- Working directory: `/Users/markalston/workspace/chrome-tabs/.worktrees/refactor-organize-chrome-extension/chrome-extension/`

**Step 1: Run all tests**

```bash
cd /Users/markalston/workspace/chrome-tabs/.worktrees/refactor-organize-chrome-extension/chrome-extension
npm test
```

Expected: 339 tests pass, 0 failures

**Step 2: Check current coverage**

```bash
npm run coverage
```

Expected: Record coverage percentage (should be ~82%)

**Step 3: Verify extension structure**

```bash
ls -la | grep -E '\.(js|html|png)$'
```

Expected: See background.js, popup.js, popup.html, test files, icons in root

---

## Phase 1: Create Directory Structure

### Task 1: Create New Directories

**Files:**
- Create: `chrome-extension/src/background/`
- Create: `chrome-extension/src/popup/`
- Create: `chrome-extension/src/utils/`
- Create: `chrome-extension/assets/`

**Step 1: Create directories**

```bash
cd /Users/markalston/workspace/chrome-tabs/.worktrees/refactor-organize-chrome-extension/chrome-extension
mkdir -p src/background src/popup src/utils assets
```

**Step 2: Verify directory structure**

```bash
ls -la src/
ls -la assets/
```

Expected: See background/, popup/, utils/ under src/, and assets/ at root

**Step 3: Commit**

```bash
git add src/ assets/
git commit -m "chore: Create directory structure for code reorganization

- Add src/background/ for service worker logic
- Add src/popup/ for extension UI
- Add src/utils/ for pure utility functions
- Add assets/ for icons and static resources"
```

---

## Phase 2: Extract and Move Utility Functions

### Task 2: Extract extractDomain Utility

**Files:**
- Read: `chrome-extension/background.js:13-40`
- Create: `chrome-extension/src/utils/extractDomain.js`
- Move: `chrome-extension/extractDomain.test.js` → `chrome-extension/src/utils/extractDomain.test.js`

**Step 1: Read the extractDomain function from background.js**

```bash
cat background.js | sed -n '13,40p'
```

Expected: See the extractDomain function code

**Step 2: Create src/utils/extractDomain.js**

Create file with exact content from background.js lines 13-40, adding export:

```javascript
// ABOUTME: Extracts and normalizes domain names from URLs for tab grouping.
// ABOUTME: Handles special cases like localhost, private IPs, and multi-part TLDs.

export function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname;

    if (hostname === 'localhost') {
      return 'localhost';
    }

    const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipMatch = hostname.match(ipv4Pattern);
    if (ipMatch) {
      const [, octet1, octet2] = ipMatch;
      const first = parseInt(octet1);
      const second = parseInt(octet2);

      if (first === 192 && second === 168) return 'local-network';
      if (first === 10) return 'local-network';
      if (first === 172 && second >= 16 && second <= 31) return 'local-network';
      return 'ip-addresses';
    }

    hostname = hostname.replace(/^www\./, '');

    const parts = hostname.split('.');
    if (parts.length > 2) {
      const tld = parts[parts.length - 1];
      const sld = parts[parts.length - 2];
      if (['co', 'com', 'org', 'net', 'edu', 'gov'].includes(sld) && tld.length === 2) {
        return parts.slice(-3).join('.');
      }
      return parts.slice(-2).join('.');
    }

    return hostname;
  } catch (e) {
    return 'unknown';
  }
}
```

**Step 3: Move test file**

```bash
git mv extractDomain.test.js src/utils/extractDomain.test.js
```

**Step 4: Update test imports**

Modify `src/utils/extractDomain.test.js`:

Find:
```javascript
const { extractDomain } = require('./background.js');
```

Replace with:
```javascript
import { extractDomain } from './extractDomain.js';
```

**Step 5: Run the test to verify it works**

```bash
npm test -- src/utils/extractDomain.test.js
```

Expected: All extractDomain tests pass

**Step 6: Commit**

```bash
git add src/utils/extractDomain.js src/utils/extractDomain.test.js
git commit -m "refactor: Extract extractDomain to separate module

- Move extractDomain function to src/utils/extractDomain.js
- Add ES6 export
- Move tests to src/utils/extractDomain.test.js
- Update test imports to use ES6 import"
```

### Task 3: Extract shouldSkipUrl Utility

**Files:**
- Read: `chrome-extension/background.js` (find shouldSkipUrl function)
- Create: `chrome-extension/src/utils/shouldSkipUrl.js`
- Move: `chrome-extension/shouldSkipUrl.test.js` → `chrome-extension/src/utils/shouldSkipUrl.test.js`

**Step 1: Find shouldSkipUrl function in background.js**

```bash
grep -n "function shouldSkipUrl" background.js
```

Expected: Find line number where shouldSkipUrl is defined

**Step 2: Read the function**

```bash
# Adjust line numbers based on grep output
cat background.js | sed -n '<START>,<END>p'
```

**Step 3: Create src/utils/shouldSkipUrl.js**

```javascript
// ABOUTME: Filters out Chrome internal URLs that should not be organized.
// ABOUTME: Includes chrome://, chrome-extension://, and about: pages.

export function shouldSkipUrl(url) {
  if (!url) return true;
  return url.startsWith('chrome://') ||
         url.startsWith('chrome-extension://') ||
         url.startsWith('about:');
}
```

**Step 4: Move test file and update imports**

```bash
git mv shouldSkipUrl.test.js src/utils/shouldSkipUrl.test.js
```

Update `src/utils/shouldSkipUrl.test.js` imports:
```javascript
import { shouldSkipUrl } from './shouldSkipUrl.js';
```

**Step 5: Run test**

```bash
npm test -- src/utils/shouldSkipUrl.test.js
```

Expected: All shouldSkipUrl tests pass

**Step 6: Commit**

```bash
git add src/utils/shouldSkipUrl.js src/utils/shouldSkipUrl.test.js
git commit -m "refactor: Extract shouldSkipUrl to separate module

- Move shouldSkipUrl function to src/utils/shouldSkipUrl.js
- Move tests to src/utils/shouldSkipUrl.test.js
- Update imports to ES6 format"
```

### Task 4: Extract extractGroupBaseName Utility

**Files:**
- Read: `chrome-extension/background.js` (find extractGroupBaseName)
- Create: `chrome-extension/src/utils/extractGroupBaseName.js`
- Move: `chrome-extension/extractGroupBaseName.test.js` → `chrome-extension/src/utils/extractGroupBaseName.test.js`

**Step 1: Find and read extractGroupBaseName function**

```bash
grep -n "function extractGroupBaseName" background.js
cat background.js | sed -n '<START>,<END>p'
```

**Step 2: Create src/utils/extractGroupBaseName.js**

```javascript
// ABOUTME: Extracts base name from group titles by removing count suffix.
// ABOUTME: Handles formats like "example.com (25)" → "example.com".

export function extractGroupBaseName(groupName) {
  if (!groupName) return '';

  const match = groupName.match(/^(.+?)\s*\((\d+)\)$/);
  if (match) {
    return match[1];
  }

  return groupName;
}
```

**Step 3: Move test and update imports**

```bash
git mv extractGroupBaseName.test.js src/utils/extractGroupBaseName.test.js
```

Update imports in test file to:
```javascript
import { extractGroupBaseName } from './extractGroupBaseName.js';
```

**Step 4: Run test**

```bash
npm test -- src/utils/extractGroupBaseName.test.js
```

Expected: All extractGroupBaseName tests pass

**Step 5: Commit**

```bash
git add src/utils/extractGroupBaseName.js src/utils/extractGroupBaseName.test.js
git commit -m "refactor: Extract extractGroupBaseName to separate module

- Move extractGroupBaseName to src/utils/extractGroupBaseName.js
- Move tests to src/utils/extractGroupBaseName.test.js
- Update imports to ES6 format"
```

### Task 5: Extract getOtherBookmarksId Utility

**Files:**
- Read: `chrome-extension/background.js` (find getOtherBookmarksId)
- Create: `chrome-extension/src/utils/getOtherBookmarksId.js`
- Move: `chrome-extension/getOtherBookmarksId.test.js` → `chrome-extension/src/utils/getOtherBookmarksId.test.js`

**Step 1: Find and read getOtherBookmarksId function**

```bash
grep -n "async function getOtherBookmarksId" background.js
```

**Step 2: Create src/utils/getOtherBookmarksId.js**

```javascript
// ABOUTME: Locates Chrome's "Other Bookmarks" folder for bookmark operations.
// ABOUTME: Throws error if folder not found.

export async function getOtherBookmarksId() {
  const tree = await chrome.bookmarks.getTree();
  const otherBookmarks = tree[0].children.find(node => node.title === 'Other Bookmarks');

  if (!otherBookmarks) {
    throw new Error('Other Bookmarks folder not found');
  }

  return otherBookmarks.id;
}
```

**Step 3: Move test and update imports**

```bash
git mv getOtherBookmarksId.test.js src/utils/getOtherBookmarksId.test.js
```

Update imports in test file to:
```javascript
import { getOtherBookmarksId } from './getOtherBookmarksId.js';
```

**Step 4: Run test**

```bash
npm test -- src/utils/getOtherBookmarksId.test.js
```

Expected: All getOtherBookmarksId tests pass

**Step 5: Commit**

```bash
git add src/utils/getOtherBookmarksId.js src/utils/getOtherBookmarksId.test.js
git commit -m "refactor: Extract getOtherBookmarksId to separate module

- Move getOtherBookmarksId to src/utils/getOtherBookmarksId.js
- Move tests to src/utils/getOtherBookmarksId.test.js
- Update imports to ES6 format"
```

### Task 6: Extract getTabOrganizerBookmarkFolders Utility

**Files:**
- Read: `chrome-extension/background.js` (find getTabOrganizerBookmarkFolders)
- Create: `chrome-extension/src/utils/getTabOrganizerBookmarkFolders.js`
- Move: `chrome-extension/getTabOrganizerBookmarkFolders.test.js` → `chrome-extension/src/utils/getTabOrganizerBookmarkFolders.test.js`

**Step 1: Find and extract function**

```bash
grep -n "async function getTabOrganizerBookmarkFolders" background.js
```

**Step 2: Create src/utils/getTabOrganizerBookmarkFolders.js**

Note: This function depends on getOtherBookmarksId, so add import:

```javascript
// ABOUTME: Retrieves all Tab Organizer bookmark folders from Other Bookmarks.
// ABOUTME: Returns folders sorted by date (newest first).

import { getOtherBookmarksId } from './getOtherBookmarksId.js';

export async function getTabOrganizerBookmarkFolders() {
  console.log('Getting Tab Organizer bookmark folders...');

  const otherBookmarksId = await getOtherBookmarksId();
  const children = await chrome.bookmarks.getChildren(otherBookmarksId);

  const folders = children
    .filter(node => !node.url && node.title && node.title.startsWith('Tab Organizer -'))
    .map(node => ({ id: node.id, title: node.title }))
    .sort((a, b) => b.title.localeCompare(a.title));

  return folders;
}
```

**Step 3: Move test and update imports**

```bash
git mv getTabOrganizerBookmarkFolders.test.js src/utils/getTabOrganizerBookmarkFolders.test.js
```

Update imports:
```javascript
import { getTabOrganizerBookmarkFolders } from './getTabOrganizerBookmarkFolders.js';
```

**Step 4: Run test**

```bash
npm test -- src/utils/getTabOrganizerBookmarkFolders.test.js
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add src/utils/getTabOrganizerBookmarkFolders.js src/utils/getTabOrganizerBookmarkFolders.test.js
git commit -m "refactor: Extract getTabOrganizerBookmarkFolders to separate module

- Move function to src/utils/getTabOrganizerBookmarkFolders.js
- Add import for getOtherBookmarksId dependency
- Move tests to src/utils/
- Update imports to ES6 format"
```

---

## Phase 3: Extract Background Feature Functions

### Task 7: Extract organizeTabs Function

**Files:**
- Read: `chrome-extension/background.js` (find organizeTabs)
- Create: `chrome-extension/src/background/organizeTabs.js`
- Move: `chrome-extension/organizeTabs.test.js` → `chrome-extension/src/background/organizeTabs.test.js`

**Step 1: Find organizeTabs function**

```bash
grep -n "async function organizeTabs" background.js
```

**Step 2: Create src/background/organizeTabs.js**

This is a large function. Extract it and add necessary imports:

```javascript
// ABOUTME: Groups tabs by domain or category using Chrome Tab Groups API.
// ABOUTME: Handles smart merging with existing groups and moves ungrouped tabs to end.

import { extractDomain } from '../utils/extractDomain.js';
import { shouldSkipUrl } from '../utils/shouldSkipUrl.js';
import { extractGroupBaseName } from '../utils/extractGroupBaseName.js';

export async function organizeTabs(mode = 'domain', allWindows = false) {
  // [Copy full function body from background.js]
  // This will be a large block - approximately 150+ lines
  // Include all the logic for domain grouping, category grouping,
  // smart merging, sorting, color assignment, etc.
}
```

**Note:** Due to length, manually copy the complete organizeTabs function from background.js, ensuring all logic is preserved.

**Step 3: Move test and update imports**

```bash
git mv organizeTabs.test.js src/background/organizeTabs.test.js
```

Update imports:
```javascript
import { organizeTabs } from './organizeTabs.js';
```

**Step 4: Run test**

```bash
npm test -- src/background/organizeTabs.test.js
```

Expected: All organizeTabs tests pass

**Step 5: Commit**

```bash
git add src/background/organizeTabs.js src/background/organizeTabs.test.js
git commit -m "refactor: Extract organizeTabs to separate module

- Move organizeTabs to src/background/organizeTabs.js
- Add imports for extractDomain, shouldSkipUrl, extractGroupBaseName
- Move tests to src/background/
- Update test imports to ES6 format"
```

### Task 8: Extract removeDuplicateTabs Function

**Files:**
- Read: `chrome-extension/background.js` (find removeDuplicateTabs)
- Create: `chrome-extension/src/background/removeDuplicateTabs.js`
- Move: `chrome-extension/removeDuplicateTabs.test.js` → `chrome-extension/src/background/removeDuplicateTabs.test.js`

**Step 1: Find and extract function**

```bash
grep -n "async function removeDuplicateTabs" background.js
```

**Step 2: Create src/background/removeDuplicateTabs.js**

```javascript
// ABOUTME: Finds and removes duplicate tabs, keeping first occurrence.
// ABOUTME: Updates group titles after removal to reflect new tab counts.

import { shouldSkipUrl } from '../utils/shouldSkipUrl.js';
import { extractGroupBaseName } from '../utils/extractGroupBaseName.js';

export async function removeDuplicateTabs() {
  // [Copy full function body from background.js]
}
```

**Step 3: Move test and update imports**

```bash
git mv removeDuplicateTabs.test.js src/background/removeDuplicateTabs.test.js
```

Update imports:
```javascript
import { removeDuplicateTabs } from './removeDuplicateTabs.js';
```

**Step 4: Run test**

```bash
npm test -- src/background/removeDuplicateTabs.test.js
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add src/background/removeDuplicateTabs.js src/background/removeDuplicateTabs.test.js
git commit -m "refactor: Extract removeDuplicateTabs to separate module

- Move removeDuplicateTabs to src/background/removeDuplicateTabs.js
- Add imports for shouldSkipUrl, extractGroupBaseName
- Move tests to src/background/
- Update imports to ES6 format"
```

### Task 9: Extract removeAllGroups Function

**Files:**
- Read: `chrome-extension/background.js` (find removeAllGroups)
- Create: `chrome-extension/src/background/removeAllGroups.js`
- Move: `chrome-extension/removeAllGroups.test.js` → `chrome-extension/src/background/removeAllGroups.test.js`

**Step 1: Create src/background/removeAllGroups.js**

```javascript
// ABOUTME: Ungroups all grouped tabs in the current window.
// ABOUTME: Tabs remain open but are removed from their groups.

export async function removeAllGroups() {
  // [Copy full function body from background.js]
}
```

**Step 2: Move test and update imports**

```bash
git mv removeAllGroups.test.js src/background/removeAllGroups.test.js
```

Update imports:
```javascript
import { removeAllGroups } from './removeAllGroups.js';
```

**Step 3: Run test**

```bash
npm test -- src/background/removeAllGroups.test.js
```

Expected: All tests pass

**Step 4: Commit**

```bash
git add src/background/removeAllGroups.js src/background/removeAllGroups.test.js
git commit -m "refactor: Extract removeAllGroups to separate module

- Move removeAllGroups to src/background/removeAllGroups.js
- Move tests to src/background/
- Update imports to ES6 format"
```

### Task 10: Extract saveTabsToBookmarks Function

**Files:**
- Read: `chrome-extension/background.js` (find saveTabsToBookmarks)
- Create: `chrome-extension/src/background/saveTabsToBookmarks.js`
- Move: `chrome-extension/saveTabsToBookmarks.test.js` → `chrome-extension/src/background/saveTabsToBookmarks.test.js`

**Step 1: Create src/background/saveTabsToBookmarks.js**

```javascript
// ABOUTME: Saves current tabs to Chrome bookmarks organized by groups.
// ABOUTME: Creates timestamped folder structure in Other Bookmarks.

import { shouldSkipUrl } from '../utils/shouldSkipUrl.js';
import { getOtherBookmarksId } from '../utils/getOtherBookmarksId.js';

export async function saveTabsToBookmarks() {
  // [Copy full function body from background.js]
}
```

**Step 2: Move test and update imports**

```bash
git mv saveTabsToBookmarks.test.js src/background/saveTabsToBookmarks.test.js
```

Update imports:
```javascript
import { saveTabsToBookmarks } from './saveTabsToBookmarks.js';
```

**Step 3: Run test**

```bash
npm test -- src/background/saveTabsToBookmarks.test.js
```

Expected: All tests pass

**Step 4: Commit**

```bash
git add src/background/saveTabsToBookmarks.js src/background/saveTabsToBookmarks.test.js
git commit -m "refactor: Extract saveTabsToBookmarks to separate module

- Move saveTabsToBookmarks to src/background/saveTabsToBookmarks.js
- Add imports for shouldSkipUrl, getOtherBookmarksId
- Move tests to src/background/
- Update imports to ES6 format"
```

### Task 11: Extract restoreFromBookmarks Function

**Files:**
- Read: `chrome-extension/background.js` (find restoreFromBookmarks)
- Create: `chrome-extension/src/background/restoreFromBookmarks.js`
- Move: `chrome-extension/restoreFromBookmarks.test.js` → `chrome-extension/src/background/restoreFromBookmarks.test.js`

**Step 1: Create src/background/restoreFromBookmarks.js**

```javascript
// ABOUTME: Restores tabs from bookmark folder, merging with existing groups.
// ABOUTME: Skips duplicates and Chrome internal URLs.

import { shouldSkipUrl } from '../utils/shouldSkipUrl.js';
import { extractGroupBaseName } from '../utils/extractGroupBaseName.js';

export async function restoreFromBookmarks(folderId) {
  // [Copy full function body from background.js]
}
```

**Step 2: Move test and update imports**

```bash
git mv restoreFromBookmarks.test.js src/background/restoreFromBookmarks.test.js
```

Update imports:
```javascript
import { restoreFromBookmarks } from './restoreFromBookmarks.js';
```

**Step 3: Run test**

```bash
npm test -- src/background/restoreFromBookmarks.test.js
```

Expected: All tests pass

**Step 4: Commit**

```bash
git add src/background/restoreFromBookmarks.js src/background/restoreFromBookmarks.test.js
git commit -m "refactor: Extract restoreFromBookmarks to separate module

- Move restoreFromBookmarks to src/background/restoreFromBookmarks.js
- Add imports for shouldSkipUrl, extractGroupBaseName
- Move tests to src/background/
- Update imports to ES6 format"
```

---

## Phase 4: Update Main Background Service Worker

### Task 12: Rewrite background.js as Module Orchestrator

**Files:**
- Modify: `chrome-extension/background.js`

**Step 1: Read current background.js to identify remaining code**

```bash
wc -l background.js
```

Expected: See total line count (should be ~950 lines)

**Step 2: Create new background.js that imports all modules**

Replace entire `chrome-extension/background.js` with:

```javascript
// ABOUTME: Main service worker for Tab Organizer extension.
// ABOUTME: Handles message routing from popup to feature modules.

import { organizeTabs } from './organizeTabs.js';
import { removeDuplicateTabs } from './removeDuplicateTabs.js';
import { removeAllGroups } from './removeAllGroups.js';
import { saveTabsToBookmarks } from './saveTabsToBookmarks.js';
import { restoreFromBookmarks } from './restoreFromBookmarks.js';
import { getTabOrganizerBookmarkFolders } from '../utils/getTabOrganizerBookmarkFolders.js';

console.log('Tab Organizer extension loaded');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handleAsync = async () => {
    try {
      switch (request.action) {
        case 'organizeTabs': {
          const result = await organizeTabs(request.mode, request.allWindows);
          return { success: true, ...result };
        }

        case 'removeDuplicates': {
          const result = await removeDuplicateTabs();
          return { success: true, ...result };
        }

        case 'removeGroups': {
          const result = await removeAllGroups();
          return { success: true, ...result };
        }

        case 'saveToBookmarks': {
          const result = await saveTabsToBookmarks();
          return { success: true, ...result };
        }

        case 'getBookmarkFolders': {
          const folders = await getTabOrganizerBookmarkFolders();
          return { success: true, folders };
        }

        case 'restoreFromBookmarks': {
          const result = await restoreFromBookmarks(request.folderId);
          return { success: true, ...result };
        }

        default:
          return { success: false, error: 'Unknown action: ' + request.action };
      }
    } catch (error) {
      console.error('Error handling message:', error);
      return { success: false, error: error.message };
    }
  };

  handleAsync().then(sendResponse);
  return true;
});
```

**Step 3: Run all tests**

```bash
npm test
```

Expected: All 339 tests pass

**Step 4: Commit**

```bash
git add background.js
git commit -m "refactor: Rewrite background.js as module orchestrator

- Import all feature modules
- Simplify to message listener and routing logic
- Remove all extracted functions (now in separate modules)
- Maintain identical message handling API"
```

---

## Phase 5: Move Popup Files

### Task 13: Move Popup Files to src/popup/

**Files:**
- Move: `chrome-extension/popup.html` → `chrome-extension/src/popup/popup.html`
- Move: `chrome-extension/popup.js` → `chrome-extension/src/popup/popup.js`
- Move: `chrome-extension/popup.test.js` → `chrome-extension/src/popup/popup.test.js`

**Step 1: Move popup files**

```bash
git mv popup.html src/popup/popup.html
git mv popup.js src/popup/popup.js
git mv popup.test.js src/popup/popup.test.js
```

**Step 2: Update popup.html script reference**

Modify `src/popup/popup.html`:

Find:
```html
<script src="popup.js"></script>
```

Replace with:
```html
<script src="popup.js"></script>
```

Note: Path stays the same because popup.js is now in same directory

**Step 3: Update popup.test.js imports**

Modify `src/popup/popup.test.js`:

Find:
```javascript
// Any require/import of popup.js
```

Replace with:
```javascript
import { /* exported functions */ } from './popup.js';
```

**Step 4: Run popup tests**

```bash
npm test -- src/popup/popup.test.js
```

Expected: All popup tests pass

**Step 5: Commit**

```bash
git add src/popup/
git commit -m "refactor: Move popup files to src/popup/

- Move popup.html to src/popup/
- Move popup.js to src/popup/
- Move popup.test.js to src/popup/
- Update test imports"
```

---

## Phase 6: Move Assets and Update Manifest

### Task 14: Move Icons to assets/

**Files:**
- Move: `chrome-extension/icon16.png` → `chrome-extension/assets/icon16.png`
- Move: `chrome-extension/icon48.png` → `chrome-extension/assets/icon48.png`
- Move: `chrome-extension/icon128.png` → `chrome-extension/assets/icon128.png`

**Step 1: Move icon files**

```bash
git mv icon16.png assets/icon16.png
git mv icon48.png assets/icon48.png
git mv icon128.png assets/icon128.png
```

**Step 2: Verify move**

```bash
ls -la assets/
```

Expected: See all three icon files

**Step 3: Commit**

```bash
git add assets/
git commit -m "refactor: Move icons to assets/ directory

- Move icon16.png to assets/
- Move icon48.png to assets/
- Move icon128.png to assets/"
```

### Task 15: Update manifest.json Paths

**Files:**
- Modify: `chrome-extension/manifest.json`

**Step 1: Read current manifest.json**

```bash
cat manifest.json
```

**Step 2: Update all paths in manifest.json**

Modify `manifest.json`:

Find:
```json
  "background": {
    "service_worker": "background.js"
  },
```

Replace with:
```json
  "background": {
    "service_worker": "src/background/background.js",
    "type": "module"
  },
```

Find:
```json
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icon16.png",
      "48": "icon48.png",
      "128": "icon128.png"
    }
  },
```

Replace with:
```json
  "action": {
    "default_popup": "src/popup/popup.html",
    "default_icon": {
      "16": "assets/icon16.png",
      "48": "assets/icon48.png",
      "128": "assets/icon128.png"
    }
  },
```

Find:
```json
  "icons": {
    "16": "icon16.png",
    "48": "icon48.png",
    "128": "icon128.png"
  }
```

Replace with:
```json
  "icons": {
    "16": "assets/icon16.png",
    "48": "assets/icon48.png",
    "128": "assets/icon128.png"
  }
```

**CRITICAL:** Add `"type": "module"` to background service_worker to enable ES6 imports.

**Step 3: Verify JSON is valid**

```bash
cat manifest.json | python3 -m json.tool > /dev/null && echo "Valid JSON"
```

Expected: "Valid JSON"

**Step 4: Commit**

```bash
git add manifest.json
git commit -m "refactor: Update manifest.json paths for new structure

- Update service_worker path to src/background/background.js
- Add type: module for ES6 import support
- Update popup path to src/popup/popup.html
- Update all icon paths to assets/"
```

---

## Phase 7: Update E2E Tests

### Task 16: Update E2E Test Imports

**Files:**
- Check: `chrome-extension/e2e/` directory for any imports from background.js

**Step 1: List E2E test files**

```bash
ls -la e2e/
```

**Step 2: Search for imports from background.js**

```bash
grep -r "background.js" e2e/ || echo "No imports found"
grep -r "require.*background" e2e/ || echo "No require statements"
grep -r "import.*background" e2e/ || echo "No import statements"
```

**Step 3: If imports found, update them**

For any files importing from background.js, update paths:

```javascript
// Before:
import { extractDomain } from '../background.js';

// After:
import { extractDomain } from '../src/utils/extractDomain.js';
```

**Step 4: Run E2E tests**

```bash
npm run test:e2e
```

Expected: All E2E tests pass

**Step 5: Commit if changes were made**

```bash
git add e2e/
git commit -m "refactor: Update E2E test imports for new structure

- Update imports to point to new module locations
- Adjust paths for src/ directory structure"
```

---

## Phase 8: Final Verification

### Task 17: Run All Tests and Verify Coverage

**Files:**
- None (verification only)

**Step 1: Run all unit tests**

```bash
npm test
```

Expected: 339 tests pass, 0 failures

**Step 2: Run E2E tests**

```bash
npm run test:e2e
```

Expected: All E2E tests pass

**Step 3: Check code coverage**

```bash
npm run coverage
```

Expected: Coverage percentage matches baseline (~82%)

**Step 4: Verify no orphaned test files in root**

```bash
ls -la *.test.js 2>/dev/null || echo "No test files in root - good!"
```

Expected: "No test files in root - good!"

**Step 5: Verify directory structure**

```bash
tree src/ assets/ -L 2
```

Expected:
```
src/
├── background/
│   ├── background.js
│   ├── organizeTabs.js
│   ├── organizeTabs.test.js
│   ├── removeDuplicateTabs.js
│   ├── removeDuplicateTabs.test.js
│   ├── removeAllGroups.js
│   ├── removeAllGroups.test.js
│   ├── saveTabsToBookmarks.js
│   ├── saveTabsToBookmarks.test.js
│   ├── restoreFromBookmarks.js
│   └── restoreFromBookmarks.test.js
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.test.js
└── utils/
    ├── extractDomain.js
    ├── extractDomain.test.js
    ├── shouldSkipUrl.js
    ├── shouldSkipUrl.test.js
    ├── extractGroupBaseName.js
    ├── extractGroupBaseName.test.js
    ├── getOtherBookmarksId.js
    ├── getOtherBookmarksId.test.js
    ├── getTabOrganizerBookmarkFolders.js
    └── getTabOrganizerBookmarkFolders.test.js

assets/
├── icon16.png
├── icon48.png
└── icon128.png
```

**Step 6: Commit verification note**

```bash
git commit --allow-empty -m "verify: All tests passing with new structure

- 339 unit tests passing
- All E2E tests passing
- Code coverage maintained at ~82%
- Directory structure verified"
```

### Task 18: Manual Extension Testing

**Files:**
- None (manual testing in Chrome)

**Step 1: Open Chrome extensions page**

Navigate to: `chrome://extensions/`

**Step 2: Reload the extension**

1. Find "Tab Organizer" extension
2. Click reload/refresh icon

**Step 3: Check for errors**

1. Click "service worker" link
2. Verify console shows: "Tab Organizer extension loaded"
3. Verify no errors in console

**Step 4: Test Organize by Domain**

1. Open several tabs across different domains (github.com, google.com, etc.)
2. Click extension icon
3. Click "Organize by Domain"
4. Verify tabs are grouped correctly
5. Verify success message appears

**Step 5: Test Remove Duplicates**

1. Open duplicate tabs (same URL)
2. Click "Remove Duplicates"
3. Verify duplicates are closed
4. Verify success message

**Step 6: Test Remove All Groups**

1. Click "Remove All Groups"
2. Verify groups are removed
3. Verify tabs remain open

**Step 7: Test Save/Restore Bookmarks**

1. Click "Save Tabs to Bookmarks"
2. Verify success message
3. Click "Restore from Bookmarks"
4. Select a folder
5. Verify tabs are restored

**Step 8: Document results**

```bash
git commit --allow-empty -m "verify: Manual extension testing complete

All features tested and working:
- Organize by Domain ✓
- Remove Duplicates ✓
- Remove All Groups ✓
- Save to Bookmarks ✓
- Restore from Bookmarks ✓

No console errors, extension loads correctly"
```

---

## Phase 9: Update Documentation

### Task 19: Update README and CLAUDE.md

**Files:**
- Modify: `chrome-extension/README.md`
- Modify: `CLAUDE.md` (root)

**Step 1: Update chrome-extension/README.md**

Add section about new structure:

```markdown
## Directory Structure

```
chrome-extension/
├── src/
│   ├── background/     # Service worker and background logic
│   ├── popup/          # Extension popup UI
│   └── utils/          # Shared utility functions
├── assets/             # Icons and static resources
├── e2e/                # End-to-end tests
├── coverage/           # Test coverage reports
├── manifest.json       # Extension configuration
└── package.json        # Node.js dependencies
```

### Code Organization

- **src/background/**: Feature modules handling tab operations (organize, deduplicate, bookmark save/restore)
- **src/popup/**: Extension UI and user interaction logic
- **src/utils/**: Pure utility functions (domain extraction, URL filtering, etc.)
- **Tests**: Colocated with source files (e.g., `organizeTabs.js` + `organizeTabs.test.js`)
```

**Step 2: Update root CLAUDE.md**

Update the "Architecture" section:

Find:
```markdown
### Chrome Extension (`chrome-extension/`)

**Manifest V3 Extension** with service worker architecture:

- **manifest.json** - Extension configuration
- **background.js** - Core business logic (service worker)
- **popup.html/js** - Extension UI
```

Replace with:
```markdown
### Chrome Extension (`chrome-extension/`)

**Manifest V3 Extension** with ES6 module architecture:

- **manifest.json** - Extension configuration (points to `src/` modules)
- **src/background/** - Service worker modules
  - `background.js` - Main message router
  - `organizeTabs.js` - Tab grouping logic
  - `removeDuplicateTabs.js` - Duplicate detection/removal
  - `removeAllGroups.js` - Ungroup all tabs
  - `saveTabsToBookmarks.js` - Save tabs to Chrome bookmarks
  - `restoreFromBookmarks.js` - Restore tabs from bookmarks
- **src/popup/** - Extension UI (`popup.html`, `popup.js`)
- **src/utils/** - Shared utilities (`extractDomain.js`, `shouldSkipUrl.js`, etc.)
- **assets/** - Icons and static resources
```

**Step 3: Commit documentation updates**

```bash
git add chrome-extension/README.md CLAUDE.md
git commit -m "docs: Update documentation for new code structure

- Add directory structure overview to chrome-extension/README.md
- Update CLAUDE.md architecture section with module organization
- Document feature-based organization approach"
```

---

## Phase 10: Completion

### Task 20: Final Summary and Handoff

**Step 1: Generate final test report**

```bash
npm test -- --verbose > test-report.txt
```

**Step 2: Create completion summary**

Create `REORGANIZATION_SUMMARY.md`:

```markdown
# Chrome Extension Code Reorganization - Completion Summary

**Date Completed:** 2025-01-20
**Branch:** refactor/organize-chrome-extension

## Changes Summary

### Directory Structure
- Created `src/background/`, `src/popup/`, `src/utils/`, `assets/` directories
- Moved all source files into feature-based organization
- Colocated tests with source files

### Files Reorganized
- **6 utility modules** extracted to `src/utils/`
- **5 feature modules** extracted to `src/background/`
- **3 popup files** moved to `src/popup/`
- **3 icons** moved to `assets/`
- **background.js** rewritten as thin orchestrator (950→60 lines)

### Test Results
- ✅ All 339 unit tests passing
- ✅ All E2E tests passing
- ✅ Code coverage maintained at 82%
- ✅ Manual extension testing: all features working

### Manifest Changes
- Updated service worker path to `src/background/background.js`
- Added `"type": "module"` for ES6 import support
- Updated popup path to `src/popup/popup.html`
- Updated icon paths to `assets/`

### Benefits Achieved
1. ✅ Clear separation of concerns (background/popup/utils)
2. ✅ Tests colocated with source (easier to maintain)
3. ✅ Modular architecture (easier to extend)
4. ✅ No functional changes (zero behavior regression)
5. ✅ No build step required (simple deployment)

## Next Steps
1. Create PR to merge `refactor/organize-chrome-extension` → `main`
2. Get code review
3. Merge and delete worktree
```

**Step 3: Save summary**

```bash
cat > REORGANIZATION_SUMMARY.md << 'EOF'
[paste content from above]
EOF
```

**Step 4: Final commit**

```bash
git add REORGANIZATION_SUMMARY.md
git commit -m "docs: Add reorganization completion summary

Comprehensive summary of:
- Directory structure changes
- Files reorganized
- Test results and verification
- Benefits achieved"
```

**Step 5: Push branch**

```bash
git push -u origin refactor/organize-chrome-extension
```

**Step 6: Verification checklist**

Print final checklist:

```bash
echo "=== REORGANIZATION COMPLETE ==="
echo ""
echo "✅ All 339 unit tests passing"
echo "✅ All E2E tests passing"
echo "✅ Code coverage maintained at 82%"
echo "✅ Manual extension testing complete"
echo "✅ Documentation updated"
echo "✅ Branch pushed to remote"
echo ""
echo "Ready to create Pull Request!"
```

---

## Emergency Rollback Plan

If issues discovered during implementation:

```bash
# Return to main branch
cd /Users/markalston/workspace/chrome-tabs
git worktree remove .worktrees/refactor-organize-chrome-extension

# Or if you need to save work:
cd .worktrees/refactor-organize-chrome-extension
git stash
cd ../..
git worktree remove .worktrees/refactor-organize-chrome-extension
```

## Success Criteria

- [ ] All 339 unit tests passing
- [ ] All E2E tests passing
- [ ] Code coverage unchanged (~82%)
- [ ] Extension loads without errors
- [ ] All features work in manual testing
- [ ] Documentation updated
- [ ] No orphaned files in root
- [ ] Clean git history with atomic commits

---

**Total Estimated Time:** 90-120 minutes (20 tasks × 4-6 minutes average)

**Dependencies:** None - can start immediately in worktree

**Risk Level:** Low - Pure refactoring with comprehensive test coverage
