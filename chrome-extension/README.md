# Tab Organizer Chrome Extension

Complete tab management in one extension: organize by domain AND remove duplicates with one click each.

## Features

- **Organize by Domain**: Groups tabs by domain automatically
- **Organize by Category**: Groups tabs by type (Development, Social Media, Shopping, etc.)
- **Duplicate Removal**: Remove duplicate tabs instantly
- **Save to Bookmarks**: Save all tabs into bookmark folders organized by group names
- **Restore from Bookmarks**: Restore tab groups from saved bookmark folders
- **Smart Coloring**: Each group gets a unique color
- **One Click Operations**: Simple, fast, no configuration needed
- **Handles Special Cases**: Groups localhost, private IPs intelligently
- **Shows Tab Count**: Each group shows how many tabs it contains
- **Works Everywhere**: Use in any Chrome profile, no debugging needed

## Installation

1. **Open Chrome Extensions Page**
   - Go to `chrome://extensions/`
   - Or click the three dots menu → Extensions → Manage Extensions

2. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top right corner

3. **Load the Extension**
   - Click "Load unpacked"
   - Navigate to: `/Users/markalston/workspace/chrome-tabs/chrome-extension`
   - Click "Select"

4. **Pin the Extension** (Optional but recommended)
   - Click the puzzle piece icon in Chrome's toolbar
   - Find "Tab Organizer"
   - Click the pin icon to keep it visible

## Usage

### Organize Tabs by Domain
1. Click the Tab Organizer extension icon
2. Click "Organize by Domain"
3. All tabs automatically grouped by domain!

### Organize Tabs by Category
1. Click the Tab Organizer extension icon
2. Click "Organize by Category"
3. All tabs automatically grouped by category (Development, Social Media, Shopping, etc.)!

### Remove Duplicate Tabs
1. Click the Tab Organizer extension icon
2. Click "Remove Duplicates"
3. All duplicate URLs are removed (keeps the first occurrence)

### Save to Bookmarks
1. Organize your tabs first (by Domain or Category)
2. Click the Tab Organizer extension icon
3. Click "Save to Bookmarks"
4. All tabs saved into bookmark folders matching your group names!

The bookmarks are saved in "Other Bookmarks" under a timestamped folder like "Tab Organizer - 2025-01-15 14:30". Each tab group becomes a folder, and ungrouped tabs go into an "Ungrouped Tabs" folder.

### Restore from Bookmarks
1. Click the Tab Organizer extension icon
2. Click "Restore from Bookmarks"
3. Select a previously saved bookmark folder from the list
4. Click "Restore"
5. Tabs are restored and grouped automatically!

**Smart Restore Features:**
- If a group with the same name already exists, new tabs are added to that group
- Duplicate tabs (URLs already open) are automatically skipped
- New groups are created for groups that don't exist yet
- All restored tabs are created in the background (not stealing focus)

**Using Existing Bookmark Folders:**

The extension looks for bookmark folders in "Other Bookmarks" that start with "Tab Organizer -". To make your existing bookmark folders compatible:

1. Move your bookmark folder to "Other Bookmarks"
2. Rename the folder to start with "Tab Organizer -" (e.g., "Tab Organizer - My Work Tabs")
3. Organize bookmarks inside into subfolders (each subfolder becomes a tab group)
4. The subfolder names will be used as tab group names

Example structure:
```
Other Bookmarks
└── Tab Organizer - My Work Tabs
    ├── Development (15 bookmarks)  → Creates "Development" group
    ├── Documentation (8 bookmarks) → Creates "Documentation" group
    └── Shopping (5 bookmarks)      → Creates "Shopping" group
```

### Remove All Groups
1. Click the Tab Organizer extension icon
2. Click "Remove All Groups"
3. All groups ungrouped (tabs remain open)

## How It Works

**Organize by Domain:**
1. Scans all tabs in the current window
2. Groups them by domain (e.g., github.com, acme.com)
3. Creates colored tab groups with domain names and tab counts
4. Sorts tabs alphabetically within each group
5. Skips domains with only 1 tab (no need to group)
6. Skips chrome:// internal pages

**Organize by Category:**
1. Scans all tabs in the current window
2. Categorizes tabs based on their domain and URL:
   - **Development**: GitHub, GitLab, Stack Overflow, localhost, IP addresses
   - **Documentation**: Documentation sites, API references, tutorials
   - **Social Media**: Facebook, Twitter, LinkedIn, Reddit, etc.
   - **Communication**: Slack, Discord, Gmail, Zoom, etc.
   - **Shopping**: Amazon, eBay, shopping sites
   - **Productivity**: Google Drive, Notion, Trello, etc.
   - **News & Media**: News sites, Medium, blogs
   - **Entertainment**: YouTube, Netflix, Spotify, etc.
   - **Finance**: Banking, PayPal, crypto sites
   - **Cloud Services**: AWS, Azure, Google Cloud, etc.
   - **Other**: Everything else
3. Creates colored tab groups with category names and tab counts
4. Sorts tabs alphabetically within each category
5. Skips categories with only 1 tab

**Remove Duplicates:**
1. Scans all tabs in the current window
2. Tracks URLs that have been seen
3. Closes tabs with duplicate URLs (keeps the first one)
4. Skips chrome:// internal pages

**Save to Bookmarks:**
1. Scans all tabs in the current window
2. Gets all tab groups and their names
3. Creates a root bookmark folder with timestamp
4. For each tab group:
   - Creates a folder with the group name
   - Saves all tabs in that group as bookmarks
5. Ungrouped tabs are saved in "Ungrouped Tabs" folder
6. All bookmarks saved under "Other Bookmarks"

**Restore from Bookmarks:**
1. Lists all "Tab Organizer" bookmark folders
2. User selects which folder to restore
3. For each bookmark folder in the selected save:
   - Checks if a group with that name already exists
   - Filters out duplicate URLs (already open tabs)
   - Creates new tabs for each bookmark
   - If group exists: Adds tabs to existing group
   - If group doesn't exist: Creates new group with that name
4. All tabs created in background (not stealing focus)

## Examples

**After "Organize by Domain":**
- `github.com (25)` - All GitHub tabs in a blue group
- `acme.com (24)` - All acme.com tabs in a red group
- `local-network (7)` - All lab IPs (192.168.x.x) in a yellow group

**After "Organize by Category":**
- `Development (32)` - GitHub, Stack Overflow, localhost tabs in a blue group
- `Documentation (18)` - All docs sites in a red group
- `Social Media (12)` - Twitter, LinkedIn, Reddit tabs in a yellow group
- `Shopping (8)` - Amazon, eBay tabs in a green group

**After "Remove Duplicates":**
- "Removed 15 duplicate tabs!" - All duplicate URLs closed

**After "Save to Bookmarks":**
- Bookmarks saved in "Other Bookmarks" → "Tab Organizer - 2025-01-15 14:30"
  - Folder: "github.com (25)" with 25 bookmarks
  - Folder: "acme.com (24)" with 24 bookmarks
  - Folder: "Ungrouped Tabs" with 12 bookmarks

**After "Restore from Bookmarks":**
- "Restored 61 tabs! Created 2 new groups. Merged into 1 existing groups. Skipped 5 duplicates."
- Tab groups recreated with the same names as the bookmark folders
- Existing groups have new tabs added to them
- Duplicate tabs are not created

## Directory Structure

```
chrome-extension/
├── src/
│   ├── background/              # Service worker and feature logic
│   │   ├── background.js        # Main service worker (message router)
│   │   ├── organizeTabs.js      # Tab grouping logic
│   │   ├── removeDuplicateTabs.js
│   │   ├── removeAllGroups.js
│   │   ├── saveTabsToBookmarks.js
│   │   ├── restoreFromBookmarks.js
│   │   └── *.test.js            # Unit tests (colocated with source)
│   ├── popup/                   # Extension UI
│   │   ├── popup.html           # Popup interface
│   │   ├── popup.js             # Popup interaction logic
│   │   └── popup.test.js
│   └── utils/                   # Shared utilities
│       ├── extractDomain.js
│       ├── shouldSkipUrl.js
│       ├── extractGroupBaseName.js
│       ├── getOtherBookmarksId.js
│       ├── getTabOrganizerBookmarkFolders.js
│       ├── colorManager.js
│       └── *.test.js            # Unit tests
├── assets/                      # Static resources
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── e2e/                         # End-to-end tests
├── manifest.json                # Extension configuration
├── package.json
└── README.md
```

## Code Organization

The extension uses modular organization with feature-based directories:

### Service Worker (`background.js`)
- **Location:** `src/background/background.js` (entry point for manifest.json)
- **Purpose:** Routes messages from popup to appropriate handlers
- **Dependencies:** Imports feature modules from same directory and `../utils/`

### Background Features (`src/background/`)
Pure business logic modules with Chrome API dependencies:

- **organizeTabs.js** - Groups tabs by domain or category
- **removeDuplicateTabs.js** - Closes duplicate URLs
- **removeAllGroups.js** - Ungroups all tabs
- **saveTabsToBookmarks.js** - Saves tab groups to bookmarks
- **restoreFromBookmarks.js** - Restores tabs from saved bookmarks

Each module exports a single async function and is tested with colocated `.test.js` files.

### Popup UI (`src/popup/`)
- **popup.html** - User interface with buttons and status display
- **popup.js** - Handles button clicks, sends messages to background worker
- **popup.test.js** - Tests UI interactions

### Utilities (`src/utils/`)
Pure utility functions with no Chrome API dependencies:

- **extractDomain.js** - Extracts domain from URLs (handles localhost, IPs)
- **shouldSkipUrl.js** - Filters chrome://, chrome-extension://, about: URLs
- **extractGroupBaseName.js** - Extracts group name from grouped tabs
- **getOtherBookmarksId.js** - Gets the "Other Bookmarks" folder ID
- **getTabOrganizerBookmarkFolders.js** - Lists saved Tab Organizer bookmark folders
- **colorManager.js** - Manages tab group colors

Each utility is tested independently with colocated `.test.js` files.

### Test Structure
Tests are colocated with their source files:
- Unit tests for utilities in `src/utils/*.test.js`
- Unit tests for features in `src/background/*.test.js`
- UI tests in `src/popup/popup.test.js`
- End-to-end tests in `e2e/` directory

## Troubleshooting

### Extension doesn't appear
- Make sure Developer Mode is enabled
- Try reloading the extension (click the refresh icon on chrome://extensions/)

### Groups not being created
- Make sure you have tabs from at least 2 different domains
- Check the extension console for errors (click "service worker" link on chrome://extensions/)

### Want to change grouping behavior?
- Edit domain grouping: Modify `extractDomain()` in `src/utils/extractDomain.js`
- Edit category grouping: Modify `categorizeUrl()` logic in `src/background/organizeTabs.js`
- Add new categories: Extend the categorization logic in `src/background/organizeTabs.js`

## Uninstall

1. Go to `chrome://extensions/`
2. Find "Tab Organizer"
3. Click "Remove"
