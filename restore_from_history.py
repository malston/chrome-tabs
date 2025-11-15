#!/usr/bin/env python3
"""
Chrome History Restore Tool
Restores tabs from Chrome's browsing history database.
"""

import json
import os
import shutil
import sqlite3
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict

import requests
import websocket


class ChromeHistoryRestorer:
    def __init__(self, host='localhost', port=9222):
        self.host = host
        self.port = port
        self.base_url = f'http://{host}:{port}'

    def find_chrome_profile_dir(self):
        """Find the Chrome profile directory"""
        home = Path.home()

        # macOS
        chrome_dir = home / "Library/Application Support/Google/Chrome/Default"
        if chrome_dir.exists():
            return chrome_dir

        # Linux
        chrome_dir = home / ".config/google-chrome/Default"
        if chrome_dir.exists():
            return chrome_dir

        # Windows
        chrome_dir = Path(os.environ.get('LOCALAPPDATA', '')) / "Google/Chrome/User Data/Default"
        if chrome_dir.exists():
            return chrome_dir

        return None

    def get_history_from_db(self, days=7, limit=200):
        """Read browsing history from Chrome's SQLite database"""

        profile_dir = self.find_chrome_profile_dir()
        if not profile_dir:
            print("Error: Could not find Chrome profile directory")
            return None

        history_db = profile_dir / "History"
        if not history_db.exists():
            print(f"Error: History database not found at {history_db}")
            return None

        # Copy the database to avoid locking issues
        temp_db = Path("/tmp/chrome_history_temp.db")
        try:
            shutil.copy2(history_db, temp_db)
        except Exception as e:
            print(f"Error copying history database: {e}")
            print("Make sure Chrome is closed or use the main profile Chrome")
            return None

        try:
            conn = sqlite3.connect(temp_db)
            cursor = conn.cursor()

            # Calculate timestamp for X days ago
            # Chrome stores timestamps as microseconds since 1601-01-01
            epoch_start = datetime(1601, 1, 1)
            cutoff_date = datetime.now() - timedelta(days=days)
            cutoff_timestamp = int((cutoff_date - epoch_start).total_seconds() * 1000000)

            # Query recent history
            query = """
            SELECT url, title, last_visit_time, visit_count
            FROM urls
            WHERE last_visit_time > ?
            ORDER BY last_visit_time DESC
            LIMIT ?
            """

            cursor.execute(query, (cutoff_timestamp, limit))
            rows = cursor.fetchall()

            history = []
            for row in rows:
                url, title, last_visit_time, visit_count = row

                # Convert Chrome timestamp to datetime
                visit_datetime = epoch_start + timedelta(microseconds=last_visit_time)

                # Skip chrome:// URLs
                if url.startswith('chrome://') or url.startswith('chrome-extension://'):
                    continue

                history.append({
                    'url': url,
                    'title': title or 'Untitled',
                    'last_visit': visit_datetime.isoformat(),
                    'visit_count': visit_count
                })

            conn.close()
            temp_db.unlink()  # Delete temp file

            return history

        except Exception as e:
            print(f"Error reading history database: {e}")
            if temp_db.exists():
                temp_db.unlink()
            return None

    def check_connection(self):
        """Check if Chrome debugging is accessible"""
        try:
            url = f'{self.base_url}/json/version'
            response = requests.get(url, timeout=2)
            response.raise_for_status()
            return True
        except Exception:
            print(f"Error: Cannot connect to Chrome at {self.base_url}")
            return False

    def create_tab(self, url: str) -> Dict:
        """Create a new tab and navigate it to the given URL"""
        create_url = f'{self.base_url}/json/new'
        response = requests.put(create_url)
        response.raise_for_status()
        tab_info = response.json()

        ws_url = tab_info.get('webSocketDebuggerUrl')
        if ws_url:
            try:
                ws = websocket.create_connection(ws_url, timeout=5)
                navigate_cmd = {
                    "id": 1,
                    "method": "Page.navigate",
                    "params": {"url": url}
                }
                ws.send(json.dumps(navigate_cmd))
                ws.recv()
                ws.close()
            except Exception as e:
                print(f"    Warning: Could not navigate tab: {e}")

        return tab_info

    def restore_from_history(self, days=7, limit=200, interactive=True):
        """Restore tabs from browsing history"""

        print("Chrome History Restore Tool")
        print("=" * 60)

        # Check connection
        if not self.check_connection():
            print("\nPlease ensure Chrome is running with remote debugging:")
            print("  make chrome-restart")
            return False

        # Get history
        print(f"\nReading Chrome history (last {days} days, max {limit} entries)...")
        history = self.get_history_from_db(days, limit)

        if not history:
            return False

        print(f"Found {len(history)} URLs in history")

        if interactive:
            print("\nMost recent pages:")
            for i, entry in enumerate(history[:20], 1):
                title = entry['title'][:60]
                url = entry['url'][:60]
                print(f"  {i:3d}. {title}")
                print(f"       {url}")

            print(f"\n... and {len(history) - 20} more" if len(history) > 20 else "")

            response = input(f"\nRestore all {len(history)} tabs? [y/N] ")
            if response.lower() != 'y':
                print("Cancelled.")
                return False

        # Restore tabs
        print(f"\nRestoring {len(history)} tabs from history...")
        restored_count = 0
        failed_count = 0

        for i, entry in enumerate(history, 1):
            url = entry['url']
            title = entry['title']

            try:
                self.create_tab(url)
                restored_count += 1

                if restored_count % 10 == 0:
                    print(f"  Progress: {restored_count}/{len(history)} tabs restored...")

                time.sleep(0.1)

            except Exception:
                failed_count += 1
                print(f"  [{i}/{len(history)}] Failed to restore: {title[:50]}")

        print(f"\n{'=' * 60}")
        print(f"Restore Summary:")
        print(f"  Total URLs in history: {len(history)}")
        print(f"  Successfully restored: {restored_count}")
        print(f"  Failed: {failed_count}")
        print(f"{'=' * 60}")

        return restored_count > 0


def main():
    import argparse

    parser = argparse.ArgumentParser(description='Restore Chrome tabs from history')
    parser.add_argument('--days', type=int, default=7,
                       help='Number of days of history to retrieve (default: 7)')
    parser.add_argument('--limit', type=int, default=200,
                       help='Maximum number of URLs to restore (default: 200)')
    parser.add_argument('--yes', '-y', action='store_true',
                       help='Skip confirmation prompt')
    parser.add_argument('--port', type=int, default=9222,
                       help='Chrome remote debugging port (default: 9222)')
    parser.add_argument('--host', default='localhost',
                       help='Chrome remote debugging host (default: localhost)')

    args = parser.parse_args()

    restorer = ChromeHistoryRestorer(args.host, args.port)
    success = restorer.restore_from_history(
        days=args.days,
        limit=args.limit,
        interactive=not args.yes
    )

    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())
