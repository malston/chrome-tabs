#!/usr/bin/env python3
"""
Chrome Tab Organizer
Groups tabs by domain or category using Chrome DevTools Protocol.
"""

import json
import sys
import time
import requests
import websocket
from typing import List, Dict, Set
from urllib.parse import urlparse
from collections import defaultdict


class ChromeTabOrganizer:
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

    def get_all_tabs(self) -> List[Dict]:
        """Get all open tabs from all windows"""
        url = f'{self.base_url}/json/list'
        response = requests.get(url)
        response.raise_for_status()

        tabs = response.json()
        # Filter to only include pages (not extensions, etc.)
        return [tab for tab in tabs if tab['type'] == 'page']

    def activate_tab(self, tab_id: str):
        """Activate/focus a specific tab"""
        try:
            url = f'{self.base_url}/json/activate/{tab_id}'
            requests.get(url, timeout=2)
            return True
        except Exception:
            return False

    def move_tab_to_position(self, tab_id: str, position: int):
        """Move a tab to a specific position using DevTools Protocol"""
        tabs = self.get_all_tabs()
        tab = next((t for t in tabs if t['id'] == tab_id), None)

        if not tab:
            return False

        ws_url = tab.get('webSocketDebuggerUrl')
        if not ws_url:
            return False

        try:
            ws = websocket.create_connection(ws_url, timeout=5)

            # Unfortunately, there's no direct API to reorder tabs
            # We'll have to close and recreate, which loses history
            # So instead, we'll just provide guidance
            ws.close()
            return False

        except Exception:
            return False

    def extract_domain(self, url: str) -> str:
        """Extract domain from URL"""
        try:
            parsed = urlparse(url)
            domain = parsed.netloc or parsed.path

            # Remove www. prefix
            if domain.startswith('www.'):
                domain = domain[4:]

            # Handle localhost with ports
            if domain.startswith('localhost'):
                return 'localhost'

            # Handle IP addresses
            if domain.replace('.', '').replace(':', '').isdigit():
                # Group all private IPs together
                if domain.startswith('192.168.') or domain.startswith('172.') or domain.startswith('10.'):
                    return 'local-network'
                return 'ip-addresses'

            return domain

        except Exception:
            return 'unknown'

    def organize_by_domain(self):
        """Organize tabs by grouping them by domain"""

        print("Chrome Tab Organizer - Group by Domain")
        print("=" * 60)

        # Check connection
        if not self.check_connection():
            print("\nPlease ensure Chrome is running with remote debugging:")
            print("  make chrome-restart")
            return False

        # Get all tabs
        tabs = self.get_all_tabs()

        if not tabs:
            print("No tabs found.")
            return False

        print(f"\nFound {len(tabs)} tabs")

        # Skip chrome:// and about: URLs
        valid_tabs = []
        for tab in tabs:
            url = tab.get('url', '')
            if url and not url.startswith('chrome://') and not url.startswith('chrome-extension://') and url != 'about:blank':
                valid_tabs.append(tab)

        print(f"Organizing {len(valid_tabs)} tabs (skipping {len(tabs) - len(valid_tabs)} chrome:// and blank tabs)")

        # Group tabs by domain
        domain_groups = defaultdict(list)
        for tab in valid_tabs:
            url = tab.get('url', '')
            domain = self.extract_domain(url)
            domain_groups[domain].append(tab)

        # Sort domains by tab count (most tabs first)
        sorted_domains = sorted(domain_groups.items(), key=lambda x: len(x[1]), reverse=True)

        print(f"\nFound {len(sorted_domains)} unique domains:")
        print("")

        for domain, tabs_list in sorted_domains:
            print(f"  {domain:40s} - {len(tabs_list):3d} tabs")

        print(f"\n{'=' * 60}")
        print("\nNote: Chrome's Tab Groups API is not fully accessible via")
        print("the DevTools Protocol. Manual grouping is recommended:")
        print("")
        print("To manually group tabs by domain:")
        print("  1. Right-click on a tab")
        print("  2. Select 'Add tab to group' > 'New group'")
        print("  3. Name the group (e.g., 'github.com')")
        print("  4. Drag similar tabs into the group")
        print("")
        print("Or use Chrome's built-in tab search (Ctrl+Shift+A / Cmd+Shift+A)")
        print("to find tabs by domain and organize them.")
        print("")

        # Create a report file
        report_file = 'tabs_by_domain_report.json'
        report = {
            'total_tabs': len(valid_tabs),
            'total_domains': len(sorted_domains),
            'domains': []
        }

        for domain, tabs_list in sorted_domains:
            domain_info = {
                'domain': domain,
                'tab_count': len(tabs_list),
                'tabs': []
            }

            for tab in tabs_list:
                domain_info['tabs'].append({
                    'title': tab.get('title', 'Untitled'),
                    'url': tab.get('url', '')
                })

            report['domains'].append(domain_info)

        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        print(f"✓ Domain grouping report saved to: {report_file}")
        print(f"  Use this report to manually group your tabs")

        return True

    def interactive_organize(self):
        """Interactive mode to help organize tabs by domain"""

        print("Chrome Tab Organizer - Interactive Mode")
        print("=" * 60)

        # Check connection
        if not self.check_connection():
            print("\nPlease ensure Chrome is running with remote debugging:")
            print("  make chrome-restart")
            return False

        # Get all tabs
        tabs = self.get_all_tabs()

        if not tabs:
            print("No tabs found.")
            return False

        print(f"\nFound {len(tabs)} tabs")

        # Skip chrome:// and about: URLs
        valid_tabs = []
        for tab in tabs:
            url = tab.get('url', '')
            if url and not url.startswith('chrome://') and not url.startswith('chrome-extension://') and url != 'about:blank':
                valid_tabs.append(tab)

        print(f"Organizing {len(valid_tabs)} tabs")

        # Group tabs by domain
        domain_groups = defaultdict(list)
        for tab in valid_tabs:
            url = tab.get('url', '')
            domain = self.extract_domain(url)
            domain_groups[domain].append(tab)

        # Sort domains by tab count (most tabs first)
        sorted_domains = sorted(domain_groups.items(), key=lambda x: len(x[1]), reverse=True)

        print(f"\n{'=' * 60}")
        print("INTERACTIVE GROUPING GUIDE")
        print(f"{'=' * 60}\n")

        print("I'll help you group your tabs step by step.")
        print("For each domain with multiple tabs, I'll:")
        print("  1. Show you the tabs")
        print("  2. Highlight the first tab")
        print("  3. Wait for you to manually group them\n")

        input("Press Enter to start...")

        grouped_count = 0
        for domain, tabs_list in sorted_domains:
            if len(tabs_list) <= 1:
                continue  # Skip domains with only 1 tab

            print(f"\n{'-' * 60}")
            print(f"Domain: {domain} ({len(tabs_list)} tabs)")
            print(f"{'-' * 60}")

            # Show all tabs for this domain
            for i, tab in enumerate(tabs_list, 1):
                title = tab.get('title', 'Untitled')[:60]
                print(f"  {i}. {title}")

            print(f"\nNow I'll highlight the first {domain} tab...")

            # Activate the first tab of this domain
            if tabs_list:
                self.activate_tab(tabs_list[0]['id'])
                time.sleep(0.5)

            print(f"\n✓ First tab highlighted in browser")
            print(f"\nTo group these {len(tabs_list)} tabs:")
            print(f"  1. Right-click on the highlighted tab")
            print(f"  2. Select 'Add tab to group' > 'New group'")
            print(f"  3. Name it: '{domain}'")
            print(f"  4. Manually drag the other {len(tabs_list) - 1} tabs into this group")
            print(f"     (Use Cmd+Click to select multiple tabs)")

            response = input(f"\nPress Enter when done (or 's' to skip this domain)... ")

            if response.lower() != 's':
                grouped_count += 1

        print(f"\n{'=' * 60}")
        print(f"Interactive grouping complete!")
        print(f"  Domains processed: {grouped_count}")
        print(f"{'=' * 60}\n")

        return True


def main():
    import argparse

    parser = argparse.ArgumentParser(description='Organize Chrome tabs')
    parser.add_argument('--mode', choices=['domain', 'category', 'interactive'], default='domain',
                       help='Organization mode (default: domain)')
    parser.add_argument('--port', type=int, default=9222,
                       help='Chrome remote debugging port (default: 9222)')
    parser.add_argument('--host', default='localhost',
                       help='Chrome remote debugging host (default: localhost)')

    args = parser.parse_args()

    organizer = ChromeTabOrganizer(args.host, args.port)

    if args.mode == 'domain':
        success = organizer.organize_by_domain()
    elif args.mode == 'interactive':
        success = organizer.interactive_organize()
    elif args.mode == 'category':
        print(f"Mode '{args.mode}' not yet implemented")
        success = False
    else:
        print(f"Mode '{args.mode}' not yet implemented")
        success = False

    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())
