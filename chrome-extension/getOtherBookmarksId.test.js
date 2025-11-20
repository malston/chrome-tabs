/**
 * Unit Tests for getOtherBookmarksId function
 *
 * Tests the logic to find the "Other Bookmarks" folder ID
 * instead of using hardcoded "2".
 */

// Mock Chrome APIs
global.chrome = {
  bookmarks: {
    getTree: jest.fn()
  },
  runtime: {
    onMessage: {
      addListener: jest.fn()
    }
  }
};

// Import the function
const { getOtherBookmarksId } = require('./background.js');

describe('getOtherBookmarksId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    test('should find "Other Bookmarks" folder', async () => {
      const mockTree = [{
        id: '0',
        title: '',
        children: [
          { id: '1', title: 'Bookmarks Bar' },
          { id: '2', title: 'Other Bookmarks' },
          { id: '3', title: 'Mobile Bookmarks' }
        ]
      }];

      chrome.bookmarks.getTree.mockResolvedValue(mockTree);

      const id = await getOtherBookmarksId();

      expect(id).toBe('2');
      expect(chrome.bookmarks.getTree).toHaveBeenCalledTimes(1);
    });

    test('should handle different folder order', async () => {
      const mockTree = [{
        id: '0',
        title: '',
        children: [
          { id: '1', title: 'Bookmarks Bar' },
          { id: '3', title: 'Mobile Bookmarks' },
          { id: '2', title: 'Other Bookmarks' }
        ]
      }];

      chrome.bookmarks.getTree.mockResolvedValue(mockTree);

      const id = await getOtherBookmarksId();

      expect(id).toBe('2');
    });

    test('should handle different IDs for "Other Bookmarks"', async () => {
      const mockTree = [{
        id: '0',
        title: '',
        children: [
          { id: '1', title: 'Bookmarks Bar' },
          { id: '99', title: 'Other Bookmarks' },
          { id: '3', title: 'Mobile Bookmarks' }
        ]
      }];

      chrome.bookmarks.getTree.mockResolvedValue(mockTree);

      const id = await getOtherBookmarksId();

      expect(id).toBe('99');
    });
  });

  describe('Edge Cases', () => {
    test('should throw error if "Other Bookmarks" not found', async () => {
      const mockTree = [{
        id: '0',
        title: '',
        children: [
          { id: '1', title: 'Bookmarks Bar' },
          { id: '3', title: 'Mobile Bookmarks' }
        ]
      }];

      chrome.bookmarks.getTree.mockResolvedValue(mockTree);

      await expect(getOtherBookmarksId()).rejects.toThrow('Other Bookmarks folder not found');
    });

    test('should handle empty bookmark tree', async () => {
      const mockTree = [{
        id: '0',
        title: '',
        children: []
      }];

      chrome.bookmarks.getTree.mockResolvedValue(mockTree);

      await expect(getOtherBookmarksId()).rejects.toThrow('Other Bookmarks folder not found');
    });

    test('should handle missing children array', async () => {
      const mockTree = [{
        id: '0',
        title: ''
      }];

      chrome.bookmarks.getTree.mockResolvedValue(mockTree);

      await expect(getOtherBookmarksId()).rejects.toThrow('Other Bookmarks folder not found');
    });
  });

  describe('Error Scenarios', () => {
    test('should handle chrome.bookmarks.getTree errors', async () => {
      chrome.bookmarks.getTree.mockRejectedValue(new Error('API error'));

      await expect(getOtherBookmarksId()).rejects.toThrow('API error');
    });
  });
});
