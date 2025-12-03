/**
 * Unit Tests for getTabOrganizerBookmarkFolders function
 *
 * Tests the bookmark folder retrieval logic including:
 * - Finding Tab Organizer folders in "Other Bookmarks"
 * - Filtering by folder name prefix
 * - Sorting by timestamp (newest first)
 * - Edge cases (no folders, mixed content, malformed data)
 * - Error scenarios
 */

// Mock Chrome API
global.chrome = {
  tabs: {
    query: jest.fn(),
    ungroup: jest.fn(),
  },
  tabGroups: {
    TAB_GROUP_ID_NONE: -1,
  },
  bookmarks: {
    getTree: jest.fn(),
    getChildren: jest.fn(),
  },
  runtime: {
    onMessage: {
      addListener: jest.fn(),
    },
  },
};

// Import the function to test
const { getTabOrganizerBookmarkFolders } = require('./getTabOrganizerBookmarkFolders.js');

describe('getTabOrganizerBookmarkFolders', () => {
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
    console.log = jest.fn();
    console.error = jest.fn();
  });

  describe('Basic Functionality', () => {
    test('should return Tab Organizer folders from Other Bookmarks', async () => {
      const mockChildren = [
        { id: '100', title: 'Tab Organizer - 2024-01-15 14:30:00' },
        { id: '101', title: 'Tab Organizer - 2024-01-14 10:00:00' },
        { id: '102', title: 'Some Other Folder' },
        { id: '103', title: 'Tab Organizer - 2024-01-16 09:00:00' },
      ];

      chrome.bookmarks.getChildren.mockResolvedValue(mockChildren);

      const result = await getTabOrganizerBookmarkFolders();

      expect(chrome.bookmarks.getChildren).toHaveBeenCalledWith('2'); // "2" is "Other Bookmarks"
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ id: '103', title: 'Tab Organizer - 2024-01-16 09:00:00' });
      expect(result[1]).toEqual({ id: '100', title: 'Tab Organizer - 2024-01-15 14:30:00' });
      expect(result[2]).toEqual({ id: '101', title: 'Tab Organizer - 2024-01-14 10:00:00' });
    });

    test('should sort folders by title in reverse order (newest first)', async () => {
      const mockChildren = [
        { id: '1', title: 'Tab Organizer - 2024-01-10' },
        { id: '2', title: 'Tab Organizer - 2024-01-20' },
        { id: '3', title: 'Tab Organizer - 2024-01-15' },
      ];

      chrome.bookmarks.getChildren.mockResolvedValue(mockChildren);

      const result = await getTabOrganizerBookmarkFolders();

      expect(result).toEqual([
        { id: '2', title: 'Tab Organizer - 2024-01-20' },
        { id: '3', title: 'Tab Organizer - 2024-01-15' },
        { id: '1', title: 'Tab Organizer - 2024-01-10' },
      ]);
    });

    test('should filter out bookmarks (items with URLs)', async () => {
      const mockChildren = [
        { id: '1', title: 'Tab Organizer - 2024-01-15', url: 'https://example.com' },
        { id: '2', title: 'Tab Organizer - 2024-01-16' },
        { id: '3', title: 'Regular Bookmark', url: 'https://github.com' },
      ];

      chrome.bookmarks.getChildren.mockResolvedValue(mockChildren);

      const result = await getTabOrganizerBookmarkFolders();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: '2', title: 'Tab Organizer - 2024-01-16' });
    });

    test('should filter out folders that do not start with "Tab Organizer -"', async () => {
      const mockChildren = [
        { id: '1', title: 'Tab Organizer - 2024-01-15' },
        { id: '2', title: 'My Tabs' },
        { id: '3', title: 'Tab Organizer' }, // Missing the dash
        { id: '4', title: 'Old Tab Organizer - 2024-01-10' },
        { id: '5', title: 'tab organizer - 2024-01-12' }, // Wrong case
      ];

      chrome.bookmarks.getChildren.mockResolvedValue(mockChildren);

      const result = await getTabOrganizerBookmarkFolders();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: '1', title: 'Tab Organizer - 2024-01-15' });
    });

    test('should return only id and title properties', async () => {
      const mockChildren = [
        {
          id: '1',
          title: 'Tab Organizer - 2024-01-15',
          dateAdded: 1705329600000,
          dateGroupModified: 1705329600000,
          index: 0,
          parentId: '2',
        },
      ];

      chrome.bookmarks.getChildren.mockResolvedValue(mockChildren);

      const result = await getTabOrganizerBookmarkFolders();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: '1',
        title: 'Tab Organizer - 2024-01-15',
      });
      expect(result[0]).not.toHaveProperty('dateAdded');
      expect(result[0]).not.toHaveProperty('parentId');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty Other Bookmarks folder', async () => {
      chrome.bookmarks.getChildren.mockResolvedValue([]);

      const result = await getTabOrganizerBookmarkFolders();

      expect(result).toEqual([]);
    });

    test('should handle no Tab Organizer folders', async () => {
      const mockChildren = [
        { id: '1', title: 'Regular Folder' },
        { id: '2', title: 'Work Bookmarks' },
        { id: '3', title: 'Personal', url: 'https://example.com' },
      ];

      chrome.bookmarks.getChildren.mockResolvedValue(mockChildren);

      const result = await getTabOrganizerBookmarkFolders();

      expect(result).toEqual([]);
    });

    test('should handle single Tab Organizer folder', async () => {
      const mockChildren = [
        { id: '1', title: 'Tab Organizer - 2024-01-15 10:30:45' },
      ];

      chrome.bookmarks.getChildren.mockResolvedValue(mockChildren);

      const result = await getTabOrganizerBookmarkFolders();

      expect(result).toEqual([
        { id: '1', title: 'Tab Organizer - 2024-01-15 10:30:45' },
      ]);
    });

    test('should handle folders with missing title property', async () => {
      const mockChildren = [
        { id: '1', title: 'Tab Organizer - 2024-01-15' },
        { id: '2' }, // Missing title
        { id: '3', title: null }, // Null title
        { id: '4', title: '' }, // Empty title
      ];

      chrome.bookmarks.getChildren.mockResolvedValue(mockChildren);

      const result = await getTabOrganizerBookmarkFolders();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: '1', title: 'Tab Organizer - 2024-01-15' });
    });

    test('should handle folders with whitespace in title', async () => {
      const mockChildren = [
        { id: '1', title: '  Tab Organizer - 2024-01-15' }, // Leading whitespace
        { id: '2', title: 'Tab Organizer - 2024-01-16  ' }, // Trailing whitespace
        { id: '3', title: 'Tab Organizer - 2024-01-17' }, // Normal
      ];

      chrome.bookmarks.getChildren.mockResolvedValue(mockChildren);

      const result = await getTabOrganizerBookmarkFolders();

      // Only the ones without leading whitespace should match (trailing is OK)
      expect(result).toHaveLength(2);
      // Sorted in reverse order: '17' > '16'
      expect(result[0].id).toBe('3');
      expect(result[1].id).toBe('2');
    });

    test('should handle folders with similar names', async () => {
      const mockChildren = [
        { id: '1', title: 'Tab Organizer - 2024-01-15' },
        { id: '2', title: 'Tab Organizer -' }, // Just the prefix
        { id: '3', title: 'Tab Organizer - ' }, // Prefix with space
        { id: '4', title: 'Tab Organizer -2024-01-15' }, // No space after dash
      ];

      chrome.bookmarks.getChildren.mockResolvedValue(mockChildren);

      const result = await getTabOrganizerBookmarkFolders();

      // All should match because they all start with "Tab Organizer -"
      expect(result).toHaveLength(4);
    });

    test('should handle many Tab Organizer folders', async () => {
      const mockChildren = Array.from({ length: 100 }, (_, i) => ({
        id: String(i),
        title: `Tab Organizer - 2024-01-${String(i + 1).padStart(2, '0')}`,
      }));

      chrome.bookmarks.getChildren.mockResolvedValue(mockChildren);

      const result = await getTabOrganizerBookmarkFolders();

      expect(result).toHaveLength(100);
      // Should be sorted in reverse lexical order (newest first by string comparison)
      // "99" comes last in lexical order, "01" comes first
      expect(result[0].title).toContain('2024-01-99');
      expect(result[99].title).toContain('2024-01-01');
    });

    test('should handle folders with identical timestamps', async () => {
      const mockChildren = [
        { id: '1', title: 'Tab Organizer - 2024-01-15 10:00:00' },
        { id: '2', title: 'Tab Organizer - 2024-01-15 10:00:00' },
        { id: '3', title: 'Tab Organizer - 2024-01-15 10:00:00' },
      ];

      chrome.bookmarks.getChildren.mockResolvedValue(mockChildren);

      const result = await getTabOrganizerBookmarkFolders();

      expect(result).toHaveLength(3);
      // Order should be stable for identical titles
    });

    test('should handle mixed folders and bookmarks', async () => {
      const mockChildren = [
        { id: '1', title: 'Tab Organizer - 2024-01-15' }, // Folder
        { id: '2', title: 'Tab Organizer - 2024-01-16', url: 'https://example.com' }, // Bookmark
        { id: '3', title: 'Regular Folder' }, // Folder
        { id: '4', title: 'Regular Bookmark', url: 'https://github.com' }, // Bookmark
        { id: '5', title: 'Tab Organizer - 2024-01-17' }, // Folder
      ];

      chrome.bookmarks.getChildren.mockResolvedValue(mockChildren);

      const result = await getTabOrganizerBookmarkFolders();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: '5', title: 'Tab Organizer - 2024-01-17' });
      expect(result[1]).toEqual({ id: '1', title: 'Tab Organizer - 2024-01-15' });
    });

    test('should handle special characters in folder names', async () => {
      const mockChildren = [
        { id: '1', title: 'Tab Organizer - 2024-01-15 (backup)' },
        { id: '2', title: 'Tab Organizer - 2024-01-16 [important]' },
        { id: '3', title: 'Tab Organizer - 2024-01-17 @ 10:30' },
      ];

      chrome.bookmarks.getChildren.mockResolvedValue(mockChildren);

      const result = await getTabOrganizerBookmarkFolders();

      expect(result).toHaveLength(3);
    });

    test('should handle unicode characters in folder names', async () => {
      const mockChildren = [
        { id: '1', title: 'Tab Organizer - 2024-01-15 📁' },
        { id: '2', title: 'Tab Organizer - 2024-01-16 日本語' },
        { id: '3', title: 'Tab Organizer - 2024-01-17 émojis' },
      ];

      chrome.bookmarks.getChildren.mockResolvedValue(mockChildren);

      const result = await getTabOrganizerBookmarkFolders();

      expect(result).toHaveLength(3);
    });

    test('should include protected group folders starting with 🔒', async () => {
      const mockChildren = [
        { id: '1', title: '🔒 github.com - 2024-01-15' },
        { id: '2', title: 'Tab Organizer - 2024-01-16' },
        { id: '3', title: '🔒 work-tabs - 2024-01-17' },
        { id: '4', title: 'Some Other Folder' },
      ];

      chrome.bookmarks.getChildren.mockResolvedValue(mockChildren);

      const result = await getTabOrganizerBookmarkFolders();

      expect(result).toHaveLength(3);
      // Should include both Tab Organizer and protected group folders
      expect(result.map(f => f.id)).toContain('1');
      expect(result.map(f => f.id)).toContain('2');
      expect(result.map(f => f.id)).toContain('3');
    });

    test('should handle only protected group folders', async () => {
      const mockChildren = [
        { id: '1', title: '🔒 github.com - 2024-01-15' },
        { id: '2', title: '🔒 stackoverflow.com - 2024-01-16' },
      ];

      chrome.bookmarks.getChildren.mockResolvedValue(mockChildren);

      const result = await getTabOrganizerBookmarkFolders();

      expect(result).toHaveLength(2);
    });

    test('should handle very long folder names', async () => {
      const longName = 'Tab Organizer - ' + 'a'.repeat(500);
      const mockChildren = [
        { id: '1', title: longName },
      ];

      chrome.bookmarks.getChildren.mockResolvedValue(mockChildren);

      const result = await getTabOrganizerBookmarkFolders();

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe(longName);
    });
  });

  describe('Error Scenarios', () => {
    test('should handle chrome.bookmarks.getChildren errors', async () => {
      const error = new Error('Failed to get bookmarks');
      chrome.bookmarks.getChildren.mockRejectedValue(error);

      await expect(getTabOrganizerBookmarkFolders()).rejects.toThrow('Failed to get bookmarks');
    });

    test('should handle permission denied errors', async () => {
      const error = new Error('Bookmark permission denied');
      chrome.bookmarks.getChildren.mockRejectedValue(error);

      await expect(getTabOrganizerBookmarkFolders()).rejects.toThrow('Bookmark permission denied');
    });

    test('should handle invalid bookmark tree structure', async () => {
      const mockChildren = null;
      chrome.bookmarks.getChildren.mockResolvedValue(mockChildren);

      await expect(getTabOrganizerBookmarkFolders()).rejects.toThrow();
    });

    test('should handle malformed bookmark objects', async () => {
      const mockChildren = [
        { id: '1', title: 'Tab Organizer - 2024-01-15' },
        {},
        { id: '2', title: 'Tab Organizer - 2024-01-16' }, // Missing id doesn't matter, it has one
      ];

      chrome.bookmarks.getChildren.mockResolvedValue(mockChildren);

      // Should filter out invalid items and process valid ones
      const result = await getTabOrganizerBookmarkFolders();

      // Valid Tab Organizer folders should be returned
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: '2', title: 'Tab Organizer - 2024-01-16' });
      expect(result[1]).toEqual({ id: '1', title: 'Tab Organizer - 2024-01-15' });
    });

    test('should handle bookmark tree not found', async () => {
      const error = new Error('Bookmark tree not found');
      chrome.bookmarks.getChildren.mockRejectedValue(error);

      await expect(getTabOrganizerBookmarkFolders()).rejects.toThrow('Bookmark tree not found');
    });

    test('should handle different error types', async () => {
      chrome.bookmarks.getChildren.mockRejectedValue(new TypeError('Type error'));

      await expect(getTabOrganizerBookmarkFolders()).rejects.toThrow(TypeError);
    });

    test('should handle string errors', async () => {
      chrome.bookmarks.getChildren.mockRejectedValue('String error message');

      await expect(getTabOrganizerBookmarkFolders()).rejects.toBe('String error message');
    });
  });

  describe('Sorting Logic', () => {
    test('should sort by timestamp in descending order', async () => {
      const mockChildren = [
        { id: '1', title: 'Tab Organizer - 2024-01-01' },
        { id: '2', title: 'Tab Organizer - 2024-12-31' },
        { id: '3', title: 'Tab Organizer - 2024-06-15' },
        { id: '4', title: 'Tab Organizer - 2024-03-20' },
      ];

      chrome.bookmarks.getChildren.mockResolvedValue(mockChildren);

      const result = await getTabOrganizerBookmarkFolders();

      expect(result.map(f => f.id)).toEqual(['2', '3', '4', '1']);
    });

    test('should handle alphabetical sorting correctly', async () => {
      const mockChildren = [
        { id: '1', title: 'Tab Organizer - ABC' },
        { id: '2', title: 'Tab Organizer - ZYX' },
        { id: '3', title: 'Tab Organizer - MNO' },
      ];

      chrome.bookmarks.getChildren.mockResolvedValue(mockChildren);

      const result = await getTabOrganizerBookmarkFolders();

      expect(result.map(f => f.id)).toEqual(['2', '3', '1']);
    });

    test('should handle numeric sorting in strings', async () => {
      const mockChildren = [
        { id: '1', title: 'Tab Organizer - 10' },
        { id: '2', title: 'Tab Organizer - 2' },
        { id: '3', title: 'Tab Organizer - 100' },
        { id: '4', title: 'Tab Organizer - 20' },
      ];

      chrome.bookmarks.getChildren.mockResolvedValue(mockChildren);

      const result = await getTabOrganizerBookmarkFolders();

      // localeCompare does lexical sorting, not numeric
      // In reverse lexical order: "2" < "20" < "100" < "10"
      // So reverse order is: "2", "20", "100", "10"
      expect(result[0].id).toBe('4'); // "20" comes last in reverse
    });
  });

  describe('Console Logging', () => {
    test('should log when getting bookmark folders', async () => {
      chrome.bookmarks.getChildren.mockResolvedValue([]);

      await getTabOrganizerBookmarkFolders();

      expect(console.log).toHaveBeenCalledWith('Getting Tab Organizer bookmark folders...');
    });

    test('should log even when no folders found', async () => {
      chrome.bookmarks.getChildren.mockResolvedValue([
        { id: '1', title: 'Other Folder' },
      ]);

      await getTabOrganizerBookmarkFolders();

      expect(console.log).toHaveBeenCalledWith('Getting Tab Organizer bookmark folders...');
    });
  });

  describe('Return Value Validation', () => {
    test('should return array of objects with id and title', async () => {
      const mockChildren = [
        { id: '1', title: 'Tab Organizer - 2024-01-15' },
        { id: '2', title: 'Tab Organizer - 2024-01-16' },
      ];

      chrome.bookmarks.getChildren.mockResolvedValue(mockChildren);

      const result = await getTabOrganizerBookmarkFolders();

      expect(Array.isArray(result)).toBe(true);
      result.forEach(folder => {
        expect(folder).toHaveProperty('id');
        expect(folder).toHaveProperty('title');
        expect(typeof folder.id).toBe('string');
        expect(typeof folder.title).toBe('string');
      });
    });

    test('should return empty array when no matches', async () => {
      chrome.bookmarks.getChildren.mockResolvedValue([]);

      const result = await getTabOrganizerBookmarkFolders();

      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    test('should not modify original bookmark objects', async () => {
      const mockChildren = [
        {
          id: '1',
          title: 'Tab Organizer - 2024-01-15',
          dateAdded: 123456,
          extra: 'data',
        },
      ];

      chrome.bookmarks.getChildren.mockResolvedValue(mockChildren);

      await getTabOrganizerBookmarkFolders();

      // Original object should still have all properties
      expect(mockChildren[0]).toHaveProperty('dateAdded');
      expect(mockChildren[0]).toHaveProperty('extra');
    });
  });
});
