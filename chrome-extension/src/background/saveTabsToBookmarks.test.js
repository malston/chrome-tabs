/**
 * Unit Tests for saveTabsToBookmarks function
 *
 * Tests the bookmark saving logic including:
 * - Saving grouped tabs to bookmark folders
 * - Saving ungrouped tabs
 * - Creating folder structure
 * - Skipping chrome internal pages
 * - Edge cases (empty tabs, no groups, missing titles)
 * - Error scenarios (bookmark creation failures)
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
    getTree: jest.fn(),
    getChildren: jest.fn(),
    create: jest.fn()
  },
  windows: {
    WINDOW_ID_CURRENT: -2
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

// Mock Date for consistent timestamps
const mockDate = new Date('2025-01-15T14:30:00');
global.Date = class extends Date {
  constructor() {
    return mockDate;
  }
  static now() {
    return mockDate.getTime();
  }
};

// Import function from saveTabsToBookmarks.js
const { saveTabsToBookmarks } = require('./saveTabsToBookmarks.js');

describe('saveTabsToBookmarks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock getTree to return proper bookmark tree structure
    chrome.bookmarks.getTree.mockResolvedValue([
      {
        id: '0',
        children: [
          { id: '1', title: 'Bookmarks Bar' },
          { id: '2', title: 'Other Bookmarks' }
        ]
      }
    ]);
  });

  describe('Basic Functionality', () => {
    test('should save grouped tabs to bookmark folders', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: 1 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: 1 },
        { id: 3, url: 'https://example.com/page1', title: 'Page 1', groupId: 2 },
        { id: 4, url: 'https://example.com/page2', title: 'Page 2', groupId: 2 }
      ];

      const mockGroups = [
        { id: 1, title: 'GitHub Repos' },
        { id: 2, title: 'Examples' }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.bookmarks.create
        .mockResolvedValueOnce({ id: 'root1' })  // Root folder
        .mockResolvedValueOnce({ id: 'group1' }) // GitHub Repos folder
        .mockResolvedValueOnce({ id: 'bm1' })    // Bookmark 1
        .mockResolvedValueOnce({ id: 'bm2' })    // Bookmark 2
        .mockResolvedValueOnce({ id: 'group2' }) // Examples folder
        .mockResolvedValueOnce({ id: 'bm3' })    // Bookmark 3
        .mockResolvedValueOnce({ id: 'bm4' });   // Bookmark 4

      const result = await saveTabsToBookmarks();

      expect(result.totalTabs).toBe(4);
      expect(result.savedBookmarks).toBe(4);
      expect(result.folders).toBe(2);
      expect(result.rootFolderName).toContain('Tab Organizer');

      // Verify root folder creation
      expect(chrome.bookmarks.create).toHaveBeenCalledWith({
        parentId: '2',
        title: expect.stringContaining('Tab Organizer')
      });

      // Verify group folders creation
      expect(chrome.bookmarks.create).toHaveBeenCalledWith({
        parentId: 'root1',
        title: 'GitHub Repos'
      });
      expect(chrome.bookmarks.create).toHaveBeenCalledWith({
        parentId: 'root1',
        title: 'Examples'
      });
    });

    test('should save ungrouped tabs to "Ungrouped Tabs" folder', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com', title: 'GitHub', groupId: -1 },
        { id: 2, url: 'https://example.com', title: 'Example', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabGroups.query.mockResolvedValue([]);
      chrome.bookmarks.create
        .mockResolvedValueOnce({ id: 'root1' })
        .mockResolvedValueOnce({ id: 'ungrouped1' })
        .mockResolvedValueOnce({ id: 'bm1' })
        .mockResolvedValueOnce({ id: 'bm2' });

      const result = await saveTabsToBookmarks();

      expect(result.savedBookmarks).toBe(2);
      expect(result.folders).toBe(1);

      expect(chrome.bookmarks.create).toHaveBeenCalledWith({
        parentId: 'root1',
        title: 'Ungrouped Tabs'
      });
    });

    test('should save both grouped and ungrouped tabs', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: 1 },
        { id: 2, url: 'https://github.com/repo2', title: 'Repo 2', groupId: 1 },
        { id: 3, url: 'https://example.com', title: 'Example', groupId: -1 }
      ];

      const mockGroups = [{ id: 1, title: 'GitHub' }];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.bookmarks.create
        .mockResolvedValueOnce({ id: 'root1' })
        .mockResolvedValueOnce({ id: 'group1' })
        .mockResolvedValueOnce({ id: 'bm1' })
        .mockResolvedValueOnce({ id: 'bm2' })
        .mockResolvedValueOnce({ id: 'ungrouped1' })
        .mockResolvedValueOnce({ id: 'bm3' });

      const result = await saveTabsToBookmarks();

      expect(result.savedBookmarks).toBe(3);
      expect(result.folders).toBe(2); // GitHub + Ungrouped
    });
  });

  describe('Chrome Internal Pages', () => {
    test('should skip chrome:// URLs', async () => {
      const mockTabs = [
        { id: 1, url: 'chrome://extensions/', title: 'Extensions', groupId: -1 },
        { id: 2, url: 'https://github.com', title: 'GitHub', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabGroups.query.mockResolvedValue([]);
      chrome.bookmarks.create
        .mockResolvedValueOnce({ id: 'root1' })
        .mockResolvedValueOnce({ id: 'ungrouped1' })
        .mockResolvedValueOnce({ id: 'bm1' });

      const result = await saveTabsToBookmarks();

      expect(result.savedBookmarks).toBe(1); // Only GitHub saved
      expect(chrome.bookmarks.create).toHaveBeenCalledTimes(3); // root + ungrouped folder + 1 bookmark
    });

    test('should skip chrome-extension:// URLs', async () => {
      const mockTabs = [
        { id: 1, url: 'chrome-extension://abc123/popup.html', title: 'Extension', groupId: -1 },
        { id: 2, url: 'https://example.com', title: 'Example', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabGroups.query.mockResolvedValue([]);
      chrome.bookmarks.create
        .mockResolvedValueOnce({ id: 'root1' })
        .mockResolvedValueOnce({ id: 'ungrouped1' })
        .mockResolvedValueOnce({ id: 'bm1' });

      const result = await saveTabsToBookmarks();

      expect(result.savedBookmarks).toBe(1);
    });

    test('should skip about:blank', async () => {
      const mockTabs = [
        { id: 1, url: 'about:blank', title: '', groupId: -1 },
        { id: 2, url: 'https://github.com', title: 'GitHub', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabGroups.query.mockResolvedValue([]);
      chrome.bookmarks.create
        .mockResolvedValueOnce({ id: 'root1' })
        .mockResolvedValueOnce({ id: 'ungrouped1' })
        .mockResolvedValueOnce({ id: 'bm1' });

      const result = await saveTabsToBookmarks();

      expect(result.savedBookmarks).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty tab list', async () => {
      chrome.tabs.query.mockResolvedValue([]);
      chrome.tabGroups.query.mockResolvedValue([]);
      chrome.bookmarks.create.mockResolvedValueOnce({ id: 'root1' });

      const result = await saveTabsToBookmarks();

      expect(result.totalTabs).toBe(0);
      expect(result.savedBookmarks).toBe(0);
      expect(result.folders).toBe(0);

      // Only root folder should be created
      expect(chrome.bookmarks.create).toHaveBeenCalledTimes(1);
    });

    test('should handle tabs with missing titles', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com', title: '', groupId: -1 },
        { id: 2, url: 'https://example.com', title: null, groupId: -1 },
        { id: 3, url: 'https://google.com', title: undefined, groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabGroups.query.mockResolvedValue([]);
      chrome.bookmarks.create
        .mockResolvedValueOnce({ id: 'root1' })
        .mockResolvedValueOnce({ id: 'ungrouped1' })
        .mockResolvedValueOnce({ id: 'bm1' })
        .mockResolvedValueOnce({ id: 'bm2' })
        .mockResolvedValueOnce({ id: 'bm3' });

      await saveTabsToBookmarks();

      // Should use URL as title when title is missing
      expect(chrome.bookmarks.create).toHaveBeenCalledWith({
        parentId: 'ungrouped1',
        title: 'https://github.com',
        url: 'https://github.com'
      });
    });

    test('should handle groups with no title', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com', title: 'GitHub', groupId: 1 }
      ];

      const mockGroups = [
        { id: 1, title: '' }  // Empty title
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.bookmarks.create
        .mockResolvedValueOnce({ id: 'root1' })
        .mockResolvedValueOnce({ id: 'group1' })
        .mockResolvedValueOnce({ id: 'bm1' });

      await saveTabsToBookmarks();

      // Should still create folder with empty title
      expect(chrome.bookmarks.create).toHaveBeenCalledWith({
        parentId: 'root1',
        title: ''
      });
    });

    test('should handle unknown group IDs', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com', title: 'GitHub', groupId: 99 }  // Group ID doesn't exist
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabGroups.query.mockResolvedValue([]); // No groups
      chrome.bookmarks.create
        .mockResolvedValueOnce({ id: 'root1' })
        .mockResolvedValueOnce({ id: 'group1' })
        .mockResolvedValueOnce({ id: 'bm1' });

      await saveTabsToBookmarks();

      // Should use 'Unknown Group' as folder name
      expect(chrome.bookmarks.create).toHaveBeenCalledWith({
        parentId: 'root1',
        title: 'Unknown Group'
      });
    });

    test('should create folder with timestamp', async () => {
      chrome.tabs.query.mockResolvedValue([]);
      chrome.tabGroups.query.mockResolvedValue([]);
      chrome.bookmarks.create.mockResolvedValueOnce({ id: 'root1' });

      const result = await saveTabsToBookmarks();

      expect(result.rootFolderName).toBe('Tab Organizer - 01-15-2025 14-30');
      expect(chrome.bookmarks.create).toHaveBeenCalledWith({
        parentId: '2',
        title: 'Tab Organizer - 01-15-2025 14-30'
      });
    });
  });

  describe('Error Scenarios', () => {
    test('should handle chrome.tabs.query errors', async () => {
      chrome.tabs.query.mockRejectedValue(new Error('Query failed'));

      await expect(saveTabsToBookmarks()).rejects.toThrow('Query failed');
    });

    test('should handle chrome.tabGroups.query errors', async () => {
      chrome.tabs.query.mockResolvedValue([]);
      chrome.tabGroups.query.mockRejectedValue(new Error('Group query failed'));

      await expect(saveTabsToBookmarks()).rejects.toThrow('Group query failed');
    });

    test('should handle root folder creation errors', async () => {
      chrome.tabs.query.mockResolvedValue([]);
      chrome.tabGroups.query.mockResolvedValue([]);
      chrome.bookmarks.create.mockRejectedValue(new Error('Cannot create folder'));

      await expect(saveTabsToBookmarks()).rejects.toThrow('Cannot create folder');
    });

    test('should continue if individual bookmark creation fails', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com', title: 'GitHub', groupId: -1 },
        { id: 2, url: 'https://example.com', title: 'Example', groupId: -1 },
        { id: 3, url: 'https://google.com', title: 'Google', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabGroups.query.mockResolvedValue([]);
      chrome.bookmarks.create
        .mockResolvedValueOnce({ id: 'root1' })
        .mockResolvedValueOnce({ id: 'ungrouped1' })
        .mockResolvedValueOnce({ id: 'bm1' })
        .mockRejectedValueOnce(new Error('Bookmark failed'))  // Second bookmark fails
        .mockResolvedValueOnce({ id: 'bm3' });

      const result = await saveTabsToBookmarks();

      expect(result.savedBookmarks).toBe(2); // Only 2 out of 3 saved
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error saving bookmark'),
        expect.any(Error)
      );
    });

    test('should handle group folder creation errors', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com', title: 'GitHub', groupId: 1 }
      ];

      const mockGroups = [{ id: 1, title: 'GitHub' }];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.bookmarks.create
        .mockResolvedValueOnce({ id: 'root1' })
        .mockRejectedValueOnce(new Error('Cannot create group folder'));

      await expect(saveTabsToBookmarks()).rejects.toThrow('Cannot create group folder');
    });
  });

  describe('Return Value Validation', () => {
    test('should return correct totalTabs count', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com', title: 'GitHub', groupId: -1 },
        { id: 2, url: 'https://example.com', title: 'Example', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabGroups.query.mockResolvedValue([]);
      chrome.bookmarks.create
        .mockResolvedValueOnce({ id: 'root1' })
        .mockResolvedValueOnce({ id: 'ungrouped1' })
        .mockResolvedValueOnce({ id: 'bm1' })
        .mockResolvedValueOnce({ id: 'bm2' });

      const result = await saveTabsToBookmarks();

      expect(result.totalTabs).toBe(2);
      expect(typeof result.totalTabs).toBe('number');
    });

    test('should return correct savedBookmarks count', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com', title: 'GitHub', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabGroups.query.mockResolvedValue([]);
      chrome.bookmarks.create
        .mockResolvedValueOnce({ id: 'root1' })
        .mockResolvedValueOnce({ id: 'ungrouped1' })
        .mockResolvedValueOnce({ id: 'bm1' });

      const result = await saveTabsToBookmarks();

      expect(result.savedBookmarks).toBe(1);
      expect(typeof result.savedBookmarks).toBe('number');
    });

    test('should return correct folders count', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com/repo1', title: 'Repo 1', groupId: 1 },
        { id: 2, url: 'https://example.com', title: 'Example', groupId: -1 }
      ];

      const mockGroups = [{ id: 1, title: 'GitHub' }];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.bookmarks.create
        .mockResolvedValueOnce({ id: 'root1' })
        .mockResolvedValueOnce({ id: 'group1' })
        .mockResolvedValueOnce({ id: 'bm1' })
        .mockResolvedValueOnce({ id: 'ungrouped1' })
        .mockResolvedValueOnce({ id: 'bm2' });

      const result = await saveTabsToBookmarks();

      expect(result.folders).toBe(2); // GitHub + Ungrouped
      expect(typeof result.folders).toBe('number');
    });

    test('should have all required properties in return value', async () => {
      chrome.tabs.query.mockResolvedValue([]);
      chrome.tabGroups.query.mockResolvedValue([]);
      chrome.bookmarks.create.mockResolvedValueOnce({ id: 'root1' });

      const result = await saveTabsToBookmarks();

      expect(result).toHaveProperty('totalTabs');
      expect(result).toHaveProperty('savedBookmarks');
      expect(result).toHaveProperty('folders');
      expect(result).toHaveProperty('rootFolderName');
    });
  });

  describe('Console Logging', () => {
    test('should log success message', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com', title: 'GitHub', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabGroups.query.mockResolvedValue([]);
      chrome.bookmarks.create
        .mockResolvedValueOnce({ id: 'root1' })
        .mockResolvedValueOnce({ id: 'ungrouped1' })
        .mockResolvedValueOnce({ id: 'bm1' });

      await saveTabsToBookmarks();

      expect(console.log).toHaveBeenCalledWith('Saved 1 bookmarks in 1 folders');
    });

    test('should log bookmark creation errors', async () => {
      const mockTabs = [
        { id: 1, url: 'https://github.com', title: 'GitHub', groupId: -1 }
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabGroups.query.mockResolvedValue([]);
      const error = new Error('Bookmark failed');
      chrome.bookmarks.create
        .mockResolvedValueOnce({ id: 'root1' })
        .mockResolvedValueOnce({ id: 'ungrouped1' })
        .mockRejectedValueOnce(error);

      await saveTabsToBookmarks();

      expect(console.error).toHaveBeenCalledWith(
        'Error saving bookmark for https://github.com:',
        error
      );
    });
  });
});
