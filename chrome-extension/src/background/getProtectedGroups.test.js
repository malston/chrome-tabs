/**
 * Unit Tests for getProtectedGroups.js
 */

// Mock Chrome APIs
global.chrome = {
  tabGroups: {
    query: jest.fn()
  },
  storage: {
    local: {
      get: jest.fn()
    }
  }
};

// Mock getProtectedGroupsFromStorage
jest.mock('./protectGroup.js', () => ({
  getProtectedGroupsFromStorage: jest.fn()
}));

const { getProtectedGroups } = require('./getProtectedGroups.js');
const { getProtectedGroupsFromStorage } = require('./protectGroup.js');

describe('getProtectedGroups', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    test('should return empty array when no protected groups', async () => {
      getProtectedGroupsFromStorage.mockResolvedValue({});
      chrome.tabGroups.query.mockResolvedValue([]);

      const result = await getProtectedGroups();

      expect(result).toEqual([]);
    });

    test('should return protected group with stillExists true when group exists', async () => {
      getProtectedGroupsFromStorage.mockResolvedValue({
        '1': {
          groupTitle: 'GitHub',
          tabCount: 5,
          bookmarkFolderId: 'folder123',
          protectedAt: '2024-01-15T10:30:00.000Z'
        }
      });
      chrome.tabGroups.query.mockResolvedValue([
        { id: 1, title: 'GitHub', color: 'blue' }
      ]);

      const result = await getProtectedGroups();

      expect(result).toEqual([{
        groupId: 1,
        title: 'GitHub',
        tabCount: 5,
        bookmarkFolderId: 'folder123',
        protectedAt: '2024-01-15T10:30:00.000Z',
        stillExists: true
      }]);
    });

    test('should return protected group with stillExists false when group no longer exists', async () => {
      getProtectedGroupsFromStorage.mockResolvedValue({
        '1': {
          groupTitle: 'Deleted Group',
          tabCount: 3,
          bookmarkFolderId: 'folder456',
          protectedAt: '2024-01-10T08:00:00.000Z'
        }
      });
      chrome.tabGroups.query.mockResolvedValue([]);

      const result = await getProtectedGroups();

      expect(result).toEqual([{
        groupId: 1,
        title: 'Deleted Group',
        tabCount: 3,
        bookmarkFolderId: 'folder456',
        protectedAt: '2024-01-10T08:00:00.000Z',
        stillExists: false
      }]);
    });
  });

  describe('Multiple Groups', () => {
    test('should handle multiple protected groups with mixed existence', async () => {
      getProtectedGroupsFromStorage.mockResolvedValue({
        '1': {
          groupTitle: 'Existing',
          tabCount: 2,
          bookmarkFolderId: 'folder1',
          protectedAt: '2024-01-15T10:00:00.000Z'
        },
        '2': {
          groupTitle: 'Deleted',
          tabCount: 4,
          bookmarkFolderId: 'folder2',
          protectedAt: '2024-01-14T09:00:00.000Z'
        },
        '3': {
          groupTitle: 'Also Existing',
          tabCount: 6,
          bookmarkFolderId: 'folder3',
          protectedAt: '2024-01-13T08:00:00.000Z'
        }
      });
      chrome.tabGroups.query.mockResolvedValue([
        { id: 1, title: 'Existing', color: 'blue' },
        { id: 3, title: 'Also Existing', color: 'red' }
      ]);

      const result = await getProtectedGroups();

      expect(result).toHaveLength(3);

      const group1 = result.find(g => g.groupId === 1);
      const group2 = result.find(g => g.groupId === 2);
      const group3 = result.find(g => g.groupId === 3);

      expect(group1.stillExists).toBe(true);
      expect(group2.stillExists).toBe(false);
      expect(group3.stillExists).toBe(true);
    });
  });

  describe('Data Conversion', () => {
    test('should convert string groupId to integer', async () => {
      getProtectedGroupsFromStorage.mockResolvedValue({
        '42': {
          groupTitle: 'Test',
          tabCount: 1,
          bookmarkFolderId: 'folder1',
          protectedAt: '2024-01-15T10:00:00.000Z'
        }
      });
      chrome.tabGroups.query.mockResolvedValue([]);

      const result = await getProtectedGroups();

      expect(result[0].groupId).toBe(42);
      expect(typeof result[0].groupId).toBe('number');
    });

    test('should include all metadata fields from storage', async () => {
      const metadata = {
        groupTitle: 'Full Metadata Test',
        tabCount: 10,
        bookmarkFolderId: 'special-folder-id',
        protectedAt: '2024-06-20T14:30:00.000Z'
      };
      getProtectedGroupsFromStorage.mockResolvedValue({ '5': metadata });
      chrome.tabGroups.query.mockResolvedValue([{ id: 5, title: 'Full Metadata Test' }]);

      const result = await getProtectedGroups();

      expect(result[0]).toEqual({
        groupId: 5,
        title: 'Full Metadata Test',
        tabCount: 10,
        bookmarkFolderId: 'special-folder-id',
        protectedAt: '2024-06-20T14:30:00.000Z',
        stillExists: true
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle group with same ID but different title in current groups', async () => {
      getProtectedGroupsFromStorage.mockResolvedValue({
        '1': {
          groupTitle: 'Original Title',
          tabCount: 3,
          bookmarkFolderId: 'folder1',
          protectedAt: '2024-01-15T10:00:00.000Z'
        }
      });
      // Group exists but with different title (user renamed it)
      chrome.tabGroups.query.mockResolvedValue([
        { id: 1, title: 'Renamed Title', color: 'green' }
      ]);

      const result = await getProtectedGroups();

      // Should still find it exists (matched by ID, not title)
      expect(result[0].stillExists).toBe(true);
      // Should return the original protected title, not current title
      expect(result[0].title).toBe('Original Title');
    });
  });
});
