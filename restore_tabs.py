#!/usr/bin/env python3
"""
Chrome Tab Restore Tool
Restores tabs from a backup JSON file into a Chrome instance with debugging enabled.
"""

import json
import sys
import time
import requests
import websocket
from typing import List, Dict


class ChromeTabRestorer:
    def __init__(self, host='localhost', port=9222):
        self.host = host
        self.port = port
        self.base_url = f'http://{host}:{port}'

    def check_connection(self):
        """Check if Chrome debugging is accessible"""
        try:
            url = f'{self.base_url}/json/version'
            response = requests.get(url, timeout=2)
            response.raise_for_status()
            return True
        except Exception as e:
            print(f"Error: Cannot connect to Chrome at {self.base_url}")
            print(f"Details: {e}")
            return False

    def get_existing_tabs(self) -> List[Dict]:
        """Get all currently open tabs"""
        url = f'{self.base_url}/json/list'
        response = requests.get(url)
        response.raise_for_status()
        return [tab for tab in response.json() if tab['type'] == 'page']

    def create_tab(self, url: str) -> Dict:
        """Create a new tab and navigate it to the given URL"""
        # First create a blank tab
        create_url = f'{self.base_url}/json/new'
        response = requests.put(create_url)
        response.raise_for_status()
        tab_info = response.json()

        # Navigate the tab using Chrome DevTools Protocol via WebSocket
        ws_url = tab_info.get('webSocketDebuggerUrl')
        if ws_url:
            try:
                ws = websocket.create_connection(ws_url, timeout=5)

                # Send Page.navigate command
                navigate_cmd = {
                    "id": 1,
                    "method": "Page.navigate",
                    "params": {"url": url}
                }
                ws.send(json.dumps(navigate_cmd))

                # Wait for response
                response = ws.recv()
                ws.close()

            except Exception as e:
                # If WebSocket fails, at least we have the tab
                print(f"    Warning: Could not navigate tab: {e}")

        return tab_info

    def close_tab(self, tab_id: str):
        """Close a specific tab"""
        url = f'{self.base_url}/json/close/{tab_id}'
        response = requests.get(url)
        response.raise_for_status()

    def restore_tabs(self, backup_file='chrome_tabs_backup.json'):
        """Restore tabs from a backup file"""

        print("Chrome Tab Restore Tool")
        print("=" * 60)

        # Check connection
        if not self.check_connection():
            print("\nPlease ensure Chrome is running with remote debugging:")
            print("  make chrome-restart")
            return False

        # Load backup
        try:
            with open(backup_file, 'r', encoding='utf-8') as f:
                backup_data = json.load(f)
        except FileNotFoundError:
            print(f"\nError: Backup file not found: {backup_file}")
            print("Run 'make backup-tabs' first to create a backup.")
            return False
        except json.JSONDecodeError as e:
            print(f"\nError: Invalid JSON in backup file: {e}")
            return False

        tabs_to_restore = backup_data.get('tabs', [])

        if not tabs_to_restore:
            print("\nError: No tabs found in backup file")
            return False

        print(f"\nFound backup with {len(tabs_to_restore)} tabs")
        print(f"Backup created: {backup_data.get('backup_timestamp', 'unknown')}")

        # Get existing tabs (usually just the initial blank tab)
        existing_tabs = self.get_existing_tabs()
        print(f"\nCurrently open tabs: {len(existing_tabs)}")

        # Restore tabs
        print(f"\nRestoring {len(tabs_to_restore)} tabs...")
        restored_count = 0
        failed_count = 0

        for i, tab in enumerate(tabs_to_restore, 1):
            url = tab.get('url', '')
            title = tab.get('title', 'Untitled')

            # Skip invalid URLs
            if not url or url.startswith('chrome://') or url.startswith('chrome-extension://'):
                print(f"  [{i}/{len(tabs_to_restore)}] Skipping: {url}")
                continue

            try:
                self.create_tab(url)
                restored_count += 1

                # Show progress every 10 tabs
                if restored_count % 10 == 0:
                    print(f"  Progress: {restored_count}/{len(tabs_to_restore)} tabs restored...")

                # Small delay to avoid overwhelming Chrome
                time.sleep(0.1)

            except Exception as e:
                failed_count += 1
                print(f"  [{i}/{len(tabs_to_restore)}] Failed to restore: {title[:50]}")
                print(f"      Error: {e}")

        # Close the initial blank tab(s) if we restored tabs successfully
        if restored_count > 0 and existing_tabs:
            print("\nClosing initial blank tabs...")
            for tab in existing_tabs:
                try:
                    # Only close if it's the initial new tab page
                    if tab.get('url', '').startswith('chrome://newtab') or \
                       tab.get('url', '') == 'about:blank' or \
                       tab.get('url', '') == '':
                        self.close_tab(tab['id'])
                except Exception as e:
                    print(f"  Could not close tab: {e}")

        print(f"\n{'=' * 60}")
        print(f"Restore Summary:")
        print(f"  Total tabs in backup: {len(tabs_to_restore)}")
        print(f"  Successfully restored: {restored_count}")
        print(f"  Failed: {failed_count}")
        print(f"  Skipped (chrome:// URLs): {len(tabs_to_restore) - restored_count - failed_count}")
        print(f"{'=' * 60}")

        return restored_count > 0


def main():
    import argparse

    parser = argparse.ArgumentParser(description='Restore Chrome tabs from backup')
    parser.add_argument('-i', '--input', default='chrome_tabs_backup.json',
                       help='Backup file to restore from (default: chrome_tabs_backup.json)')
    parser.add_argument('--port', type=int, default=9222,
                       help='Chrome remote debugging port (default: 9222)')
    parser.add_argument('--host', default='localhost',
                       help='Chrome remote debugging host (default: localhost)')

    args = parser.parse_args()

    restorer = ChromeTabRestorer(args.host, args.port)
    success = restorer.restore_tabs(args.input)

    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())
