# Chrome Extension Code Organization Design

**Date:** 2025-01-20
**Status:** Approved

## Goals

1. Separate tests from source code (cleaner repo structure)
2. Create logical groupings (background, popup, utils) for better maintainability
3. Keep it simple - no build step required
4. Maintain colocated tests with their source files

## Design Decisions

- **Structure:** Feature-based organization with `src/` directory
- **Test Location:** Colocated with source files in their respective directories
- **Build Step:** None - keep plain JavaScript, manifest points directly to source files
- **Module System:** ES6 modules (import/export) - supported in Manifest V3 service workers

## New Directory Structure

```
chrome-extension/
├── src/
│   ├── background/
│   │   ├── background.js              # Main service worker
│   │   ├── organizeTabs.js           # Tab organization logic
│   │   ├── organizeTabs.test.js
│   │   ├── removeDuplicateTabs.js    # Duplicate removal logic
│   │   ├── removeDuplicateTabs.test.js
│   │   ├── removeAllGroups.js        # Ungroup logic
│   │   ├── removeAllGroups.test.js
│   │   ├── saveTabsToBookmarks.js    # Bookmark save logic
│   │   ├── saveTabsToBookmarks.test.js
│   │   ├── restoreFromBookmarks.js   # Bookmark restore logic
│   │   └── restoreFromBookmarks.test.js
│   ├── popup/
│   │   ├── popup.html                # Extension popup UI
│   │   ├── popup.js                  # Popup interaction logic
│   │   └── popup.test.js
│   └── utils/
│       ├── extractDomain.js          # Domain extraction utility
│       ├── extractDomain.test.js
│       ├── shouldSkipUrl.js          # URL filtering utility
│       ├── shouldSkipUrl.test.js
│       ├── extractGroupBaseName.js   # Group name utility
│       ├── extractGroupBaseName.test.js
│       ├── getOtherBookmarksId.js    # Bookmark folder utility
│       ├── getOtherBookmarksId.test.js
│       ├── getTabOrganizerBookmarkFolders.js
│       └── getTabOrganizerBookmarkFolders.test.js
├── assets/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── e2e/                              # E2E tests (existing)
├── coverage/                          # Test coverage reports
├── manifest.json
├── package.json
├── jest.e2e.config.js
└── README.md
```

## Manifest.json Path Updates

**Changes Required:**
- Service worker path: `background.js` → `src/background/background.js`
- Popup HTML: `popup.html` → `src/popup/popup.html`
- All icon paths: `iconXX.png` → `assets/iconXX.png`

**Updated manifest.json:**
```json
{
  "manifest_version": 3,
  "background": {
    "service_worker": "src/background/background.js"
  },
  "action": {
    "default_popup": "src/popup/popup.html",
    "default_icon": {
      "16": "assets/icon16.png",
      "48": "assets/icon48.png",
      "128": "assets/icon128.png"
    }
  },
  "icons": {
    "16": "assets/icon16.png",
    "48": "assets/icon48.png",
    "128": "assets/icon128.png"
  }
}
```

## Module Organization

### Current State
`background.js` is ~250 lines containing all logic:
- Domain extraction utilities
- Tab organization logic
- Duplicate removal logic
- Group removal logic
- Bookmark save/restore logic
- Message listener

### New Organization

**Utils (Pure Functions):**
- `src/utils/extractDomain.js` - Domain extraction utility
- `src/utils/shouldSkipUrl.js` - URL filtering utility
- `src/utils/extractGroupBaseName.js` - Group name extraction
- `src/utils/getOtherBookmarksId.js` - Bookmark folder utilities
- `src/utils/getTabOrganizerBookmarkFolders.js` - Tab organizer folder utilities

**Background Feature Modules:**
- `src/background/organizeTabs.js` - Tab organization logic
- `src/background/removeDuplicateTabs.js` - Duplicate removal logic
- `src/background/removeAllGroups.js` - Group removal logic
- `src/background/saveTabsToBookmarks.js` - Bookmark save logic
- `src/background/restoreFromBookmarks.js` - Bookmark restore logic

**Main Orchestrator:**
- `src/background/background.js` - Message listener and delegation

### Example Module Structure

**`src/utils/extractDomain.js`:**
```javascript
export function extractDomain(url) {
  // existing implementation
}
```

**`src/background/organizeTabs.js`:**
```javascript
import { extractDomain } from '../utils/extractDomain.js';
import { shouldSkipUrl } from '../utils/shouldSkipUrl.js';

export async function organizeTabs() {
  // existing implementation
}
```

**`src/background/background.js`:**
```javascript
import { organizeTabs } from './organizeTabs.js';
import { removeDuplicateTabs } from './removeDuplicateTabs.js';
import { removeAllGroups } from './removeAllGroups.js';
import { saveTabsToBookmarks } from './saveTabsToBookmarks.js';
import { restoreFromBookmarks } from './restoreFromBookmarks.js';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // delegates to imported functions
});
```

## Migration Steps

1. **Create new directory structure**
   - Create `src/background/`, `src/popup/`, `src/utils/`, `assets/`

2. **Extract utility functions first** (safest, no Chrome API dependencies)
   - Extract `extractDomain()` from background.js → `src/utils/extractDomain.js`
   - Extract `shouldSkipUrl()` → `src/utils/shouldSkipUrl.js`
   - Extract `extractGroupBaseName()` → `src/utils/extractGroupBaseName.js`
   - Extract bookmark utilities → `src/utils/getOtherBookmarksId.js`, etc.
   - Add `export` keyword to each function

3. **Extract feature functions** (depend on utils and Chrome APIs)
   - Extract `organizeTabs()` → `src/background/organizeTabs.js`
   - Extract `removeDuplicateTabs()` → `src/background/removeDuplicateTabs.js`
   - Extract `removeAllGroups()` → `src/background/removeAllGroups.js`
   - Extract `saveTabsToBookmarks()` → `src/background/saveTabsToBookmarks.js`
   - Extract `restoreFromBookmarks()` → `src/background/restoreFromBookmarks.js`
   - Add necessary imports and exports

4. **Update main background.js**
   - Import all feature functions
   - Keep only the message listener and delegation logic

5. **Move popup files**
   - Move `popup.html` → `src/popup/popup.html`
   - Move `popup.js` → `src/popup/popup.js`
   - Update script reference in popup.html if needed

6. **Move assets**
   - Move all `icon*.png` → `assets/`

7. **Update manifest.json** with new paths

8. **Move test files** alongside their source modules

9. **Update test imports** to use new paths

10. **Update E2E test imports** if they reference background.js

## Testing Updates

### Test Import Updates

**Before:**
```javascript
// organizeTabs.test.js (root level)
const { organizeTabs } = require('./background.js');
```

**After:**
```javascript
// src/background/organizeTabs.test.js
import { organizeTabs } from './organizeTabs.js';
```

### E2E Tests
The `e2e/` directory stays at root. Update any imports:
```javascript
// Before:
const { extractDomain } = require('../background.js');

// After:
import { extractDomain } from '../src/utils/extractDomain.js';
```

## Verification Criteria

1. **All tests pass:** `npm test` and `npm run test:e2e` must succeed
2. **Code coverage unchanged:** Since this is purely structural (no logic changes), coverage percentage must remain exactly the same
3. **Extension loads:** Successfully loads in `chrome://extensions/`
4. **All features work:**
   - Organize by Domain
   - Remove Duplicates
   - Remove All Groups
   - Save Tabs to Bookmarks
   - Restore from Bookmarks
5. **No console errors:** Service worker and popup console are clean

## Git Workflow

1. Create feature branch for this work
2. Commit frequently during migration
3. Create PR when complete
4. All verification criteria must pass before merge

## Benefits

- **Clear separation of concerns:** Utils, background logic, and popup are clearly separated
- **Better maintainability:** Related code is grouped together
- **Easier testing:** Tests live next to the code they test
- **Scalable structure:** Room to add content scripts, options page, etc.
- **Follows best practices:** Aligns with Cursor Chrome extension development rules
- **No added complexity:** No build step, plain JavaScript continues to work
