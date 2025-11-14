# Chrome Tab Manager

Complete solution for managing Chrome tabs: organize by domain, remove duplicates, and recover from history.

## Features

### 🎯 Chrome Extension (Primary Tool)

- **One-click organization** - Automatically group tabs by domain
- **One-click deduplication** - Remove duplicate tabs instantly
- **Smart coloring** - Each domain gets a unique color
- **Shows tab counts** - See how many tabs in each group
- **Works everywhere** - Use in any Chrome profile, anytime
- **No setup required** - No remote debugging, no command line

### 🔧 Command-Line Tools (Optional)

- **History Recovery** - Restore tabs from your browsing history

## Quick Start

### Install the Chrome Extension (Recommended)

```bash
# Open Chrome and navigate to:
chrome://extensions/

# Enable "Developer mode" (toggle in top-right)
# Click "Load unpacked"
# Select: /Users/markalston/workspace/chrome-tabs/chrome-extension
```

See [chrome-extension/README.md](chrome-extension/README.md) for detailed instructions.

### Install Command-Line Tools (Optional)

```bash
make install
```

## Usage

### Organize Tabs by Domain

**Use the Chrome Extension**:

1. Click the Tab Organizer icon in your toolbar
2. Click "Organize by Domain"
3. Done! All tabs grouped automatically

Example result:

- `github.com (25)` - All GitHub tabs
- `williamlam.com (24)` - All blog tabs
- `local-network (7)` - All lab IPs

### Remove Duplicate Tabs

**Use the Chrome Extension**:

1. Click the Tab Organizer icon
2. Click "Remove Duplicates"
3. Done! All duplicate URLs removed

### Recover Lost Tabs from History

**Use the command-line tool**:

```bash
# Restore from last 7 days of history
make restore-history

# Or with custom options
uv run restore_from_history.py --days 30 --limit 500
```

Note: Requires Chrome to be running with remote debugging. See troubleshooting below.

## Requirements

- **Chrome Extension**: Just Chrome browser
- **Command-Line Tools** (optional):
  - Python 3.8+
  - [uv](https://github.com/astral-sh/uv) package manager
  - macOS (for AppleScript backup feature)

## Available Commands

```bash
make help            # Show all available commands
make install         # Install dependencies
make restore-history # Restore tabs from history
make clean           # Clean up
```

## Project Structure

```sh
chrome-tabs/
├── chrome-extension/       # Chrome Extension (main tool!)
│   ├── manifest.json
│   ├── background.js       # Tab grouping & dedupe logic
│   ├── popup.html/js       # Extension UI (3 buttons)
│   └── README.md
├── restore_from_history.py # History recovery script
├── Makefile                # Easy command access
└── README.md               # This file
```

## How It Works

### Chrome Extension

- Uses Chrome's native Tab Groups API for organization
- Uses Chrome's Tabs API for deduplication
- Groups tabs by extracting domain from URLs
- Removes duplicates by tracking seen URLs
- Assigns colors and counts automatically
- **No remote debugging needed!**

### History Recovery

- Reads Chrome's History SQLite database
- Filters by date range and limit
- Creates new tabs via DevTools Protocol
- Useful for recovering accidentally closed tabs
- Requires Chrome with `--remote-debugging-port`

## Troubleshooting

### Extension not working?

- Make sure Developer Mode is enabled on `chrome://extensions/`
- Reload the extension (click the refresh icon)
- Check the service worker console for errors

### Can't restore history?

- History recovery requires Chrome with remote debugging
- Make sure Chrome history isn't cleared
- Try increasing `--days` or `--limit` parameters
- Check: `~/Library/Application Support/Google/Chrome/Default/History`

### How to enable remote debugging for history recovery

```bash
# Close all Chrome windows, then:
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-debug-profile &
```

## Tips

- **Daily use**: Just use the Chrome Extension - it's instant and works everywhere
- **Tab recovery**: Use `make restore-history` if you accidentally closed important tabs
- **Session restore**: Chrome's built-in session restore (Cmd+Shift+T) also works great
- **Pin the extension**: Pin it to your toolbar for easy access

## Workflow Examples

### Spring Cleaning

1. Click extension → "Remove Duplicates"
2. Click extension → "Organize by Domain"
3. Manually close groups you don't need
4. Done!

### Recover Lost Tabs

1. Run `make restore-history`
2. Review and close unwanted tabs
3. Click extension → "Organize by Domain"

### Before Closing Chrome

1. Click extension → "Organize by Domain"
2. Review your tab groups
3. Bookmark important groups
4. Close Chrome with confidence

## License

MIT License - feel free to modify and use as needed.
