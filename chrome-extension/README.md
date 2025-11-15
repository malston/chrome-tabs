# Tab Organizer Chrome Extension

Complete tab management in one extension: organize by domain AND remove duplicates with one click each.

## Features

- **Organize by Domain**: Groups tabs by domain automatically
- **Organize by Category**: Groups tabs by type (Development, Social Media, Shopping, etc.)
- **Duplicate Removal**: Remove duplicate tabs instantly
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

## Troubleshooting

### Extension doesn't appear
- Make sure Developer Mode is enabled
- Try reloading the extension (click the refresh icon on chrome://extensions/)

### Groups not being created
- Make sure you have tabs from at least 2 different domains
- Check the extension console for errors (click "service worker" link on chrome://extensions/)

### Want to change grouping behavior?
- Edit domain grouping: Modify `extractDomain()` in `chrome-extension/background.js`
- Edit category grouping: Modify `categorizeUrl()` in `chrome-extension/background.js`
- Add new categories: Add conditions to `categorizeUrl()` function

## Uninstall

1. Go to `chrome://extensions/`
2. Find "Tab Organizer"
3. Click "Remove"
