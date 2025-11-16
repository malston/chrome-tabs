/**
 * Unit Tests for restoreFromBookmarks function
 *
 * Tests the bookmark restoration logic including:
 * - Restoring tabs from bookmark folders
 * - Creating new tab groups
 * - Merging into existing groups
 * - Skipping duplicates and chrome URLs
 * - Edge cases and error scenarios
 */

// Mock Chrome APIs
global.chrome = {
  bookmarks: {
    get: jest.fn(),
    getChildren: jest.fn()
  },
  tabs: {
    query: jest.fn(),
    create: jest.fn(),
    group: jest.fn()
  },
  tabGroups: {
    query: jest.fn(),
    update: jest.fn()
  },
  windows: {
    WINDOW_ID_CURRENT: -2
  }
};

// Mock console
global.console = {
  log: jest.fn(),
  error: jest.fn()
};

// Helper functions
const COLORS = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
let colorIndex = 0;

function getNextColor() {
  const color = COLORS[colorIndex % COLORS.length];
  colorIndex++;
  return color;
}

// The restoreFromBookmarks function
async function restoreFromBookmarks(bookmarkFolderId) {
  const [folder] = await chrome.bookmarks.get(bookmarkFolderId);
  if (!folder) {
    throw new Error('Bookmark folder not found');
  }

  const children = await chrome.bookmarks.getChildren(bookmarkFolderId);
  const existingTabs = await chrome.tabs.query({ currentWindow: true });
  const existingUrls = new Set(existingTabs.map(t => t.url));

  const existingGroups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
  const groupsByTitle = new Map();
  for (const group of existingGroups) {
    groupsByTitle.set(group.title, group);
  }

  let totalRestored = 0;
  let duplicatesSkipped = 0;
  let groupsCreated = 0;
  let groupsMerged = 0;

  for (const child of children) {
    if (!child.url) {
      const groupName = child.title;
      const bookmarks = await chrome.bookmarks.getChildren(child.id);

      const urlsToRestore = [];
      for (const bookmark of bookmarks) {
        if (bookmark.url &&
            !bookmark.url.startsWith('chrome://') &&
            !bookmark.url.startsWith('chrome-extension://')) {

          if (existingUrls.has(bookmark.url)) {
            duplicatesSkipped++;
          } else {
            urlsToRestore.push(bookmark.url);
            existingUrls.add(bookmark.url);
          }
        }
      }

      if (urlsToRestore.length === 0) {
        continue;
      }

      const newTabIds = [];
      for (const url of urlsToRestore) {
        try {
          const tab = await chrome.tabs.create({
            url: url,
            active: false
          });
          newTabIds.push(tab.id);
          totalRestored++;
        } catch (e) {
          console.error(`Error creating tab for ${url}:`, e);
        }
      }

      if (newTabIds.length === 0) {
        continue;
      }

      const existingGroup = groupsByTitle.get(groupName);

      if (existingGroup) {
        try {
          await chrome.tabs.group({
            tabIds: newTabIds,
            groupId: existingGroup.id
          });
          groupsMerged++;
          console.log(`Added ${newTabIds.length} tabs to existing group: ${groupName}`);
        } catch (e) {
          console.error(`Error adding tabs to group ${groupName}:`, e);
        }
      } else {
        try {
          const groupId = await chrome.tabs.group({ tabIds: newTabIds });
          await chrome.tabGroups.update(groupId, {
            title: groupName,
            color: getNextColor(),
            collapsed: false
          });
          groupsCreated++;

          const [newGroup] = await chrome.tabGroups.query({ groupId: groupId });
          groupsByTitle.set(groupName, newGroup);

          console.log(`Created new group: ${groupName} with ${newTabIds.length} tabs`);
        } catch (e) {
          console.error(`Error creating group ${groupName}:`, e);
        }
      }
    }
  }

  console.log(`Restored ${totalRestored} tabs, skipped ${duplicatesSkipped} duplicates`);

  return {
    totalRestored: totalRestored,
    duplicatesSkipped: duplicatesSkipped,
    groupsCreated: groupsCreated,
    groupsMerged: groupsMerged
  };
}

describe('restoreFromBookmarks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    colorIndex = 0;
  });

  describe('Basic Functionality', () => {
    test('should restore tabs and create new groups', async () => {
      const mockFolder = { id: 'folder1', title: 'My Saved Tabs' };
      const mockChildren = [
        { id: 'group1', title: 'GitHub', url: undefined },
        { id: 'group2', title: 'Examples', url: undefined }
      ];
      const mockBookmarks1 = [
        { id: 'bm1', url: 'https://github.com/repo1', title: 'Repo 1' },
        { id: 'bm2', url: 'https://github.com/repo2', title: 'Repo 2' }
      ];
      const mockBookmarks2 = [
        { id: 'bm3', url: 'https://example.com', title: 'Example' }
      ];

      chrome.bookmarks.get.mockResolvedValue([mockFolder]);
      chrome.bookmarks.getChildren
        .mockResolvedValueOnce(mockChildren)
        .mockResolvedValueOnce(mockBookmarks1)
        .mockResolvedValueOnce(mockBookmarks2);

      chrome.tabs.query.mockResolvedValue([]);
      chrome.tabGroups.query
        .mockResolvedValueOnce([]) // Initial query
        .mockResolvedValueOnce([{ id: 1, title: 'GitHub' }])
        .mockResolvedValueOnce([{ id: 2, title: 'Examples' }]);

      chrome.tabs.create
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 2 })
        .mockResolvedValueOnce({ id: 3 });

      chrome.tabs.group
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2);

      const result = await restoreFromBookmarks('folder1');

      expect(result.totalRestored).toBe(3);
      expect(result.duplicatesSkipped).toBe(0);
      expect(result.groupsCreated).toBe(2);
      expect(result.groupsMerged).toBe(0);
    });

    test('should merge into existing groups', async () => {
      const mockFolder = { id: 'folder1', title: 'My Saved Tabs' };
      const mockChildren = [
        { id: 'group1', title: 'GitHub', url: undefined }
      ];
      const mockBookmarks = [
        { id: 'bm1', url: 'https://github.com/repo3', title: 'Repo 3' }
      ];

      chrome.bookmarks.get.mockResolvedValue([mockFolder]);
      chrome.bookmarks.getChildren
        .mockResolvedValueOnce(mockChildren)
        .mockResolvedValueOnce(mockBookmarks);

      chrome.tabs.query.mockResolvedValue([]);
      chrome.tabGroups.query.mockResolvedValue([
        { id: 1, title: 'GitHub' }
      ]);
      chrome.tabs.create.mockResolvedValue({ id: 10 });
      chrome.tabs.group.mockResolvedValue(undefined);

      const result = await restoreFromBookmarks('folder1');

      expect(result.totalRestored).toBe(1);
      expect(result.groupsCreated).toBe(0);
      expect(result.groupsMerged).toBe(1);

      expect(chrome.tabs.group).toHaveBeenCalledWith({
        tabIds: [10],
        groupId: 1
      });
    });

    test('should skip duplicate URLs', async () => {
      const mockFolder = { id: 'folder1', title: 'My Saved Tabs' };
      const mockChildren = [
        { id: 'group1', title: 'GitHub', url: undefined }
      ];
      const mockBookmarks = [
        { id: 'bm1', url: 'https://github.com/repo1', title: 'Repo 1' },
        { id: 'bm2', url: 'https://github.com/repo2', title: 'Repo 2' }
      ];

      chrome.bookmarks.get.mockResolvedValue([mockFolder]);
      chrome.bookmarks.getChildren
        .mockResolvedValueOnce(mockChildren)
        .mockResolvedValueOnce(mockBookmarks);

      // Existing tab with duplicate URL
      chrome.tabs.query.mockResolvedValue([
        { id: 100, url: 'https://github.com/repo1' }
      ]);
      chrome.tabGroups.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1, title: 'GitHub' }]);

      chrome.tabs.create.mockResolvedValue({ id: 11 });
      chrome.tabs.group.mockResolvedValue(1);

      const result = await restoreFromBookmarks('folder1');

      expect(result.totalRestored).toBe(1); // Only repo2 restored
      expect(result.duplicatesSkipped).toBe(1); // repo1 skipped
      expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('Chrome Internal URLs', () => {
    test('should skip chrome:// URLs', async () => {
      const mockFolder = { id: 'folder1', title: 'My Saved Tabs' };
      const mockChildren = [
        { id: 'group1', title: 'Mixed', url: undefined }
      ];
      const mockBookmarks = [
        { id: 'bm1', url: 'chrome://extensions/', title: 'Extensions' },
        { id: 'bm2', url: 'https://github.com', title: 'GitHub' }
      ];

      chrome.bookmarks.get.mockResolvedValue([mockFolder]);
      chrome.bookmarks.getChildren
        .mockResolvedValueOnce(mockChildren)
        .mockResolvedValueOnce(mockBookmarks);

      chrome.tabs.query.mockResolvedValue([]);
      chrome.tabGroups.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1, title: 'Mixed' }]);
      chrome.tabs.create.mockResolvedValue({ id: 1 });
      chrome.tabs.group.mockResolvedValue(1);

      const result = await restoreFromBookmarks('folder1');

      expect(result.totalRestored).toBe(1); // Only GitHub restored
      expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
    });

    test('should skip chrome-extension:// URLs', async () => {
      const mockFolder = { id: 'folder1', title: 'My Saved Tabs' };
      const mockChildren = [
        { id: 'group1', title: 'Mixed', url: undefined }
      ];
      const mockBookmarks = [
        { id: 'bm1', url: 'chrome-extension://abc/popup.html', title: 'Ext' },
        { id: 'bm2', url: 'https://example.com', title: 'Example' }
      ];

      chrome.bookmarks.get.mockResolvedValue([mockFolder]);
      chrome.bookmarks.getChildren
        .mockResolvedValueOnce(mockChildren)
        .mockResolvedValueOnce(mockBookmarks);

      chrome.tabs.query.mockResolvedValue([]);
      chrome.tabGroups.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1, title: 'Mixed' }]);
      chrome.tabs.create.mockResolvedValue({ id: 1 });
      chrome.tabs.group.mockResolvedValue(1);

      const result = await restoreFromBookmarks('folder1');

      expect(result.totalRestored).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty bookmark folder', async () => {
      const mockFolder = { id: 'folder1', title: 'Empty' };

      chrome.bookmarks.get.mockResolvedValue([mockFolder]);
      chrome.bookmarks.getChildren.mockResolvedValue([]);
      chrome.tabs.query.mockResolvedValue([]);
      chrome.tabGroups.query.mockResolvedValue([]);

      const result = await restoreFromBookmarks('folder1');

      expect(result.totalRestored).toBe(0);
      expect(result.groupsCreated).toBe(0);
      expect(result.groupsMerged).toBe(0);
    });

    test('should skip bookmark folders with no valid URLs', async () => {
      const mockFolder = { id: 'folder1', title: 'Invalid' };
      const mockChildren = [
        { id: 'group1', title: 'Bad Group', url: undefined }
      ];
      const mockBookmarks = [
        { id: 'bm1', url: 'chrome://extensions/', title: 'Ext' }
      ];

      chrome.bookmarks.get.mockResolvedValue([mockFolder]);
      chrome.bookmarks.getChildren
        .mockResolvedValueOnce(mockChildren)
        .mockResolvedValueOnce(mockBookmarks);
      chrome.tabs.query.mockResolvedValue([]);
      chrome.tabGroups.query.mockResolvedValue([]);

      const result = await restoreFromBookmarks('folder1');

      expect(result.totalRestored).toBe(0);
      expect(result.groupsCreated).toBe(0);
    });

    test('should handle bookmark folder not found', async () => {
      chrome.bookmarks.get.mockResolvedValue([]);

      await expect(restoreFromBookmarks('nonexistent'))
        .rejects.toThrow('Bookmark folder not found');
    });
  });

  describe('Error Scenarios', () => {
    test('should handle tab creation errors', async () => {
      const mockFolder = { id: 'folder1', title: 'Test' };
      const mockChildren = [
        { id: 'group1', title: 'GitHub', url: undefined }
      ];
      const mockBookmarks = [
        { id: 'bm1', url: 'https://github.com/repo1', title: 'Repo 1' },
        { id: 'bm2', url: 'https://github.com/repo2', title: 'Repo 2' }
      ];

      chrome.bookmarks.get.mockResolvedValue([mockFolder]);
      chrome.bookmarks.getChildren
        .mockResolvedValueOnce(mockChildren)
        .mockResolvedValueOnce(mockBookmarks);
      chrome.tabs.query.mockResolvedValue([]);
      chrome.tabGroups.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1, title: 'GitHub' }]);

      chrome.tabs.create
        .mockRejectedValueOnce(new Error('Tab creation failed'))
        .mockResolvedValueOnce({ id: 2 });
      chrome.tabs.group.mockResolvedValue(1);

      const result = await restoreFromBookmarks('folder1');

      expect(result.totalRestored).toBe(1); // Only 1 succeeded
      expect(console.error).toHaveBeenCalled();
    });

    test('should handle group creation errors', async () => {
      const mockFolder = { id: 'folder1', title: 'Test' };
      const mockChildren = [
        { id: 'group1', title: 'GitHub', url: undefined }
      ];
      const mockBookmarks = [
        { id: 'bm1', url: 'https://github.com/repo1', title: 'Repo 1' }
      ];

      chrome.bookmarks.get.mockResolvedValue([mockFolder]);
      chrome.bookmarks.getChildren
        .mockResolvedValueOnce(mockChildren)
        .mockResolvedValueOnce(mockBookmarks);
      chrome.tabs.query.mockResolvedValue([]);
      chrome.tabGroups.query.mockResolvedValue([]);
      chrome.tabs.create.mockResolvedValue({ id: 1 });
      chrome.tabs.group.mockRejectedValue(new Error('Group creation failed'));

      const result = await restoreFromBookmarks('folder1');

      expect(result.totalRestored).toBe(1);
      expect(result.groupsCreated).toBe(0);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Return Value Validation', () => {
    test('should have all required properties in return value', async () => {
      chrome.bookmarks.get.mockResolvedValue([{ id: 'f1', title: 'Test' }]);
      chrome.bookmarks.getChildren.mockResolvedValue([]);
      chrome.tabs.query.mockResolvedValue([]);
      chrome.tabGroups.query.mockResolvedValue([]);

      const result = await restoreFromBookmarks('f1');

      expect(result).toHaveProperty('totalRestored');
      expect(result).toHaveProperty('duplicatesSkipped');
      expect(result).toHaveProperty('groupsCreated');
      expect(result).toHaveProperty('groupsMerged');
    });
  });
});
