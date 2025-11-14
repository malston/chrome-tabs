# Chrome Tab Consolidator

A Python script to backup, restore, and deduplicate Chrome tabs. This tool helps you:
- Backup all tabs from your current Chrome session
- Restore tabs into a fresh Chrome instance
- Remove duplicate tabs across all windows

Perfect for when you have multiple windows with duplicate tabs and want to clean everything up!

## Requirements

- Python 3.8 or higher
- Google Chrome
- [uv](https://github.com/astral-sh/uv) - Fast Python package installer
- `make` (usually pre-installed on macOS/Linux)

## Installation

### Install uv (if not already installed)

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Install dependencies

```bash
make install
```

This will create a virtual environment and install all required dependencies using uv.

## Usage

### How It Works

Chrome's remote debugging requires a **separate user profile** for security. This tool works around that limitation:

1. **Backup**: Exports all tabs from your current Chrome session to JSON
2. **Restart**: Closes Chrome and restarts with debugging enabled (fresh profile)
3. **Restore**: Imports all backed-up tabs into the debug Chrome instance
4. **Deduplicate**: Removes any duplicate URLs

### Quick Start (One Command)

Run the complete workflow automatically:

```bash
# Install dependencies
make install

# Run full workflow: backup -> restart -> restore -> dedupe
make full-workflow
```

The script will prompt before closing Chrome. When done, all your tabs will be consolidated in one window with no duplicates!

### Step-by-Step Workflow

If you prefer manual control:

```bash
# 1. Install dependencies
make install

# 2. Backup your current tabs (while Chrome is running normally)
make backup-tabs

# 3. Restart Chrome with debugging (closes current Chrome)
make chrome-restart

# 4. Restore all tabs into debug Chrome
make restore-tabs

# 5. Remove any duplicates
make run
```

### Manual Usage

#### Step 1: Start Chrome with Remote Debugging

You need to start Chrome with remote debugging enabled. **You must completely quit Chrome first (Cmd+Q on Mac)**, then:

##### On macOS:
```bash
make chrome-debug
```

Or manually:
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 &
```

##### On Linux:
```bash
google-chrome --remote-debugging-port=9222 &
```

##### On Windows:
```cmd
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

#### Step 2: Run the Script

Using Make:
```bash
make run
```

Or directly with Python:
```bash
.venv/bin/python consolidate_tabs.py
```

The script will:
1. Connect to your Chrome instance
2. Scan all tabs across all windows
3. Identify and remove duplicates
4. Show you a summary of what was done

### Command-line Options

```bash
# Use a different port
.venv/bin/python consolidate_tabs.py --port 9223

# Connect to remote Chrome instance
.venv/bin/python consolidate_tabs.py --host 192.168.1.100 --port 9222
```

### Makefile Targets

- `make help` - Show all available commands
- `make install` - Install dependencies using uv
- `make backup-tabs` - Backup tabs from current Chrome session
- `make chrome-restart` - Restart Chrome with debugging enabled
- `make restore-tabs` - Restore backed-up tabs into debug Chrome
- `make run` - Remove duplicate tabs
- `make full-workflow` - Complete workflow (backup -> restart -> restore -> dedupe)
- `make check-chrome` - Verify Chrome debugging connection
- `make clean` - Remove virtual environment and backups

## Example Output

```
Chrome Tab Consolidator
============================================================
Connected to Chrome: Chrome/119.0.6045.159
Fetching all Chrome tabs...
Found 47 tabs across all windows

Found 3 instances of: https://acme.com/dashboard...
  Closing duplicate tab: ACME Dashboard
  Closing duplicate tab: ACME Dashboard

Found 2 instances of: https://example.com/inbox...
  Closing duplicate tab: Example Mail

============================================================
Summary:
  Total tabs found: 47
  Duplicate tabs removed: 4
  Tabs remaining: 43
============================================================
```

## How It Works

The script uses Chrome DevTools Protocol (CDP) to:
1. Query all open tabs via the remote debugging interface
2. Group tabs by URL
3. Close duplicate tabs (keeping the first one)
4. Report the results

## Notes

- **Tab Groups**: The script preserves tab groups - duplicate tabs are removed regardless of which group they're in
- **Bookmarks**: Your bookmarks are never affected by this script
- **Window Consolidation**: This script currently only removes duplicates. To merge all tabs into one window, you can manually drag tabs or use Chrome's "Move tab to another window" feature
- **Chrome Internal Pages**: Pages like `chrome://settings` are skipped

## Troubleshooting

### "Cannot connect to Chrome"

Make sure you:
1. Closed ALL Chrome windows before starting
2. Started Chrome with the `--remote-debugging-port=9222` flag
3. The port 9222 is not blocked by a firewall

### "No tabs found"

- Check that Chrome is actually running
- Verify the debugging port with: `curl http://localhost:9222/json/version`
- Make sure you have tabs open (not just a blank window)

### Permission Issues on macOS

If you get a permission error when starting Chrome with remote debugging, try:
```bash
chmod +x /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome
```

## Safety

This script:
- Only closes tabs (doesn't modify content)
- Doesn't access tab content or personal data
- Works locally on your machine
- Requires explicit Chrome debugging permission
- Can be reviewed - it's a simple Python script

## License

MIT License - feel free to modify and use as needed.
