/**
 * Unit Tests for organizeTabs function
 *
 * Tests the tab organization logic including:
 * - Domain-based grouping
 * - Category-based grouping
 * - Edge cases (empty tabs, single tabs, chrome URLs)
 * - Error scenarios
 * - Sorting and grouping logic
 */

// Mock Chrome APIs
global.chrome = {
  tabs: {
    query: jest.fn(),
    group: jest.fn(),
    ungroup: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    TAB_GROUP_ID_NONE: -1
  },
  tabGroups: {
    query: jest.fn(),
    update: jest.fn(),
    TAB_GROUP_ID_NONE: -1
  },
  bookmarks: {
    get: jest.fn(),
    getChildren: jest.fn(),
    create: jest.fn()
  },
  windows: {
    WINDOW_ID_CURRENT: 1
  },
  runtime: {
    onMessage: {
      addListener: jest.fn()
    }
  }
};

// Mock console to suppress expected error messages in tests
global.console = {
  log: jest.fn(),
  error: jest.fn()
};

// Import functions from background.js
const { organizeTabs } = require('./background.js');

describe('organizeTabs', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    colorIndex = 0;
  });

  describe('Domain Mode', () => {
    test('should group tabs by domain with multiple tabs per domain', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: -1 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: -1 },
        { id: 3, url: 'https://example.com/page1', title: 'Page 1', groupId: -1 },
        { id: 4, url: 'https://example.com/page2', title: 'Page 2', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValueOnce(1).mockResolvedValueOnce(2);

      const result = await organizeTabs('domain');

      expect(result.totalTabs).toBe(4);
      expect(result.groupedTabs).toBe(4);
      expect(result.groups).toBe(2);
      expect(result.ungroupedTabs).toBe(0);

      expect(chrome.tabs.group).toHaveBeenCalledTimes(2);
      expect(chrome.tabGroups.update).toHaveBeenCalledTimes(2);
    });

    test('should not group tabs with only one tab per domain', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com', title: 'GitHub', groupId: -1 },
        { id: 2, url: 'https://example.com', title: 'Example', groupId: -1 },
        { id: 3, url: 'https://google.com', title: 'Google', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);

      const result = await organizeTabs('domain');

      expect(result.totalTabs).toBe(3);
      expect(result.groupedTabs).toBe(0);
      expect(result.groups).toBe(0);
      expect(result.ungroupedTabs).toBe(3);

      expect(chrome.tabs.group).not.toHaveBeenCalled();
    });

    test('should skip chrome internal URLs', async () => {
      const mockTabs = [
        { id: 1, url: 'chrome://extensions/', title: 'Extensions', groupId: -1 },
        { id: 2, url: 'chrome-extension://abc/popup.html', title: 'Extension', groupId: -1 },
        { id: 3, url: 'about:blank', title: 'Blank', groupId: -1 },
        { id: 4, url: 'https://github.com/repo1', title: 'Repo 1', groupId: -1 },
        { id: 5, url: 'https://github.com/repo2', title: 'Repo 2', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValue(1);

      const result = await organizeTabs('domain');

      expect(result.totalTabs).toBe(5);
      expect(result.groupedTabs).toBe(2);
      expect(result.groups).toBe(1);
    });

    test('should handle empty tab list', async () => {
      chrome.tabs.query.mockResolvedValue([]);

      const result = await organizeTabs('domain');

      expect(result.totalTabs).toBe(0);
      expect(result.groupedTabs).toBe(0);
      expect(result.groups).toBe(0);
      expect(result.ungroupedTabs).toBe(0);

      expect(chrome.tabs.group).not.toHaveBeenCalled();
    });

    test('should sort tabs within groups alphabetically by title', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com/zzz', title: 'ZZZ Repo', groupId: -1 },
        { id: 2, url: 'https://github.com/aaa', title: 'AAA Repo', groupId: -1 },
        { id: 3, url: 'https://github.com/mmm', title: 'MMM Repo', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValue(1);

      await organizeTabs('domain');

      expect(chrome.tabs.group).toHaveBeenCalledWith({
        tabIds: [2, 3, 1] // Sorted: AAA, MMM, ZZZ
      });
    });

    test('should ungroup existing grouped tabs before regrouping', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: 5 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: 5 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValue(1);

      await organizeTabs('domain');

      expect(chrome.tabs.ungroup).toHaveBeenCalledTimes(2);
      expect(chrome.tabs.ungroup).toHaveBeenCalledWith(1);
      expect(chrome.tabs.ungroup).toHaveBeenCalledWith(2);
    });

    test('should handle www prefix removal in domain grouping', async () => {
      const mockTabs = [
        { id: 1, url: 'https://www.github.com/repo1', title: 'Repo 1', groupId: -1 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValue(1);

      await organizeTabs('domain');

      expect(chrome.tabGroups.update).toHaveBeenCalledWith(1, {
        title: 'github.com (2)',
        color: 'blue',
        collapsed: false
      });
    });

    test('should group localhost and local IPs separately', async () => {
      const mockTabs = [
        { id: 1, url: 'http://localhost:3000/page1', title: 'Local 1', groupId: -1 },
        { id: 2, url: 'http://localhost:8080/page2', title: 'Local 2', groupId: -1 },
        { id: 3, url: 'http://192.168.1.1/admin', title: 'Router 1', groupId: -1 },
        { id: 4, url: 'http://192.168.1.2/admin', title: 'Router 2', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValueOnce(1).mockResolvedValueOnce(2);

      await organizeTabs('domain');

      expect(chrome.tabs.group).toHaveBeenCalledTimes(2);
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(1, {
        title: 'localhost (2)',
        color: 'blue',
        collapsed: false
      });
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(2, {
        title: 'local-network (2)',
        color: 'red',
        collapsed: false
      });
    });
  });

  describe('Category Mode', () => {
    test('should group tabs by category', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: -1 },
        { id: 2, url: 'https://stackoverflow.com/q/123', title: 'Question', groupId: -1 },
        { id: 3, url: 'https://twitter.com/user', title: 'Twitter', groupId: -1 },
        { id: 4, url: 'https://facebook.com/page', title: 'Facebook', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValueOnce(1).mockResolvedValueOnce(2);

      const result = await organizeTabs('category');

      expect(result.groupedTabs).toBe(4);
      expect(result.groups).toBe(2);

      expect(chrome.tabGroups.update).toHaveBeenCalledWith(1, {
        title: 'Development (2)',
        color: 'blue',
        collapsed: false
      });
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(2, {
        title: 'Social Media (2)',
        color: 'red',
        collapsed: false
      });
    });

    test('should categorize documentation sites correctly', async () => {
      const mockTabs = [
        { id: 1, url: 'https://docs.example.com/guide', title: 'Guide', groupId: -1 },
        { id: 2, url: 'https://developer.mozilla.org/docs', title: 'MDN', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValue(1);

      await organizeTabs('category');

      expect(chrome.tabGroups.update).toHaveBeenCalledWith(1, {
        title: 'Documentation (2)',
        color: 'blue',
        collapsed: false
      });
    });

    test('should group uncategorized tabs as "Other"', async () => {
      const mockTabs = [
        { id: 1, url: 'https://random-site.com/page', title: 'Random', groupId: -1 },
        { id: 2, url: 'https://another-site.org/info', title: 'Another', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValue(1);

      await organizeTabs('category');

      expect(chrome.tabGroups.update).toHaveBeenCalledWith(1, {
        title: 'Other (2)',
        color: 'blue',
        collapsed: false
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle tabs with invalid URLs gracefully', async () => {
      const mockTabs = [
        { id: 1, url: 'not-a-valid-url', title: 'Invalid', groupId: -1 },
        { id: 2, url: 'https://github.com/repo1', title: 'Repo 1', groupId: -1 },
        { id: 3, url: 'https://github.com/repo2', title: 'Repo 2', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValue(1);

      const result = await organizeTabs('domain');

      expect(result.groupedTabs).toBe(2);
      expect(result.groups).toBe(1);
    });

    test('should handle missing tab titles', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com/repo1', title: '', groupId: -1 },
        { id: 2, url: 'https://github.com/repo2', title: null, groupId: -1 },
        { id: 3, url: 'https://github.com/repo3', title: undefined, groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValue(1);

      await expect(organizeTabs('domain')).resolves.not.toThrow();
    });

    test('should handle very long domain names', async () => {
      const longDomain = 'a'.repeat(200) + '.com';
      const mockTabs = [
        { id: 1, url: `https://${longDomain}/page1`, title: 'Page 1', groupId: -1 },
        { id: 2, url: `https://${longDomain}/page2`, title: 'Page 2', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValue(1);

      const result = await organizeTabs('domain');

      expect(result.groupedTabs).toBe(2);
    });

    test('should handle tabs with special characters in titles', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com/repo1', title: 'Repo <>&"\'', groupId: -1 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 🚀🎉', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValue(1);

      await expect(organizeTabs('domain')).resolves.not.toThrow();
    });
  });

  describe('Error Scenarios', () => {
    test('should handle chrome.tabs.query errors', async () => {
      chrome.tabs.query.mockRejectedValue(new Error('Query failed'));

      await expect(organizeTabs('domain')).rejects.toThrow('Query failed');
    });

    test('should continue if chrome.tabs.ungroup fails', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: 5 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: 5 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.ungroup.mockRejectedValue(new Error('Ungroup failed'));
      chrome.tabs.group.mockResolvedValue(1);

      const result = await organizeTabs('domain');

      expect(result.groupedTabs).toBe(2);
      expect(chrome.tabs.group).toHaveBeenCalled();
    });

    test('should handle chrome.tabs.group errors gracefully', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: -1 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: -1 },
        { id: 3, url: 'https://example.com/page1', title: 'Page 1', groupId: -1 },
        { id: 4, url: 'https://example.com/page2', title: 'Page 2', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockRejectedValueOnce(new Error('Group failed')).mockResolvedValueOnce(2);

      const result = await organizeTabs('domain');

      // Should still group the second domain even if first fails
      expect(result.groupedTabs).toBe(2);
      expect(result.groups).toBe(2); // Both domains are in sortedGroups, even if one failed to create
    });

    test('should handle chrome.tabGroups.update errors gracefully', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: -1 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValue(1);
      chrome.tabGroups.update.mockRejectedValue(new Error('Update failed'));

      // Should not throw, just log error
      await expect(organizeTabs('domain')).resolves.not.toThrow();
    });

    test('should handle invalid mode parameter', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: -1 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValue(1);
      chrome.tabGroups.update.mockResolvedValue(undefined);

      // Should default to domain mode (both URLs are github.com)
      const result = await organizeTabs('invalid-mode');

      expect(result.groupedTabs).toBe(2);
      expect(chrome.tabs.group).toHaveBeenCalled();
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(1, expect.objectContaining({
        title: expect.stringContaining('github.com')
      }));
    });
  });

  describe('Sorting and Grouping Logic', () => {
    test('should sort groups by tab count (most tabs first)', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com/r1', title: 'R1', groupId: -1 },
        { id: 2, url: 'https://github.com/r2', title: 'R2', groupId: -1 },
        { id: 3, url: 'https://example.com/p1', title: 'P1', groupId: -1 },
        { id: 4, url: 'https://example.com/p2', title: 'P2', groupId: -1 },
        { id: 5, url: 'https://example.com/p3', title: 'P3', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValueOnce(1).mockResolvedValueOnce(2);

      await organizeTabs('domain');

      // example.com (3 tabs) should be grouped first
      const firstCall = chrome.tabs.group.mock.calls[0][0];
      expect(firstCall.tabIds.length).toBe(3);
    });

    test('should assign colors in rotation', async () => {
      const mockTabs = [];

      // Create 10 different domains with 2 tabs each
      for (let i = 0; i < 10; i++) {
        mockTabs.push(
          { id: i * 2, url: `https://domain${i}.com/page1`, title: 'Page 1', groupId: -1 },
          { id: i * 2 + 1, url: `https://domain${i}.com/page2`, title: 'Page 2', groupId: -1 }
        );
      }

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockImplementation(() => Promise.resolve(Math.random()));

      await organizeTabs('domain');

      const updateCalls = chrome.tabGroups.update.mock.calls;

      // First 8 should use unique colors
      expect(updateCalls[0][1].color).toBe('blue');
      expect(updateCalls[1][1].color).toBe('red');
      expect(updateCalls[7][1].color).toBe('orange');

      // 9th and 10th should cycle back
      expect(updateCalls[8][1].color).toBe('blue');
      expect(updateCalls[9][1].color).toBe('red');
    });

    test('should include tab count in group title', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com/r1', title: 'R1', groupId: -1 },
        { id: 2, url: 'https://github.com/r2', title: 'R2', groupId: -1 },
        { id: 3, url: 'https://github.com/r3', title: 'R3', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValue(1);

      await organizeTabs('domain');

      expect(chrome.tabGroups.update).toHaveBeenCalledWith(1, {
        title: 'github.com (3)',
        color: 'blue',
        collapsed: false
      });
    });
  });
});
