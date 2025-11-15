# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome Tab Manager is a complete solution for managing Chrome tabs with two components:

1. **Chrome Extension** (Primary tool) - One-click tab organization and deduplication
2. **Command-line tool** (Optional) - Emergency recovery from browsing history

The Chrome Extension is the main user-facing tool and handles 99% of use cases. The Python script is only for recovering tabs from Chrome's history database when needed.

## Architecture

### Chrome Extension (`chrome-extension/`)

**Manifest V3 Extension** with service worker architecture:

- **manifest.json** - Extension configuration
  - Requires `tabs` and `tabGroups` permissions
  - Service worker: `background.js`
  - Popup UI: `popup.html`

- **background.js** - Core business logic (service worker)
  - `organizeTabs()` - Groups tabs by domain using Chrome Tab Groups API
  - `extractDomain()` - Extracts domain from URLs with special handling for:
    - localhost → "localhost"
    - Private IPs (192.168.x.x, 10.x.x.x, 172.x.x.x) → "local-network"
    - Public IPs → "ip-addresses"
  - `removeDuplicateTabs()` - Closes duplicate tabs (keeps first occurrence)
  - `removeAllGroups()` - Ungroups all tabs
  - Message listener for popup communication

- **popup.html/js** - Extension UI
  - Three buttons: Organize by Domain, Remove Duplicates, Remove All Groups
  - Status feedback with success/error states
  - Communication with background service worker via `chrome.runtime.sendMessage()`

**Key Implementation Details:**

- Tabs are sorted alphabetically by title within each domain group
- Only domains with 2+ tabs are grouped (singles remain ungrouped)
- Chrome internal pages (`chrome://`, `chrome-extension://`, `about:`) are skipped
- Each group shows domain name and tab count: `github.com (25)`
- Colors rotate through: blue, red, yellow, green, pink, purple, cyan, orange

### History Recovery Tool (`restore_from_history.py`)

**Python script using Chrome DevTools Protocol (CDP):**

- Reads Chrome's SQLite History database
- Filters by date range (default: 7 days) and limit (default: 200 URLs)
- Creates tabs via CDP WebSocket protocol
- Requires Chrome running with `--remote-debugging-port=9222` and `--user-data-dir`

**Key Implementation Details:**

- Uses two-step tab creation:
  1. `PUT /json/new` to create blank tab
  2. WebSocket `Page.navigate` command to load URL
- Chrome timestamps are microseconds since 1601-01-01 (converted to Python datetime)
- Temporary database copy avoids file locking issues
- Skips `chrome://` and `chrome-extension://` URLs

## Development Commands

### Install Dependencies
```bash
make install
```
Installs Python dependencies using `uv` package manager.

### History Recovery
```bash
make restore-history
```
Runs the history recovery script with defaults (7 days, 200 URLs).

Custom options:
```bash
uv run restore_from_history.py --days 30 --limit 500
```

### Chrome Extension Development

**Install the extension:**
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `/Users/markalston/workspace/chrome-tabs/chrome-extension`

**Reload after changes:**
1. Go to `chrome://extensions/`
2. Find "Tab Organizer"
3. Click refresh icon

**Debug extension:**
- Click "service worker" link on `chrome://extensions/` for background.js console
- Right-click popup → Inspect for popup.js console

## Testing

No automated tests currently. Manual testing workflow:

1. Open Chrome with many tabs across multiple domains
2. Click extension icon → "Organize by Domain"
3. Verify tabs are grouped by domain, sorted alphabetically
4. Click "Remove Duplicates"
5. Verify duplicate URLs are closed (first occurrence kept)
6. Click "Remove All Groups"
7. Verify groups are removed but tabs remain open

## Common Development Tasks

### Modify Domain Grouping Logic
Edit `extractDomain()` function in `chrome-extension/background.js:13-40`

### Modify Tab Sorting
Edit sorting logic in `chrome-extension/background.js:91-95`

### Add New Extension Action
1. Add button to `chrome-extension/popup.html`
2. Add event listener in `chrome-extension/popup.js`
3. Add message handler in `chrome-extension/background.js` (line 191+)
4. Implement new function in `background.js`

### Modify History Recovery Behavior
Edit `restore_from_history.py:47-118` (database query and filtering)

## Key Technical Constraints

### Chrome Extension
- **No remote debugging needed** - Uses native Chrome APIs
- **Works in all Chrome profiles** - No special startup required
- **Same-window operation** - Only affects tabs in current window
- **Cannot modify chrome:// pages** - System limitation

### History Recovery
- **Requires Chrome restart** - Must launch with `--remote-debugging-port=9222` and `--user-data-dir=/tmp/chrome-debug-profile`
- **Fresh profile only** - Debug mode requires separate user data directory
- **macOS specific** - File paths assume macOS (can be adapted for Linux/Windows)
- **Database locking** - Chrome must release lock on History database (script copies to `/tmp`)

## Files Not to Modify

- `chrome-extension/icon*.png` - Generated icons, regenerate if needed
- `/tmp/chrome_history_temp.db` - Temporary file, auto-deleted

## Package Management

Uses **uv** (fast Python package manager):
- `pyproject.toml` - Project metadata and dependencies
- `requirements.txt` - Not present, uv uses pyproject.toml directly
- Dependencies: `requests>=2.31.0`, `websocket-client>=1.6.0`

## Troubleshooting

### Extension not working
- Ensure Developer Mode enabled on `chrome://extensions/`
- Reload extension (refresh icon)
- Check service worker console for errors

### History recovery fails
- Ensure Chrome running with: `--remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug-profile`
- Check `http://localhost:9222/json/version` is accessible
- Verify History database exists: `~/Library/Application Support/Google/Chrome/Default/History`
- Try increasing `--days` or `--limit` parameters

### Cannot read History database
- Close main Chrome instance (database lock issue)
- Or use the debug Chrome instance that was started with remote debugging

## Project Evolution Notes

This project evolved from a CDP-based approach to a Chrome Extension:

- **Original approach**: Python scripts with Chrome DevTools Protocol (CDP)
- **Problem**: CDP requires fresh profile (no existing tabs), manual interaction needed
- **Solution**: Chrome Extension using native Tab Groups API
- **Result**: One-click automation, no debugging port, works everywhere

The history recovery script remains as an emergency tool for recovering accidentally closed tabs, but Chrome's built-in session restore (Cmd+Shift+T) handles most cases.
