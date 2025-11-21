# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Instructions

Please read and follow the coding rules defined in `chrome-extension/.cursor/rules`.

## Project Overview

Chrome Tab Manager is a Chrome extension for managing Chrome tabs:

- **Chrome Extension** - One-click tab organization and deduplication

## Architecture

### Chrome Extension (`chrome-extension/`)

**Manifest V3 Extension** with modular service worker architecture:

**Directory Structure:**

```sh
chrome-extension/
├── src/
│   ├── background/           # Service worker and feature modules
│   │   ├── background.js     # Service worker entry point (message router)
│   │   ├── organizeTabs.js   # Tab grouping by domain or category
│   │   ├── removeDuplicateTabs.js
│   │   ├── removeAllGroups.js
│   │   ├── saveTabsToBookmarks.js
│   │   ├── restoreFromBookmarks.js
│   │   └── *.test.js         # Colocated unit tests
│   ├── popup/                # Popup UI
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.test.js
│   └── utils/                # Shared utility functions
│       ├── extractDomain.js
│       ├── shouldSkipUrl.js
│       ├── extractGroupBaseName.js
│       ├── getOtherBookmarksId.js
│       ├── getTabOrganizerBookmarkFolders.js
│       ├── colorManager.js
│       └── *.test.js
├── assets/                   # Static resources
├── e2e/                      # End-to-end tests
├── manifest.json
└── package.json
```

**Main Components:**

- **manifest.json** - Extension configuration
  - Requires `tabs`, `tabGroups`, and `bookmarks` permissions
  - Service worker: `src/background/background.js`
  - Popup UI: `src/popup/popup.html`

- **src/background/background.js** - Service worker entry point (message router)
  - Routes messages from popup to feature handler functions
  - Imports feature modules from same directory

- **Feature Modules** (`src/background/`)
  - `organizeTabs()` - Groups tabs by domain or category using Chrome Tab Groups API
  - `removeDuplicateTabs()` - Closes duplicate tabs (keeps first occurrence)
  - `removeAllGroups()` - Ungroups all tabs
  - `saveTabsToBookmarks()` - Saves tab groups to bookmarks
  - `restoreFromBookmarks()` - Restores tabs from saved bookmarks

- **Utility Functions** (`src/utils/`)
  - `extractDomain()` - Extracts domain from URLs with special handling for:
    - localhost → "localhost"
    - Private IPs (192.168.x.x, 10.x.x.x, 172.x.x.x) → "local-network"
    - Public IPs → "ip-addresses"
  - `shouldSkipUrl()` - Filters chrome://, chrome-extension://, about: URLs
  - `extractGroupBaseName()` - Extracts group name from grouped tabs
  - `getOtherBookmarksId()` - Gets the "Other Bookmarks" folder ID
  - `getTabOrganizerBookmarkFolders()` - Lists saved Tab Organizer bookmark folders
  - `colorManager()` - Manages tab group colors

- **popup.html/js** (`src/popup/`) - Extension UI
  - Buttons: Organize by Domain, Organize by Category, Remove Duplicates, Save to Bookmarks, Restore from Bookmarks, Remove All Groups
  - Status feedback with success/error states
  - Communication with background service worker via `chrome.runtime.sendMessage()`

**Key Implementation Details:**

- Tabs are sorted alphabetically by title within each group
- Only groups with 2+ tabs are created (singles remain ungrouped)
- Chrome internal pages (`chrome://`, `chrome-extension://`, `about:`) are skipped
- Each group shows name and tab count: `github.com (25)`
- Colors rotate through: blue, red, yellow, green, pink, purple, cyan, orange
- Bookmark save/restore automatically manages Tab Organizer bookmark folders with timestamps

## Development Commands

### Chrome Extension Development

**Install the extension:**

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `~/workspace/chrome-tabs/chrome-extension`

**Reload after changes:**

1. Go to `chrome://extensions/`
2. Find "Tab Organizer"
3. Click refresh icon

**Debug extension:**

- Click "service worker" link on `chrome://extensions/` for service worker console
- Right-click popup → Inspect for popup console

## Testing

The extension includes comprehensive unit tests colocated with source files:

**Running Tests:**

```bash
npm test                # Run all unit tests
npm run test:e2e       # Run end-to-end tests
npm run test:coverage  # Generate coverage report
```

**Test Organization:**

- Unit tests for utilities: `chrome-extension/src/utils/*.test.js`
- Unit tests for features: `chrome-extension/src/background/*.test.js`
- UI tests: `chrome-extension/src/popup/popup.test.js`
- End-to-end tests: `chrome-extension/e2e/`

**Manual Testing Workflow:**

1. Open Chrome with many tabs across multiple domains
2. Click extension icon → "Organize by Domain"
3. Verify tabs are grouped by domain, sorted alphabetically
4. Click "Remove Duplicates"
5. Verify duplicate URLs are closed (first occurrence kept)
6. Click "Save to Bookmarks"
7. Verify bookmarks created in "Other Bookmarks"
8. Click "Restore from Bookmarks" and select a folder
9. Verify tabs restored and grouped correctly
10. Click "Remove All Groups"
11. Verify groups are removed but tabs remain open

## Common Development Tasks

### Modify Domain Grouping Logic

Edit `extractDomain()` function in `chrome-extension/src/utils/extractDomain.js`

### Modify Tab Organization (Domain or Category)

Edit `organizeTabs()` function in `chrome-extension/src/background/organizeTabs.js`

### Add New Extension Action

1. Add button to `chrome-extension/src/popup/popup.html`
2. Add event listener in `chrome-extension/src/popup/popup.js`
3. Add message handler in `chrome-extension/src/background/background.js` (message router)
4. Create new feature module in `chrome-extension/src/background/` or use existing modules
5. Import and wire up the feature module in `src/background/background.js`

### Modify Duplicate Removal Logic

Edit `removeDuplicateTabs()` function in `chrome-extension/src/background/removeDuplicateTabs.js`

### Modify Bookmark Save/Restore Behavior

- Edit `saveTabsToBookmarks()` in `chrome-extension/src/background/saveTabsToBookmarks.js`
- Edit `restoreFromBookmarks()` in `chrome-extension/src/background/restoreFromBookmarks.js`

## Key Technical Constraints

- **No remote debugging needed** - Uses native Chrome APIs
- **Works in all Chrome profiles** - No special startup required
- **Same-window operation** - Only affects tabs in current window
- **Cannot modify chrome:// pages** - System limitation

## Files Not to Modify

- `chrome-extension/icon*.png` - Generated icons, regenerate if needed

## Troubleshooting

### Extension not working

- Ensure Developer Mode enabled on `chrome://extensions/`
- Reload extension (refresh icon)
- Check service worker console for errors

## Project Evolution Notes

This project evolved from a CDP-based approach to a Chrome Extension:

- **Original approach**: Python scripts with Chrome DevTools Protocol (CDP)
- **Problem**: CDP requires fresh profile (no existing tabs), manual interaction needed
- **Solution**: Chrome Extension using native Tab Groups API
- **Result**: One-click automation, no debugging port, works everywhere

Chrome's built-in session restore (Cmd+Shift+T) handles recovering accidentally closed tabs.
