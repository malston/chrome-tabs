/**
 * Unit Tests for protectGroup.js
 */

// Mock Chrome APIs
global.chrome = {
  tabGroups: {
    get: jest.fn()
  },
  tabs: {
    query: jest.fn()
  },
  bookmarks: {
    create: jest.fn()
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

// Mock getOtherBookmarksId
jest.mock('../utils/getOtherBookmarksId.js', () => ({
  getOtherBookmarksId: jest.fn().mockResolvedValue('2')
}));

const { protectGroup, getProtectedGroupsFromStorage } = require('./protectGroup.js');

describe('protectGroup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chrome.storage.local.get.mockResolvedValue({ protectedGroups: {} });
    chrome.storage.local.set.mockResolvedValue();
  });

  describe('Basic Functionality', () => {
    test('should create bookmark folder with protection naming', async () => {
      chrome.tabGroups.get.mockResolvedValue({ id: 1, title: 'GitHub' });
      chrome.tabs.query.mockResolvedValue([
        { id: 101, title: 'Tab 1', url: 'https://github.com/repo1' },
        { id: 102, title: 'Tab 2', url: 'https://github.com/repo2' }
      ]);
      chrome.bookmarks.create.mockResolvedValue({ id: 'folder123' });

      await protectGroup(1);

      // Verify folder was created with correct naming
      expect(chrome.bookmarks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: '2',
          title: expect.stringMatching(/^🔒 GitHub - \d{4}-\d{2}-\d{2}$/)
        })
      );
    });

    test('should save all tabs as bookmarks', async () => {
      chrome.tabGroups.get.mockResolvedValue({ id: 1, title: 'Work' });
      chrome.tabs.query.mockResolvedValue([
        { id: 101, title: 'Tab 1', url: 'https://example.com/1' },
        { id: 102, title: 'Tab 2', url: 'https://example.com/2' },
        { id: 103, title: 'Tab 3', url: 'https://example.com/3' }
      ]);
      chrome.bookmarks.create.mockResolvedValue({ id: 'folder123' });

      await protectGroup(1);

      // 1 folder + 3 bookmarks = 4 calls
      expect(chrome.bookmarks.create).toHaveBeenCalledTimes(4);

      // Verify each tab was saved as bookmark
      expect(chrome.bookmarks.create).toHaveBeenCalledWith({
        parentId: 'folder123',
        title: 'Tab 1',
        url: 'https://example.com/1'
      });
      expect(chrome.bookmarks.create).toHaveBeenCalledWith({
        parentId: 'folder123',
        title: 'Tab 2',
        url: 'https://example.com/2'
      });
      expect(chrome.bookmarks.create).toHaveBeenCalledWith({
        parentId: 'folder123',
        title: 'Tab 3',
        url: 'https://example.com/3'
      });
    });

    test('should store protection metadata', async () => {
      chrome.tabGroups.get.mockResolvedValue({ id: 5, title: 'Research' });
      chrome.tabs.query.mockResolvedValue([
        { id: 101, title: 'Tab 1', url: 'https://example.com' }
      ]);
      chrome.bookmarks.create.mockResolvedValue({ id: 'folder456' });

      await protectGroup(5);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        protectedGroups: expect.objectContaining({
          5: expect.objectContaining({
            bookmarkFolderId: 'folder456',
            groupTitle: 'Research',
            tabCount: 1,
            protectedAt: expect.any(String)
          })
        })
      });
    });

    test('should return success with tab count', async () => {
      chrome.tabGroups.get.mockResolvedValue({ id: 1, title: 'Project' });
      chrome.tabs.query.mockResolvedValue([
        { id: 101, title: 'Tab 1', url: 'https://example.com/1' },
        { id: 102, title: 'Tab 2', url: 'https://example.com/2' }
      ]);
      chrome.bookmarks.create.mockResolvedValue({ id: 'folder789' });

      const result = await protectGroup(1);

      expect(result).toEqual({
        success: true,
        bookmarkFolderId: 'folder789',
        tabCount: 2,
        groupTitle: 'Project'
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty group', async () => {
      chrome.tabGroups.get.mockResolvedValue({ id: 1, title: 'Empty' });
      chrome.tabs.query.mockResolvedValue([]);

      const result = await protectGroup(1);

      expect(result).toEqual({ error: 'Group has no tabs to protect' });
      expect(chrome.bookmarks.create).not.toHaveBeenCalled();
    });

    test('should handle group without title (Untitled)', async () => {
      chrome.tabGroups.get.mockResolvedValue({ id: 1, title: '' });
      chrome.tabs.query.mockResolvedValue([
        { id: 101, title: 'Tab', url: 'https://example.com' }
      ]);
      chrome.bookmarks.create.mockResolvedValue({ id: 'folder123' });

      await protectGroup(1);

      expect(chrome.bookmarks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/^🔒 Untitled - \d{4}-\d{2}-\d{2}$/)
        })
      );
    });

    test('should handle group with null title', async () => {
      chrome.tabGroups.get.mockResolvedValue({ id: 1, title: null });
      chrome.tabs.query.mockResolvedValue([
        { id: 101, title: 'Tab', url: 'https://example.com' }
      ]);
      chrome.bookmarks.create.mockResolvedValue({ id: 'folder123' });

      await protectGroup(1);

      expect(chrome.bookmarks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringMatching(/^🔒 Untitled - \d{4}-\d{2}-\d{2}$/)
        })
      );
    });

    test('should preserve existing protected groups in storage', async () => {
      chrome.storage.local.get.mockResolvedValue({
        protectedGroups: {
          10: { groupTitle: 'Old Group', tabCount: 5 }
        }
      });
      chrome.tabGroups.get.mockResolvedValue({ id: 20, title: 'New Group' });
      chrome.tabs.query.mockResolvedValue([
        { id: 101, title: 'Tab', url: 'https://example.com' }
      ]);
      chrome.bookmarks.create.mockResolvedValue({ id: 'folder123' });

      await protectGroup(20);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        protectedGroups: expect.objectContaining({
          10: { groupTitle: 'Old Group', tabCount: 5 },
          20: expect.any(Object)
        })
      });
    });
  });

  describe('Error Handling', () => {
    test('should throw when tabGroups.get fails', async () => {
      chrome.tabGroups.get.mockRejectedValue(new Error('Group not found'));

      await expect(protectGroup(999)).rejects.toThrow('Group not found');
    });

    test('should throw when bookmark creation fails', async () => {
      chrome.tabGroups.get.mockResolvedValue({ id: 1, title: 'Test' });
      chrome.tabs.query.mockResolvedValue([
        { id: 101, title: 'Tab', url: 'https://example.com' }
      ]);
      chrome.bookmarks.create.mockRejectedValue(new Error('Bookmark error'));

      await expect(protectGroup(1)).rejects.toThrow('Bookmark error');
    });
  });
});

describe('getProtectedGroupsFromStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return empty object when no protected groups', async () => {
    chrome.storage.local.get.mockResolvedValue({});

    const result = await getProtectedGroupsFromStorage();

    expect(result).toEqual({});
  });

  test('should return protected groups from storage', async () => {
    const mockGroups = {
      1: { groupTitle: 'Group A', tabCount: 5 },
      2: { groupTitle: 'Group B', tabCount: 3 }
    };
    chrome.storage.local.get.mockResolvedValue({ protectedGroups: mockGroups });

    const result = await getProtectedGroupsFromStorage();

    expect(result).toEqual(mockGroups);
  });
});
