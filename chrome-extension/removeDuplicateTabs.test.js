/**
 * Unit Tests for removeDuplicateTabs function
 *
 * Tests the duplicate tab removal logic including:
 * - Duplicate detection by URL
 * - Keeping first occurrence, removing duplicates
 * - Skipping chrome internal pages
 * - Edge cases (no duplicates, all duplicates, empty tabs)
 * - Error scenarios (tab closure failures)
 * - URL variations (query params, fragments, case sensitivity)
 */

// Mock Chrome APIs
global.chrome = {
  tabs: {
    query: jest.fn(),
    remove: jest.fn(),
    group: jest.fn(),
    ungroup: jest.fn(),
    create: jest.fn(),
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

// Mock console methods
global.console = {
  log: jest.fn(),
  error: jest.fn()
};

// Import function from background.js
const { removeDuplicateTabs } = require('./background.js');

describe('removeDuplicateTabs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock empty groups by default (tests can override this)
    chrome.tabGroups.query.mockResolvedValue([]);
  });

  describe('Basic Duplicate Detection', () => {
    test('should remove exact duplicate URLs', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com/repo', title: 'Repo - First' },
        { id: 2, url: 'https://example.com/page', title: 'Example' },
        { id: 3, url: 'https://github.com/repo', title: 'Repo - Second' },
        { id: 4, url: 'https://github.com/repo', title: 'Repo - Third' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.remove.mockResolvedValue(undefined);

      const result = await removeDuplicateTabs();

      expect(result.totalTabs).toBe(4);
      expect(result.duplicatesFound).toBe(2);
      expect(result.duplicatesClosed).toBe(2);
      expect(result.remainingTabs).toBe(2);

      // Should close tabs 3 and 4, keep tab 1
      expect(chrome.tabs.remove).toHaveBeenCalledTimes(2);
      expect(chrome.tabs.remove).toHaveBeenCalledWith(3);
      expect(chrome.tabs.remove).toHaveBeenCalledWith(4);
    });

    test('should keep first occurrence and remove subsequent duplicates', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com/repo', title: 'First' },
        { id: 2, url: 'https://github.com/repo', title: 'Second' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.remove.mockResolvedValue(undefined);

      await removeDuplicateTabs();

      // Should keep tab 1, remove tab 2
      expect(chrome.tabs.remove).toHaveBeenCalledTimes(1);
      expect(chrome.tabs.remove).toHaveBeenCalledWith(2);
      expect(chrome.tabs.remove).not.toHaveBeenCalledWith(1);
    });

    test('should handle no duplicates', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com', title: 'GitHub' },
        { id: 2, url: 'https://example.com', title: 'Example' },
        { id: 3, url: 'https://google.com', title: 'Google' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);

      const result = await removeDuplicateTabs();

      expect(result.totalTabs).toBe(3);
      expect(result.duplicatesFound).toBe(0);
      expect(result.duplicatesClosed).toBe(0);
      expect(result.remainingTabs).toBe(3);

      expect(chrome.tabs.remove).not.toHaveBeenCalled();
    });

    test('should handle all tabs being duplicates', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com', title: 'First' },
        { id: 2, url: 'https://github.com', title: 'Second' },
        { id: 3, url: 'https://github.com', title: 'Third' },
        { id: 4, url: 'https://github.com', title: 'Fourth' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.remove.mockResolvedValue(undefined);

      const result = await removeDuplicateTabs();

      expect(result.totalTabs).toBe(4);
      expect(result.duplicatesFound).toBe(3);
      expect(result.duplicatesClosed).toBe(3);
      expect(result.remainingTabs).toBe(1);

      expect(chrome.tabs.remove).toHaveBeenCalledTimes(3);
    });
  });

  describe('Chrome Internal Pages', () => {
    test('should skip chrome:// URLs', async () => {
      const mockTabs = [
        { id: 1, url: 'chrome://extensions/', title: 'Extensions' },
        { id: 2, url: 'chrome://extensions/', title: 'Extensions Dup' },
        { id: 3, url: 'https://github.com', title: 'GitHub' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);

      const result = await removeDuplicateTabs();

      expect(result.duplicatesFound).toBe(0);
      expect(chrome.tabs.remove).not.toHaveBeenCalled();
    });

    test('should skip chrome-extension:// URLs', async () => {
      const mockTabs = [
        { id: 1, url: 'chrome-extension://abc123/popup.html', title: 'Extension' },
        { id: 2, url: 'chrome-extension://abc123/popup.html', title: 'Extension Dup' },
        { id: 3, url: 'https://example.com', title: 'Example' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);

      const result = await removeDuplicateTabs();

      expect(result.duplicatesFound).toBe(0);
      expect(chrome.tabs.remove).not.toHaveBeenCalled();
    });

    test('should skip about:blank', async () => {
      const mockTabs = [
        { id: 1, url: 'about:blank', title: 'Blank' },
        { id: 2, url: 'about:blank', title: 'Blank Dup' },
        { id: 3, url: 'https://github.com', title: 'GitHub' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);

      const result = await removeDuplicateTabs();

      expect(result.duplicatesFound).toBe(0);
      expect(chrome.tabs.remove).not.toHaveBeenCalled();
    });

    test('should allow duplicate detection for regular URLs while skipping chrome URLs', async () => {
      const mockTabs = [
        { id: 1, url: 'chrome://extensions/', title: 'Extensions' },
        { id: 2, url: 'https://github.com', title: 'GitHub 1' },
        { id: 3, url: 'chrome://extensions/', title: 'Extensions Dup' },
        { id: 4, url: 'https://github.com', title: 'GitHub 2' },
        { id: 5, url: 'about:blank', title: 'Blank' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.remove.mockResolvedValue(undefined);

      const result = await removeDuplicateTabs();

      expect(result.duplicatesFound).toBe(1);
      expect(result.duplicatesClosed).toBe(1);
      expect(chrome.tabs.remove).toHaveBeenCalledWith(4);
    });
  });

  describe('URL Variations', () => {
    test('should treat URLs with different query parameters as different', async () => {
      const mockTabs = [
        { id: 1, url: 'https://example.com?page=1', title: 'Page 1' },
        { id: 2, url: 'https://example.com?page=2', title: 'Page 2' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);

      const result = await removeDuplicateTabs();

      expect(result.duplicatesFound).toBe(0);
      expect(chrome.tabs.remove).not.toHaveBeenCalled();
    });

    test('should treat URLs with different fragments as different', async () => {
      const mockTabs = [
        { id: 1, url: 'https://example.com#section1', title: 'Section 1' },
        { id: 2, url: 'https://example.com#section2', title: 'Section 2' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);

      const result = await removeDuplicateTabs();

      expect(result.duplicatesFound).toBe(0);
      expect(chrome.tabs.remove).not.toHaveBeenCalled();
    });

    test('should be case-sensitive for URLs', async () => {
      const mockTabs = [
        { id: 1, url: 'https://example.com/Page', title: 'Page Upper' },
        { id: 2, url: 'https://example.com/page', title: 'Page Lower' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);

      const result = await removeDuplicateTabs();

      // URLs are case-sensitive, so these are different
      expect(result.duplicatesFound).toBe(0);
      expect(chrome.tabs.remove).not.toHaveBeenCalled();
    });

    test('should treat http and https as different', async () => {
      const mockTabs = [
        { id: 1, url: 'http://example.com', title: 'HTTP' },
        { id: 2, url: 'https://example.com', title: 'HTTPS' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);

      const result = await removeDuplicateTabs();

      expect(result.duplicatesFound).toBe(0);
      expect(chrome.tabs.remove).not.toHaveBeenCalled();
    });

    test('should treat trailing slashes as different', async () => {
      const mockTabs = [
        { id: 1, url: 'https://example.com/page', title: 'No Slash' },
        { id: 2, url: 'https://example.com/page/', title: 'With Slash' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);

      const result = await removeDuplicateTabs();

      // URLs are exact match, so these are different
      expect(result.duplicatesFound).toBe(0);
      expect(chrome.tabs.remove).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty tab list', async () => {
      chrome.tabs.query.mockResolvedValue([]);

      const result = await removeDuplicateTabs();

      expect(result.totalTabs).toBe(0);
      expect(result.duplicatesFound).toBe(0);
      expect(result.duplicatesClosed).toBe(0);
      expect(result.remainingTabs).toBe(0);

      expect(chrome.tabs.remove).not.toHaveBeenCalled();
    });

    test('should handle single tab', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com', title: 'GitHub' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);

      const result = await removeDuplicateTabs();

      expect(result.totalTabs).toBe(1);
      expect(result.duplicatesFound).toBe(0);
      expect(result.duplicatesClosed).toBe(0);
      expect(result.remainingTabs).toBe(1);

      expect(chrome.tabs.remove).not.toHaveBeenCalled();
    });

    test('should handle tabs with missing or empty URLs', async () => {
      const mockTabs = [
        { id: 1, url: '', title: 'Empty URL' },
        { id: 2, url: 'https://github.com', title: 'GitHub' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);

      // Should not throw
      await expect(removeDuplicateTabs()).resolves.not.toThrow();
    });

    test('should handle tabs with very long URLs', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(10000);
      const mockTabs = [
        { id: 1, url: longUrl, title: 'Long URL 1' },
        { id: 2, url: longUrl, title: 'Long URL 2' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.remove.mockResolvedValue(undefined);

      const result = await removeDuplicateTabs();

      expect(result.duplicatesFound).toBe(1);
      expect(result.duplicatesClosed).toBe(1);
    });

    test('should handle tabs with special characters in URLs', async () => {
      const specialUrl = 'https://example.com/page?query=hello%20world&lang=en#section';
      const mockTabs = [
        { id: 1, url: specialUrl, title: 'Special 1' },
        { id: 2, url: specialUrl, title: 'Special 2' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.remove.mockResolvedValue(undefined);

      const result = await removeDuplicateTabs();

      expect(result.duplicatesFound).toBe(1);
      expect(result.duplicatesClosed).toBe(1);
    });

    test('should handle many duplicates efficiently', async () => {
      const mockTabs = [];
      for (let i = 0; i < 100; i++) {
        mockTabs.push({
          id: i,
          url: 'https://github.com',
          title: `GitHub ${i}`
        });
      }

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.remove.mockResolvedValue(undefined);

      const result = await removeDuplicateTabs();

      expect(result.totalTabs).toBe(100);
      expect(result.duplicatesFound).toBe(99);
      expect(result.duplicatesClosed).toBe(99);
      expect(result.remainingTabs).toBe(1);

      expect(chrome.tabs.remove).toHaveBeenCalledTimes(99);
    });
  });

  describe('Error Scenarios', () => {
    test('should handle chrome.tabs.query errors', async () => {
      chrome.tabs.query.mockRejectedValue(new Error('Query failed'));

      await expect(removeDuplicateTabs()).rejects.toThrow('Query failed');
    });

    test('should continue if some tab removals fail', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com', title: 'First' },
        { id: 2, url: 'https://github.com', title: 'Second' },
        { id: 3, url: 'https://github.com', title: 'Third' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.remove
        .mockRejectedValueOnce(new Error('Cannot close tab'))
        .mockResolvedValueOnce(undefined);

      const result = await removeDuplicateTabs();

      expect(result.duplicatesFound).toBe(2);
      expect(result.duplicatesClosed).toBe(1); // Only 1 succeeded
      expect(result.remainingTabs).toBe(2); // 3 - 1 = 2

      expect(chrome.tabs.remove).toHaveBeenCalledTimes(2);
      expect(console.error).toHaveBeenCalledWith('Error closing tab:', expect.any(Error));
    });

    test('should handle all tab removals failing', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com', title: 'First' },
        { id: 2, url: 'https://github.com', title: 'Second' },
        { id: 3, url: 'https://github.com', title: 'Third' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.remove.mockRejectedValue(new Error('Cannot close tabs'));

      const result = await removeDuplicateTabs();

      expect(result.duplicatesFound).toBe(2);
      expect(result.duplicatesClosed).toBe(0); // All failed
      expect(result.remainingTabs).toBe(3); // All remain

      expect(chrome.tabs.remove).toHaveBeenCalledTimes(2);
      expect(console.error).toHaveBeenCalledTimes(2);
    });

    test('should handle protected tabs that cannot be closed', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com', title: 'First' },
        { id: 2, url: 'https://github.com', title: 'Second (Protected)' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.remove.mockRejectedValue(new Error('Tab is protected'));

      const result = await removeDuplicateTabs();

      expect(result.duplicatesFound).toBe(1);
      expect(result.duplicatesClosed).toBe(0);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Return Value Validation', () => {
    test('should return correct totalTabs count', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com', title: 'GitHub' },
        { id: 2, url: 'https://example.com', title: 'Example' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);

      const result = await removeDuplicateTabs();

      expect(result.totalTabs).toBe(2);
      expect(typeof result.totalTabs).toBe('number');
    });

    test('should return correct duplicatesFound count', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com', title: 'First' },
        { id: 2, url: 'https://github.com', title: 'Second' },
        { id: 3, url: 'https://github.com', title: 'Third' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.remove.mockResolvedValue(undefined);

      const result = await removeDuplicateTabs();

      expect(result.duplicatesFound).toBe(2);
      expect(typeof result.duplicatesFound).toBe('number');
    });

    test('should return correct duplicatesClosed count', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com', title: 'First' },
        { id: 2, url: 'https://github.com', title: 'Second' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.remove.mockResolvedValue(undefined);

      const result = await removeDuplicateTabs();

      expect(result.duplicatesClosed).toBe(1);
      expect(typeof result.duplicatesClosed).toBe('number');
    });

    test('should return correct remainingTabs count', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com', title: 'First' },
        { id: 2, url: 'https://github.com', title: 'Second' },
        { id: 3, url: 'https://example.com', title: 'Example' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.remove.mockResolvedValue(undefined);

      const result = await removeDuplicateTabs();

      expect(result.remainingTabs).toBe(2); // 3 total - 1 closed
      expect(typeof result.remainingTabs).toBe('number');
    });

    test('should have all required properties in return value', async () => {
      chrome.tabs.query.mockResolvedValue([]);

      const result = await removeDuplicateTabs();

      expect(result).toHaveProperty('totalTabs');
      expect(result).toHaveProperty('duplicatesFound');
      expect(result).toHaveProperty('duplicatesClosed');
      expect(result).toHaveProperty('remainingTabs');
    });
  });

  describe('Console Logging', () => {
    test('should log duplicate detection', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com', title: 'First' },
        { id: 2, url: 'https://github.com', title: 'Second' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.remove.mockResolvedValue(undefined);

      await removeDuplicateTabs();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Found duplicate: Second (https://github.com)')
      );
    });

    test('should log errors when tab removal fails', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com', title: 'First' },
        { id: 2, url: 'https://github.com', title: 'Second' }
      ];

      const error = new Error('Cannot close tab');
      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.remove.mockRejectedValue(error);

      await removeDuplicateTabs();

      expect(console.error).toHaveBeenCalledWith('Error closing tab:', error);
    });
  });

  describe('Group Title Updates', () => {
    test('should update group titles after removing duplicates', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: 5 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: 5 },
        { id: 3, url: 'https://github.com/repo1', title: 'Repo 1 Duplicate', groupId: 5 },
        { id: 4, url: 'https://example.com/page1', title: 'Page 1', groupId: 6 },
        { id: 5, url: 'https://example.com/page2', title: 'Page 2', groupId: 6 },
        { id: 6, url: 'https://example.com/page1', title: 'Page 1 Duplicate', groupId: 6 }
      ];

      const mockGroups = [
        { id: 5, title: 'github.com (3)' },
        { id: 6, title: 'example.com (3)' }
      ];

      chrome.tabs.query
        .mockResolvedValueOnce(mockTabs) // Initial query
        .mockResolvedValueOnce([mockTabs[0], mockTabs[1]]) // Tabs in group 5 after removal
        .mockResolvedValueOnce([mockTabs[3], mockTabs[4]]); // Tabs in group 6 after removal
      chrome.tabs.remove.mockResolvedValue(undefined);
      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.tabGroups.update.mockResolvedValue(undefined);

      const result = await removeDuplicateTabs();

      // Should have closed 2 duplicates
      expect(result.duplicatesClosed).toBe(2);

      // Should have updated both group titles
      expect(chrome.tabGroups.update).toHaveBeenCalledTimes(2);
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(5, { title: 'github.com (2)' });
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(6, { title: 'example.com (2)' });
    });

    test('should not update group titles if no duplicates removed', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: 5 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: 5 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.remove.mockResolvedValue(undefined);

      await removeDuplicateTabs();

      // Should not query or update groups if no duplicates were removed
      expect(chrome.tabGroups.query).not.toHaveBeenCalled();
      expect(chrome.tabGroups.update).not.toHaveBeenCalled();
    });

    test('should not update group title if count has not changed', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: 5 },
        { id: 2, url: 'https://github.com/repo1', title: 'Repo 1 Duplicate', groupId: -1 }, // Ungrouped duplicate
        { id: 3, url: 'https://github.com/repo2', title: 'Repo 2', groupId: 5 }
      ];

      const mockGroups = [
        { id: 5, title: 'github.com (2)' }
      ];

      chrome.tabs.query
        .mockResolvedValueOnce(mockTabs) // Initial query
        .mockResolvedValueOnce([mockTabs[0], mockTabs[2]]); // Tabs in group 5 (still 2)
      chrome.tabs.remove.mockResolvedValue(undefined);
      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.tabGroups.update.mockResolvedValue(undefined);

      await removeDuplicateTabs();

      // Should have closed 1 duplicate
      expect(chrome.tabs.remove).toHaveBeenCalledTimes(1);

      // Should not update group title because count is still 2
      expect(chrome.tabGroups.update).not.toHaveBeenCalled();
    });

    test('should handle groups with category names', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: 7 },
        { id: 2, url: 'https://stackoverflow.com/q1', title: 'Q1', groupId: 7 },
        { id: 3, url: 'https://github.com/repo1', title: 'Repo 1 Duplicate', groupId: 7 }
      ];

      const mockGroups = [
        { id: 7, title: 'Development (3)' }
      ];

      chrome.tabs.query
        .mockResolvedValueOnce(mockTabs) // Initial query
        .mockResolvedValueOnce([mockTabs[0], mockTabs[1]]); // Tabs in group 7 after removal
      chrome.tabs.remove.mockResolvedValue(undefined);
      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.tabGroups.update.mockResolvedValue(undefined);

      await removeDuplicateTabs();

      // Should update the group title from "Development (3)" to "Development (2)"
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(7, { title: 'Development (2)' });
    });
  });
});
