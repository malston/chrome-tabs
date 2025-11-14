#!/usr/bin/env python3
"""
Chrome Tab Backup Tool
Exports all tabs from your current Chrome profile to a JSON file.
Works by reading Chrome's Session files directly from the profile directory.
"""

import json
import os
import sys
import sqlite3
from pathlib import Path
from typing import List, Dict
import subprocess


def find_chrome_profile_dir():
    """Find the Chrome profile directory"""
    home = Path.home()

    # macOS
    chrome_dir = home / "Library/Application Support/Google/Chrome"
    if chrome_dir.exists():
        return chrome_dir

    # Linux
    chrome_dir = home / ".config/google-chrome"
    if chrome_dir.exists():
        return chrome_dir

    # Windows
    chrome_dir = Path(os.environ.get('LOCALAPPDATA', '')) / "Google/Chrome/User Data"
    if chrome_dir.exists():
        return chrome_dir

    return None


def get_chrome_tabs_macos():
    """Get tabs from Chrome using AppleScript on macOS"""
    # Use a delimiter that's unlikely to appear in URLs/titles
    delimiter = "|||TAB_SEPARATOR|||"

    applescript = f'''
    tell application "Google Chrome"
        set tabData to ""
        repeat with w in windows
            repeat with t in tabs of w
                set tabData to tabData & (URL of t) & "{delimiter}" & (title of t) & "{delimiter}"
            end repeat
        end repeat
        return tabData
    end tell
    '''

    try:
        result = subprocess.run(
            ['osascript', '-e', applescript],
            capture_output=True,
            text=True,
            check=True
        )

        output = result.stdout.strip()
        if not output or output == '':
            return []

        # Split by delimiter
        parts = output.split(delimiter)

        tabs = []
        i = 0
        while i < len(parts) - 1:
            url = parts[i].strip()
            title = parts[i + 1].strip() if i + 1 < len(parts) else "Untitled"

            # Skip empty URLs and validate URL format
            if url and url != '' and not url.startswith('missing value'):
                # Basic URL validation - should start with http:// or https://
                if url.startswith('http://') or url.startswith('https://'):
                    tabs.append({
                        'url': url,
                        'title': title
                    })
                else:
                    # Skip invalid URLs but log them
                    print(f"  Skipping invalid URL: {url[:50]}")

            i += 2

        return tabs

    except subprocess.CalledProcessError as e:
        print(f"Error running AppleScript: {e}")
        print(f"stderr: {e.stderr}")
        return None
    except Exception as e:
        print(f"Error getting tabs: {e}")
        return None


def backup_tabs(output_file='chrome_tabs_backup.json'):
    """Backup all Chrome tabs to a JSON file"""

    print("Chrome Tab Backup Tool")
    print("=" * 60)

    # Check if Chrome is running
    try:
        result = subprocess.run(['pgrep', 'Google Chrome'],
                              capture_output=True, text=True)
        if result.returncode != 0:
            print("Error: Chrome is not running!")
            print("Please start Chrome and open the tabs you want to backup.")
            return False
    except Exception:
        pass

    print("\nAttempting to read tabs from running Chrome instance...")

    # Try macOS AppleScript method first
    if sys.platform == 'darwin':
        tabs = get_chrome_tabs_macos()

        if tabs is None:
            print("\nError: Could not access Chrome tabs.")
            print("Make sure:")
            print("  1. Chrome is running")
            print("  2. You grant permission when macOS asks")
            return False

        if not tabs:
            print("\nWarning: No tabs found in Chrome.")
            print("Make sure you have some tabs open.")
            return False

        print(f"\nFound {len(tabs)} tabs!")

        # Show sample
        print("\nSample of tabs found:")
        for i, tab in enumerate(tabs[:5], 1):
            print(f"  {i}. {tab['title'][:60]}")
            print(f"     {tab['url'][:80]}")

        if len(tabs) > 5:
            print(f"  ... and {len(tabs) - 5} more")

        # Save to JSON
        backup_data = {
            'tabs': tabs,
            'total_count': len(tabs),
            'backup_timestamp': __import__('datetime').datetime.now().isoformat()
        }

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(backup_data, f, indent=2, ensure_ascii=False)

        print(f"\n✓ Tabs backed up successfully to: {output_file}")
        print(f"✓ Total tabs saved: {len(tabs)}")

        return True

    else:
        print("Error: This tool currently only supports macOS")
        print("Support for Linux/Windows coming soon!")
        return False


def main():
    import argparse

    parser = argparse.ArgumentParser(description='Backup Chrome tabs to JSON')
    parser.add_argument('-o', '--output', default='chrome_tabs_backup.json',
                       help='Output file path (default: chrome_tabs_backup.json)')

    args = parser.parse_args()

    success = backup_tabs(args.output)
    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())
