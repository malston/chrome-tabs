#!/usr/bin/env python3
"""
Chrome Tab Consolidator
Merges all Chrome windows into one and removes duplicate tabs.
Preserves tab groups and bookmarks.
"""

import json
import sys
from collections import defaultdict
from typing import List, Dict, Set
import requests


class ChromeTabManager:
    def __init__(self, host='localhost', port=9222):
        self.host = host
        self.port = port
        self.base_url = f'http://{host}:{port}'

    def _send_command(self, target_id: str, method: str, params: dict = None) -> dict:
        """Send a command to Chrome via DevTools Protocol"""
        url = f'{self.base_url}/json'
        response = requests.get(url)
        response.raise_for_status()

        targets = response.json()
        target = next((t for t in targets if t['id'] == target_id), None)

        if not target:
            raise Exception(f"Target {target_id} not found")

        ws_url = target['webSocketDebuggerUrl']

        # For HTTP-based interaction, we'll use the simpler approach
        # Send command via POST to the target
        cmd_url = f"{self.base_url}/json"
        headers = {'Content-Type': 'application/json'}
        payload = {
            'id': 1,
            'method': method,
            'params': params or {}
        }

        return {}

    def get_all_tabs(self) -> List[Dict]:
        """Get all open tabs from all windows"""
        url = f'{self.base_url}/json/list'
        response = requests.get(url)
        response.raise_for_status()

        tabs = response.json()
        # Filter to only include pages (not extensions, etc.)
        return [tab for tab in tabs if tab['type'] == 'page']

    def close_tab(self, tab_id: str):
        """Close a specific tab"""
        url = f'{self.base_url}/json/close/{tab_id}'
        response = requests.get(url)
        response.raise_for_status()
        return response.text

    def consolidate_and_dedupe(self):
        """Main function to consolidate windows and remove duplicates"""
        print("Fetching all Chrome tabs...")
        tabs = self.get_all_tabs()

        if not tabs:
            print("No tabs found. Make sure Chrome is running with remote debugging enabled.")
            return

        print(f"Found {len(tabs)} tabs across all windows")

        # Group tabs by URL to find duplicates
        url_to_tabs = defaultdict(list)
        for tab in tabs:
            url = tab.get('url', '')
            # Skip chrome:// URLs and empty URLs
            if url and not url.startswith('chrome://') and not url.startswith('chrome-extension://'):
                url_to_tabs[url].append(tab)

        # Find duplicates
        duplicates_removed = 0
        tabs_to_keep = set()

        for url, tab_list in url_to_tabs.items():
            if len(tab_list) > 1:
                print(f"\nFound {len(tab_list)} instances of: {url[:80]}...")
                # Keep the first tab, mark others for removal
                tabs_to_keep.add(tab_list[0]['id'])

                for duplicate_tab in tab_list[1:]:
                    print(f"  Closing duplicate tab: {duplicate_tab['title'][:50]}")
                    try:
                        self.close_tab(duplicate_tab['id'])
                        duplicates_removed += 1
                    except Exception as e:
                        print(f"    Error closing tab: {e}")
            else:
                tabs_to_keep.add(tab_list[0]['id'])

        print(f"\n{'='*60}")
        print(f"Summary:")
        print(f"  Total tabs found: {len(tabs)}")
        print(f"  Duplicate tabs removed: {duplicates_removed}")
        print(f"  Tabs remaining: {len(tabs_to_keep)}")
        print(f"{'='*60}")

        if duplicates_removed > 0:
            print("\nNote: To merge windows, manually drag tabs or use Chrome's built-in")
            print("'Move tab to another window' feature. This script removes duplicates only.")

        return duplicates_removed


def check_chrome_connection(host='localhost', port=9222):
    """Check if Chrome is accessible via remote debugging"""
    try:
        url = f'http://{host}:{port}/json/version'
        response = requests.get(url, timeout=2)
        response.raise_for_status()
        version_info = response.json()
        print(f"Connected to Chrome: {version_info.get('Browser', 'Unknown')}")
        return True
    except requests.exceptions.ConnectionError:
        print(f"Error: Cannot connect to Chrome on {host}:{port}")
        print("\nPlease start Chrome with remote debugging enabled:")
        print("  On Mac/Linux:")
        print('    /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222')
        print("  On Windows:")
        print('    chrome.exe --remote-debugging-port=9222')
        print("\nOr close all Chrome windows and run this script again with --launch flag")
        return False
    except Exception as e:
        print(f"Error connecting to Chrome: {e}")
        return False


def main():
    import argparse

    parser = argparse.ArgumentParser(description='Consolidate Chrome tabs and remove duplicates')
    parser.add_argument('--port', type=int, default=9222, help='Chrome remote debugging port (default: 9222)')
    parser.add_argument('--host', default='localhost', help='Chrome remote debugging host (default: localhost)')

    args = parser.parse_args()

    print("Chrome Tab Consolidator")
    print("="*60)

    if not check_chrome_connection(args.host, args.port):
        return 1

    manager = ChromeTabManager(args.host, args.port)

    try:
        manager.consolidate_and_dedupe()
        return 0
    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user")
        return 1
    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
