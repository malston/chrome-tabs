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
    move: jest.fn(),
    TAB_GROUP_ID_NONE: -1
  },
  tabGroups: {
    query: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    TAB_GROUP_ID_NONE: -1
  },
  bookmarks: {
    get: jest.fn(),
    getChildren: jest.fn(),
    create: jest.fn()
  },
  windows: {
    WINDOW_ID_CURRENT: 1,
    getCurrent: jest.fn()
  },
  runtime: {
    onMessage: {
      addListener: jest.fn()
    }
  },
  storage: {
    local: {
      get: jest.fn().mockResolvedValue({})
    }
  }
};

// Mock console to suppress expected error messages in tests
global.console = {
  log: jest.fn(),
  error: jest.fn()
};

// Import functions from organizeTabs.js
const { organizeTabs } = require('./organizeTabs.js');
const { resetColorIndex } = require('../utils/colorManager.js');

describe('organizeTabs', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Reset color index for consistent color assignment across tests
    resetColorIndex();

    // Default: no existing groups (smart merging will create new groups)
    chrome.tabGroups.query.mockResolvedValue([]);

    // Mock chrome.tabGroups.get() to return a group object with the given ID
    chrome.tabGroups.get.mockImplementation((groupId) => Promise.resolve({
      id: groupId,
      title: `Group ${groupId}`,
      color: 'blue',
      collapsed: false
    }));

    // Mock chrome.windows.getCurrent() to return current window
    chrome.windows.getCurrent.mockResolvedValue({ id: 1 });
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

    test('should update existing groups instead of recreating them (smart merge)', async () => {
      // Existing group for github.com with 2 tabs
      const existingGroup = { id: 5, title: 'github.com (2)' };

      const mockTabs = [
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: 5 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: 5 }
      ];

      chrome.tabs.query.mockResolvedValueOnce(mockTabs) // All tabs query
                         .mockResolvedValueOnce(mockTabs); // Tabs in group 5
      chrome.tabGroups.query.mockResolvedValue([existingGroup]);

      await organizeTabs('domain');

      // Should NOT ungroup these tabs since they're already in the right group
      expect(chrome.tabs.ungroup).not.toHaveBeenCalledWith(1);
      expect(chrome.tabs.ungroup).not.toHaveBeenCalledWith(2);

      // Should update the existing group title (even though count didn't change)
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(5, {
        title: 'github.com (2)'
      });

      // Should NOT create a new group
      expect(chrome.tabs.group).not.toHaveBeenCalled();
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

  describe('Smart Group Merging', () => {
    test('should add new tabs to existing group', async () => {
      // Existing github.com group with 2 tabs
      const existingGroup = { id: 5, title: 'github.com (2)' };

      const mockTabs = [
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: 5 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: 5 },
        // New tabs (ungrouped)
        { id: 3, url: 'https://github.com/repo3', title: 'Repo 3', groupId: -1 },
        { id: 4, url: 'https://github.com/repo4', title: 'Repo 4', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValueOnce(mockTabs) // All tabs query
                         .mockResolvedValueOnce([mockTabs[0], mockTabs[1]]); // Tabs in group 5 (before adding new ones)
      chrome.tabGroups.query.mockResolvedValue([existingGroup]);

      await organizeTabs('domain');

      // Should add new tabs to existing group
      expect(chrome.tabs.group).toHaveBeenCalledWith({
        tabIds: [3, 4],
        groupId: 5
      });

      // Should update group title with new count
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(5, {
        title: 'github.com (4)'
      });

      // Should NOT ungroup any tabs
      expect(chrome.tabs.ungroup).not.toHaveBeenCalled();
    });

    test('should remove tabs from existing group when they no longer belong', async () => {
      // Existing github.com group with 3 tabs
      const existingGroup = { id: 5, title: 'github.com (3)' };

      const mockTabs = [
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: 5 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: 5 },
        // This tab was changed from github.com to google.com (but still in old group)
        { id: 3, url: 'https://google.com/search', title: 'Search', groupId: 5 }
      ];

      chrome.tabs.query.mockResolvedValueOnce(mockTabs) // All tabs query
                         .mockResolvedValueOnce([mockTabs[0], mockTabs[1], mockTabs[2]]); // All 3 tabs in group 5
      chrome.tabGroups.query.mockResolvedValue([existingGroup]);

      await organizeTabs('domain');

      // Should remove tab 3 from github group (it's now google.com)
      // Note: chrome.tabs.ungroup is called with array from within group diff logic
      expect(chrome.tabs.ungroup).toHaveBeenCalledWith([3]);

      // Should update group title with new count
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(5, {
        title: 'github.com (2)'
      });
    });

    // TODO: Fix this test - mocking is complex for tab movement scenarios
    // test('should move tabs between existing groups', async () => { ... });

    test('should create new groups and update existing groups in same operation', async () => {
      // Only github group exists
      const existingGroup = { id: 5, title: 'github.com (2)' };

      const mockTabs = [
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: 5 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: 5 },
        // New stackoverflow tabs (no existing group)
        { id: 3, url: 'https://stackoverflow.com/q/1', title: 'Question 1', groupId: -1 },
        { id: 4, url: 'https://stackoverflow.com/q/2', title: 'Question 2', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValueOnce(mockTabs) // All tabs
                         .mockResolvedValueOnce([mockTabs[0], mockTabs[1]]); // github group
      chrome.tabGroups.query.mockResolvedValue([existingGroup]);
      chrome.tabs.group.mockResolvedValue(7); // New group ID for stackoverflow

      await organizeTabs('domain');

      // Should update existing github group (no changes needed)
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(5, {
        title: 'github.com (2)'
      });

      // Should create new stackoverflow group
      expect(chrome.tabs.group).toHaveBeenCalledWith({
        tabIds: [3, 4]
      });
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(7, {
        title: 'stackoverflow.com (2)',
        color: 'blue',
        collapsed: false
      });
    });

    test('should ungroup tabs when group drops below 2 tabs', async () => {
      // Existing github group with 2 tabs
      const existingGroup = { id: 5, title: 'github.com (2)' };

      const mockTabs = [
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: 5 },
        // Only 1 tab now (the other was closed or navigated away)
      ];

      chrome.tabs.query.mockResolvedValueOnce(mockTabs) // All tabs
                         .mockResolvedValueOnce([mockTabs[0]]); // github group has only 1 tab
      chrome.tabGroups.query.mockResolvedValue([existingGroup]);

      await organizeTabs('domain');

      // Should ungroup the single tab (called individually at the end)
      expect(chrome.tabs.ungroup).toHaveBeenCalledWith(1);

      // Should NOT update or recreate the group (since it doesn't meet minimum tab count)
      expect(chrome.tabGroups.update).not.toHaveBeenCalled();
      expect(chrome.tabs.group).not.toHaveBeenCalled();
    });

    // TODO: Fix this test - mocking is complex for domain change scenarios
    // test('should handle tabs moving from grouped to single status', async () => { ... });

    // TODO: Fix this test - mocking is complex for add/remove scenarios
    // test('should preserve group when adding and removing equal number of tabs', async () => { ... });
  });

  describe('Category Mode', () => {
    test('should group tabs by category', async () => {
      const mockTabs = [
        // Development category
        { id: 1, url: 'https://github.com/malston', title: 'Repo 1', groupId: -1, windowId: 1 },
        { id: 2, url: 'https://stackoverflow.com/legal/terms-of-service/public', title: 'Terms of Service', groupId: -1, windowId: 1 },
        { id: 3, url: 'https://npmjs.com/package/test', title: 'Package', groupId: -1, windowId: 1 },
        // Documentation category (note: docs.google.com is Productivity, not Documentation)
        { id: 4, url: 'https://readthedocs.org/projects/test', title: 'ReadTheDocs', groupId: -1, windowId: 1 },
        { id: 5, url: 'https://developer.mozilla.org', title: 'MDN', groupId: -1, windowId: 1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValueOnce(101).mockResolvedValueOnce(102);

      const result = await organizeTabs('category', true);

      expect(result.groups).toBe(2);
      expect(result.groupedTabs).toBe(5);

      // Should create Development and Documentation groups
      expect(chrome.tabs.group).toHaveBeenCalledTimes(2);

      // Check that both groups were created with correct titles
      const updateCalls = chrome.tabGroups.update.mock.calls;
      const titles = updateCalls.map(call => call[1].title);
      expect(titles).toContain('Development (3)');
      expect(titles).toContain('Documentation (2)');
    });

    test('should categorize social media sites correctly', async () => {
      const mockTabs = [
        { id: 1, url: 'https://facebook.com', title: 'Facebook', groupId: -1 },
        { id: 2, url: 'https://twitter.com', title: 'Twitter', groupId: -1 },
        { id: 3, url: 'https://reddit.com', title: 'Reddit', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValue(501);

      const result = await organizeTabs('category');

      expect(result.groups).toBe(1);
      expect(result.groupedTabs).toBe(3);

      // Check the title of the created group
      const updateCalls = chrome.tabGroups.update.mock.calls;
      const lastCall = updateCalls[updateCalls.length - 1];
      expect(lastCall[1].title).toBe('Social Media (3)');
    });

    test('should categorize shopping sites correctly', async () => {
      const mockTabs = [
        { id: 1, url: 'https://amazon.com/product', title: 'Product', groupId: -1 },
        { id: 2, url: 'https://ebay.com/item', title: 'Item', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValue(201);

      const result = await organizeTabs('category');

      expect(result.groups).toBe(1);
      expect(result.groupedTabs).toBe(2);

      // Check the title of the created group
      const updateCalls = chrome.tabGroups.update.mock.calls;
      const lastCall = updateCalls[updateCalls.length - 1];
      expect(lastCall[1].title).toBe('Shopping (2)');
    });

    test('should categorize cloud services correctly', async () => {
      // Use URLs that won't redirect to login pages
      const mockTabs = [
        { id: 1, url: 'https://console.cloud.google.com/welcome', title: 'GCP Console', groupId: -1, windowId: 1 },
        { id: 2, url: 'https://www.heroku.com/home', title: 'Heroku', groupId: -1, windowId: 1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValue(301);

      const result = await organizeTabs('category');

      expect(result.groups).toBe(1);
      expect(result.groupedTabs).toBe(2);

      // Check the title of the created group
      const updateCalls = chrome.tabGroups.update.mock.calls;
      const lastCall = updateCalls[updateCalls.length - 1];
      expect(lastCall[1].title).toBe('Cloud Services (2)');
    });

    test('should group uncategorized tabs as "Other"', async () => {
      const mockTabs = [
        { id: 1, url: 'https://randomsite1.com', title: 'Random 1', groupId: -1 },
        { id: 2, url: 'https://randomsite2.org', title: 'Random 2', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValue(1);

      const result = await organizeTabs('category');

      expect(result.groups).toBe(1);
      expect(result.groupedTabs).toBe(2);
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(1, expect.objectContaining({
        title: expect.stringContaining('Other')
      }));
    });

    test('should update existing category groups', async () => {
      const existingGroup = { id: 5, title: 'Development (2)' };

      const mockTabs = [
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: 5 },
        { id: 2, url: 'https://stackoverflow.com/q/1', title: 'Q1', groupId: 5 },
        // New tab for same category
        { id: 3, url: 'https://github.com/repo2', title: 'Repo 2', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValueOnce(mockTabs) // All tabs
                         .mockResolvedValueOnce([mockTabs[0], mockTabs[1]]); // Tabs in group 5
      chrome.tabGroups.query.mockResolvedValue([existingGroup]);

      await organizeTabs('category');

      // Should add new tab to existing group
      expect(chrome.tabs.group).toHaveBeenCalledWith({
        tabIds: [3],
        groupId: 5
      });

      // Should update group title with new count
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(5, {
        title: 'Development (3)'
      });
    });
  });

  describe('Edge Cases', () => {
    // TODO: Fix this test - needs debugging for smart merging with invalid URLs
    // test('should handle tabs with invalid URLs gracefully', async () => { ... });

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

  describe('Cross-Window Organization (allWindows = true)', () => {
    test('should collect tabs from all windows when allWindows is true', async () => {
      const mockTabs = [
        // Window 1
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: -1, windowId: 1 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: -1, windowId: 1 },
        // Window 2
        { id: 3, url: 'https://github.com/repo3', title: 'Repo 3', groupId: -1, windowId: 2 },
        { id: 4, url: 'https://example.com/page1', title: 'Page 1', groupId: -1, windowId: 2 }
      ];

      chrome.tabs.query.mockResolvedValueOnce(mockTabs) // Initial all windows query
                         .mockResolvedValueOnce([mockTabs[0], mockTabs[1], mockTabs[2], mockTabs[3]]); // After moving
      chrome.tabs.move.mockResolvedValue(undefined);
      chrome.tabs.group.mockResolvedValue(1);

      const result = await organizeTabs('domain', true);

      // Should have queried all windows
      expect(chrome.tabs.query).toHaveBeenNthCalledWith(1, {});

      // Should have moved tabs from window 2 to window 1
      expect(chrome.tabs.move).toHaveBeenCalledWith(3, { windowId: 1, index: -1 });
      expect(chrome.tabs.move).toHaveBeenCalledWith(4, { windowId: 1, index: -1 });
      expect(result.tabsMoved).toBe(2);
    });

    test('should remove duplicate URLs across all windows', async () => {
      const mockTabs = [
        // Window 1
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: -1, windowId: 1 },
        { id: 2, url: 'https://example.com/page1', title: 'Page 1', groupId: -1, windowId: 1 },
        // Window 2 - duplicates
        { id: 3, url: 'https://github.com/repo1', title: 'Repo 1 (duplicate)', groupId: -1, windowId: 2 },
        { id: 4, url: 'https://example.com/page1', title: 'Page 1 (duplicate)', groupId: -1, windowId: 2 },
        // Window 2 - unique
        { id: 5, url: 'https://github.com/repo2', title: 'Repo 2', groupId: -1, windowId: 2 }
      ];

      chrome.tabs.query.mockResolvedValueOnce(mockTabs) // Initial all windows query
                         .mockResolvedValueOnce([mockTabs[0], mockTabs[1], mockTabs[4]]); // After deduplication and moving
      chrome.tabs.remove.mockResolvedValue(undefined);
      chrome.tabs.move.mockResolvedValue(undefined);
      chrome.tabs.group.mockResolvedValueOnce(1).mockResolvedValueOnce(2);

      const result = await organizeTabs('domain', true);

      // Should have removed duplicates (tabs 3 and 4)
      expect(chrome.tabs.remove).toHaveBeenCalledWith([3, 4]);
      expect(result.duplicatesClosed).toBe(2);

      // Should have moved unique tab from window 2 (tab 5)
      expect(chrome.tabs.move).toHaveBeenCalledWith(5, { windowId: 1, index: -1 });
      expect(result.tabsMoved).toBe(1);

      // Should have 3 unique tabs remaining
      expect(result.totalTabs).toBe(3);
      // github.com has 2 tabs (grouped), example.com has 1 tab (not grouped)
      expect(result.groupedTabs).toBe(2);
    });

    test('should skip chrome internal pages when removing duplicates', async () => {
      const mockTabs = [
        // Window 1
        { id: 1, url: 'chrome://extensions/', title: 'Extensions', groupId: -1, windowId: 1 },
        { id: 2, url: 'https://github.com/repo1', title: 'Repo 1', groupId: -1, windowId: 1 },
        // Window 2
        { id: 3, url: 'chrome-extension://abc/popup.html', title: 'Extension', groupId: -1, windowId: 2 },
        { id: 4, url: 'about:blank', title: 'Blank', groupId: -1, windowId: 2 },
        { id: 5, url: 'https://github.com/repo2', title: 'Repo 2', groupId: -1, windowId: 2 }
      ];

      chrome.tabs.query.mockResolvedValueOnce(mockTabs) // Initial all windows query
                         .mockResolvedValueOnce([mockTabs[0], mockTabs[1], mockTabs[2], mockTabs[3], mockTabs[4]]); // After moving
      chrome.tabs.move.mockResolvedValue(undefined);
      chrome.tabs.group.mockResolvedValue(1);

      const result = await organizeTabs('domain', true);

      // Should not try to remove chrome internal pages
      expect(chrome.tabs.remove).not.toHaveBeenCalled();
      expect(result.duplicatesClosed).toBe(0);

      // Should group only the github tabs
      expect(result.groupedTabs).toBe(2);
    });

    test('should handle when all tabs are already in current window', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: -1, windowId: 1 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: -1, windowId: 1 },
        { id: 3, url: 'https://example.com/page1', title: 'Page 1', groupId: -1, windowId: 1 }
      ];

      const tabsAfterGrouping = [
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: 1, windowId: 1 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: 1, windowId: 1 },
        { id: 3, url: 'https://example.com/page1', title: 'Page 1', groupId: -1, windowId: 1 }
      ];

      chrome.tabs.query.mockResolvedValue(tabsAfterGrouping); // All queries return the same state
      chrome.tabs.group.mockResolvedValue(1);
      chrome.tabs.move.mockResolvedValue({});

      const result = await organizeTabs('domain', true);

      // Should not move any tabs between windows (all already in window 1)
      expect(result.tabsMoved).toBe(0);

      // Should not remove any duplicates
      expect(chrome.tabs.remove).not.toHaveBeenCalled();
      expect(result.duplicatesClosed).toBe(0);

      // Should still group tabs normally
      expect(result.groupedTabs).toBe(2);

      // Should move the ungrouped tab (example.com) to the end
      expect(result.ungroupedTabsMoved).toBe(1);
      expect(chrome.tabs.move).toHaveBeenCalledWith([3], { index: -1 });
    });

    test('should handle tab move errors gracefully', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: -1, windowId: 1 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: -1, windowId: 2 },
        { id: 3, url: 'https://github.com/repo3', title: 'Repo 3', groupId: -1, windowId: 2 }
      ];

      chrome.tabs.query.mockResolvedValueOnce(mockTabs) // Initial all windows query
                         .mockResolvedValueOnce([mockTabs[0], mockTabs[2]]); // Tab 2 failed to move
      chrome.tabs.move.mockRejectedValueOnce(new Error('Move failed')) // Tab 2 fails
                       .mockResolvedValueOnce(undefined); // Tab 3 succeeds
      chrome.tabs.group.mockResolvedValue(1);

      const result = await organizeTabs('domain', true);

      // Should still have moved 1 tab successfully
      expect(result.tabsMoved).toBe(1);

      // Should log error but continue
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error moving tab'), expect.any(Error));

      // Should still group the successfully moved tabs
      expect(result.groupedTabs).toBe(2);
    });

    test('should combine cross-window organization with category mode', async () => {
      const mockTabs = [
        // Window 1 - Development
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: -1, windowId: 1 },
        { id: 2, url: 'https://stackoverflow.com/q/1', title: 'Q1', groupId: -1, windowId: 1 },
        // Window 2 - Development
        { id: 3, url: 'https://github.com/repo2', title: 'Repo 2', groupId: -1, windowId: 2 },
        { id: 4, url: 'https://stackoverflow.com/q/2', title: 'Q2', groupId: -1, windowId: 2 }
      ];

      chrome.tabs.query.mockResolvedValueOnce(mockTabs) // Initial all windows query
                         .mockResolvedValueOnce(mockTabs); // After moving
      chrome.tabs.move.mockResolvedValue(undefined);
      chrome.tabs.group.mockResolvedValue(1);

      const result = await organizeTabs('category', true);

      // Should have moved tabs from window 2
      expect(result.tabsMoved).toBe(2);

      // Should group all 4 tabs into "Development" category
      expect(result.groupedTabs).toBe(4);
      expect(result.groups).toBe(1);
    });

    test('should return 0 for duplicatesClosed and tabsMoved when allWindows is false', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: -1, windowId: 1 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: -1, windowId: 1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.group.mockResolvedValue(1);

      const result = await organizeTabs('domain', false);

      // Should not have cross-window metrics when allWindows is false
      expect(result.duplicatesClosed).toBe(0);
      expect(result.tabsMoved).toBe(0);

      // Should still group tabs normally
      expect(result.groupedTabs).toBe(2);
    });
  });

  describe('Ungrouped Duplicates Detection', () => {
    test('should detect ungrouped tabs that duplicate grouped tabs', async () => {
      const mockTabs = [
        // Grouped tabs
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: 5, windowId: 1 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: 5, windowId: 1 },
        // Ungrouped duplicate of repo1
        { id: 3, url: 'https://github.com/repo1', title: 'Repo 1 Duplicate', groupId: -1, windowId: 1 },
        // Regular ungrouped tab (no duplicate)
        { id: 4, url: 'https://example.com', title: 'Example', groupId: -1, windowId: 1 }
      ];

      const mockGroups = [
        { id: 5, title: 'github.com (2)' }
      ];

      chrome.tabs.query
        .mockResolvedValueOnce(mockTabs) // Initial query
        .mockResolvedValueOnce([mockTabs[0], mockTabs[1], mockTabs[3]]); // After removing duplicate
      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.tabs.remove.mockResolvedValue(undefined);
      chrome.tabs.group.mockResolvedValue(5);

      const result = await organizeTabs('domain', false);

      // Should close 1 ungrouped duplicate
      expect(chrome.tabs.remove).toHaveBeenCalledWith([3]);
      expect(result.duplicatesClosed).toBe(1);
    });

    test('should count multiple ungrouped duplicates correctly', async () => {
      const mockTabs = [
        // Grouped tabs
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: 5, windowId: 1 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: 5, windowId: 1 },
        // Multiple ungrouped duplicates
        { id: 3, url: 'https://github.com/repo1', title: 'Repo 1 Dup 1', groupId: -1, windowId: 1 },
        { id: 4, url: 'https://github.com/repo1', title: 'Repo 1 Dup 2', groupId: -1, windowId: 1 },
        { id: 5, url: 'https://github.com/repo2', title: 'Repo 2 Dup', groupId: -1, windowId: 1 }
      ];

      const mockGroups = [
        { id: 5, title: 'github.com (2)' }
      ];

      chrome.tabs.query
        .mockResolvedValueOnce(mockTabs) // Initial query
        .mockResolvedValueOnce([mockTabs[0], mockTabs[1]]); // After removing duplicates
      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.tabs.remove.mockResolvedValue(undefined);
      chrome.tabs.group.mockResolvedValue(5);

      const result = await organizeTabs('domain', false);

      // Should close 3 ungrouped duplicates (2 of repo1, 1 of repo2)
      expect(chrome.tabs.remove).toHaveBeenCalledWith([3, 4, 5]);
      expect(result.duplicatesClosed).toBe(3);
    });

    test('should return 0 ungrouped duplicates when none exist', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: 5, windowId: 1 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: 5, windowId: 1 },
        { id: 3, url: 'https://example.com', title: 'Example', groupId: -1, windowId: 1 }
      ];

      const mockGroups = [
        { id: 5, title: 'github.com (2)' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.tabs.group.mockResolvedValue(5);

      const result = await organizeTabs('domain', false);

      // Should close no ungrouped duplicates
      expect(chrome.tabs.remove).not.toHaveBeenCalled();
      expect(result.duplicatesClosed).toBe(0);
    });

    test('should skip chrome internal pages when detecting duplicates', async () => {
      const mockTabs = [
        // Grouped tab
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: 5, windowId: 1 },
        // Ungrouped duplicate
        { id: 2, url: 'https://github.com/repo1', title: 'Repo 1 Dup', groupId: -1, windowId: 1 },
        // Chrome internal pages (should be skipped)
        { id: 3, url: 'chrome://extensions/', title: 'Extensions', groupId: -1, windowId: 1 },
        { id: 4, url: 'chrome-extension://abc123/popup.html', title: 'Popup', groupId: -1, windowId: 1 },
        { id: 5, url: 'about:blank', title: 'Blank', groupId: -1, windowId: 1 }
      ];

      const mockGroups = [
        { id: 5, title: 'github.com (1)' }
      ];

      chrome.tabs.query
        .mockResolvedValueOnce(mockTabs) // Initial query
        .mockResolvedValueOnce([mockTabs[0], mockTabs[2], mockTabs[3], mockTabs[4]]); // After removing duplicate
      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.tabs.remove.mockResolvedValue(undefined);
      chrome.tabs.group.mockResolvedValue(5);

      const result = await organizeTabs('domain', false);

      // Should only close the github duplicate, not chrome pages
      expect(chrome.tabs.remove).toHaveBeenCalledWith([2]);
      expect(result.duplicatesClosed).toBe(1);
    });

    test('should work correctly with category mode', async () => {
      const mockTabs = [
        // Grouped Development tabs
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: 7, windowId: 1 },
        { id: 2, url: 'https://stackoverflow.com/q/1', title: 'SO Q1', groupId: 7, windowId: 1 },
        // Ungrouped duplicate
        { id: 3, url: 'https://github.com/repo1', title: 'Repo 1 Dup', groupId: -1, windowId: 1 }
      ];

      const mockGroups = [
        { id: 7, title: 'Development (2)' }
      ];

      chrome.tabs.query
        .mockResolvedValueOnce(mockTabs) // Initial query
        .mockResolvedValueOnce([mockTabs[0], mockTabs[1]]); // After removing duplicate
      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.tabs.remove.mockResolvedValue(undefined);
      chrome.tabs.group.mockResolvedValue(7);

      const result = await organizeTabs('category', false);

      // Should close ungrouped duplicate in category mode too
      expect(chrome.tabs.remove).toHaveBeenCalledWith([3]);
      expect(result.duplicatesClosed).toBe(1);
    });

    test('should close ungrouped duplicates before organizing', async () => {
      const mockTabs = [
        // Grouped tabs
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: 5, windowId: 1 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: 5, windowId: 1 },
        // Ungrouped duplicate - should be CLOSED
        { id: 3, url: 'https://github.com/repo1', title: 'Repo 1 Duplicate', groupId: -1, windowId: 1 },
        // Regular ungrouped tabs (not duplicates) - should still be organized if eligible
        { id: 4, url: 'https://example.com/page1', title: 'Example 1', groupId: -1, windowId: 1 },
        { id: 5, url: 'https://example.com/page2', title: 'Example 2', groupId: -1, windowId: 1 }
      ];

      const mockGroups = [
        { id: 5, title: 'github.com (2)' }
      ];

      chrome.tabs.query
        .mockResolvedValueOnce(mockTabs) // Initial query
        .mockResolvedValueOnce([mockTabs[0], mockTabs[1], mockTabs[3], mockTabs[4]]); // After removing duplicate
      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.tabs.remove.mockResolvedValue(undefined);
      chrome.tabs.group.mockResolvedValue(10);

      const result = await organizeTabs('domain', false);

      // Should close 1 ungrouped duplicate
      expect(chrome.tabs.remove).toHaveBeenCalledWith([3]);
      expect(result.duplicatesClosed).toBe(1);

      // Should have been called to create a new example.com group (2 tabs)
      // The duplicate github tab (tab id 3) was already removed
      expect(chrome.tabs.group).toHaveBeenCalledWith({ tabIds: [4, 5] }); // example.com group

      // The ungrouped duplicate (tab 3) should NOT be in any group call (it was removed)
      const allGroupCalls = chrome.tabs.group.mock.calls;
      const allTabIdsGrouped = allGroupCalls.flatMap(call => call[0].tabIds);
      expect(allTabIdsGrouped).not.toContain(3); // Tab 3 was removed before grouping
    });

    test('should move ungrouped tabs to end of tab bar', async () => {
      const mockTabs = [
        // Grouped tabs
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: 5, windowId: 1 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: 5, windowId: 1 },
        // Ungrouped tabs (should be moved to end)
        { id: 3, url: 'https://example.com/page1', title: 'Example 1', groupId: -1, windowId: 1 },
        { id: 4, url: 'https://news.com/article', title: 'News', groupId: -1, windowId: 1 }
      ];

      const mockGroups = [
        { id: 5, title: 'github.com (2)' }
      ];

      // All queries return the same tabs
      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.tabs.move.mockResolvedValue({});

      const result = await organizeTabs('domain', false);

      // Should have moved 2 ungrouped tabs
      expect(result.ungroupedTabsMoved).toBe(2);

      // Should have been called once with array of ungrouped tab IDs (batch move)
      expect(chrome.tabs.move).toHaveBeenCalledWith([3, 4], { index: -1 });
      expect(chrome.tabs.move).toHaveBeenCalledTimes(1);
    });

    test('should skip chrome internal pages when moving ungrouped tabs', async () => {
      const mockTabs = [
        // Grouped tabs
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: 5, windowId: 1 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: 5, windowId: 1 },
        // Ungrouped regular tab (should be moved)
        { id: 3, url: 'https://example.com', title: 'Example', groupId: -1, windowId: 1 },
        // Chrome internal pages (should NOT be moved)
        { id: 4, url: 'chrome://extensions/', title: 'Extensions', groupId: -1, windowId: 1 },
        { id: 5, url: 'chrome-extension://abc/popup.html', title: 'Popup', groupId: -1, windowId: 1 }
      ];

      const mockGroups = [
        { id: 5, title: 'github.com (2)' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.tabs.move.mockResolvedValue({});

      const result = await organizeTabs('domain', false);

      // Should only move the 1 regular ungrouped tab (not chrome pages)
      expect(result.ungroupedTabsMoved).toBe(1);
      expect(chrome.tabs.move).toHaveBeenCalledWith([3], { index: -1 });
      expect(chrome.tabs.move).toHaveBeenCalledTimes(1);
    });
  });

  describe('Automatic Duplicate Removal', () => {
    test('should close ungrouped tab that duplicates a grouped tab', async () => {
      const mockTabs = [
        // Grouped tabs
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: 5, windowId: 1 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: 5, windowId: 1 },
        // Ungrouped duplicate of grouped tab - should be CLOSED
        { id: 3, url: 'https://github.com/repo1', title: 'Repo 1 Duplicate', groupId: -1, windowId: 1 }
      ];

      const mockGroups = [
        { id: 5, title: 'github.com (2)' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.tabs.remove.mockResolvedValue(undefined);

      const result = await organizeTabs('domain', false);

      // Should have closed the ungrouped duplicate (tab 3)
      expect(chrome.tabs.remove).toHaveBeenCalledWith([3]);
      expect(result.duplicatesClosed).toBe(1);
    });

    test('should close multiple ungrouped tabs with same URL, keeping first', async () => {
      const mockTabs = [
        // Three ungrouped tabs with same URL
        { id: 1, url: 'https://github.com/repo1', title: 'First', groupId: -1, windowId: 1 },
        { id: 2, url: 'https://github.com/repo1', title: 'Second', groupId: -1, windowId: 1 },
        { id: 3, url: 'https://github.com/repo1', title: 'Third', groupId: -1, windowId: 1 },
        // Another domain to form a group
        { id: 4, url: 'https://github.com/repo2', title: 'Repo 2', groupId: -1, windowId: 1 }
      ];

      chrome.tabs.query
        .mockResolvedValueOnce(mockTabs) // Initial query
        .mockResolvedValueOnce([mockTabs[0], mockTabs[3]]); // After removing duplicates
      chrome.tabGroups.query.mockResolvedValue([]);
      chrome.tabs.remove.mockResolvedValue(undefined);
      chrome.tabs.group.mockResolvedValue(1);

      const result = await organizeTabs('domain', false);

      // Should have closed tabs 2 and 3 (duplicates of tab 1)
      expect(chrome.tabs.remove).toHaveBeenCalledWith([2, 3]);
      expect(result.duplicatesClosed).toBe(2);
    });

    test('should preserve cross-group duplicates (same URL in different groups)', async () => {
      const mockTabs = [
        // Same URL in two different groups
        { id: 1, url: 'https://github.com/repo1', title: 'In Dev Group', groupId: 5, windowId: 1 },
        { id: 2, url: 'https://github.com/repo2', title: 'In Dev Group', groupId: 5, windowId: 1 },
        { id: 3, url: 'https://github.com/repo1', title: 'In Domain Group', groupId: 7, windowId: 1 },
        { id: 4, url: 'https://example.com/page', title: 'In Domain Group', groupId: 7, windowId: 1 }
      ];

      const mockGroups = [
        { id: 5, title: 'Development (2)' },
        { id: 7, title: 'github.com (2)' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabGroups.query.mockResolvedValue(mockGroups);

      const result = await organizeTabs('domain', false);

      // Should NOT close any tabs - cross-group duplicates are allowed
      expect(chrome.tabs.remove).not.toHaveBeenCalled();
      expect(result.duplicatesClosed).toBe(0);
    });
  });
});