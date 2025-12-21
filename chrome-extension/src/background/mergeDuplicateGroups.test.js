// ABOUTME: Unit tests for mergeDuplicateGroups module.
// ABOUTME: Tests duplicate group detection, merging, and protected group handling.

// Mock Chrome API
global.chrome = {
  tabs: {
    query: jest.fn(),
    group: jest.fn(),
  },
  tabGroups: {
    query: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
  },
  storage: {
    local: {
      get: jest.fn(),
    },
  },
  windows: {
    WINDOW_ID_CURRENT: -2,
  },
};

const { mergeDuplicateGroups } = require('./mergeDuplicateGroups');

describe('mergeDuplicateGroups', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: no protected groups
    chrome.storage.local.get.mockResolvedValue({ protectedGroups: {} });
  });

  describe('Basic Merging', () => {
    test('should merge smaller duplicate group into larger one', async () => {
      // Two github.com groups: one with 10 tabs, one with 5 tabs
      const groups = [
        { id: 1, title: 'github.com (10)', windowId: -2 },
        { id: 2, title: 'github.com (5)', windowId: -2 },
      ];
      const group1Tabs = Array.from({ length: 10 }, (_, i) => ({ id: 100 + i, groupId: 1 }));
      const group2Tabs = Array.from({ length: 5 }, (_, i) => ({ id: 200 + i, groupId: 2 }));

      chrome.tabGroups.query.mockResolvedValue(groups);
      chrome.tabs.query
        .mockResolvedValueOnce(group1Tabs)  // tabs for group 1
        .mockResolvedValueOnce(group2Tabs); // tabs for group 2
      chrome.tabs.group.mockResolvedValue(1);
      chrome.tabGroups.update.mockResolvedValue(groups[0]);

      const result = await mergeDuplicateGroups();

      expect(chrome.tabs.group).toHaveBeenCalledWith({
        tabIds: [200, 201, 202, 203, 204],
        groupId: 1,
      });
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(1, {
        title: 'github.com',
      });
      expect(result.mergedGroups).toBe(1);
      expect(result.tabsMoved).toBe(5);
    });

    test('should not merge groups with different base names', async () => {
      const groups = [
        { id: 1, title: 'github.com (10)', windowId: -2 },
        { id: 2, title: 'gitlab.com (5)', windowId: -2 },
      ];

      chrome.tabGroups.query.mockResolvedValue(groups);

      const result = await mergeDuplicateGroups();

      expect(chrome.tabs.group).not.toHaveBeenCalled();
      expect(result.mergedGroups).toBe(0);
      expect(result.tabsMoved).toBe(0);
    });

    test('should skip groups with only numeric names', async () => {
      const groups = [
        { id: 1, title: '5', windowId: -2 },
        { id: 2, title: '5', windowId: -2 },
      ];

      chrome.tabGroups.query.mockResolvedValue(groups);

      const result = await mergeDuplicateGroups();

      expect(chrome.tabs.group).not.toHaveBeenCalled();
      expect(result.mergedGroups).toBe(0);
    });

    test('should skip groups with empty names', async () => {
      const groups = [
        { id: 1, title: '', windowId: -2 },
        { id: 2, title: '', windowId: -2 },
      ];

      chrome.tabGroups.query.mockResolvedValue(groups);

      const result = await mergeDuplicateGroups();

      expect(chrome.tabs.group).not.toHaveBeenCalled();
      expect(result.mergedGroups).toBe(0);
    });
  });

  describe('Protected Groups', () => {
    test('should merge into protected group even if it is smaller', async () => {
      const groups = [
        { id: 1, title: 'github.com (10)', windowId: -2 },
        { id: 2, title: 'github.com (5)', windowId: -2 },
      ];
      const group1Tabs = Array.from({ length: 10 }, (_, i) => ({ id: 100 + i, groupId: 1 }));
      const group2Tabs = Array.from({ length: 5 }, (_, i) => ({ id: 200 + i, groupId: 2 }));

      // Group 2 (smaller) is protected
      chrome.storage.local.get.mockResolvedValue({
        protectedGroups: { 2: { groupTitle: 'github.com' } }
      });

      chrome.tabGroups.query.mockResolvedValue(groups);
      chrome.tabs.query
        .mockResolvedValueOnce(group1Tabs)
        .mockResolvedValueOnce(group2Tabs);
      chrome.tabs.group.mockResolvedValue(2);
      chrome.tabGroups.update.mockResolvedValue(groups[1]);

      const result = await mergeDuplicateGroups();

      // Should merge group 1 INTO group 2 (protected), not the other way around
      expect(chrome.tabs.group).toHaveBeenCalledWith({
        tabIds: [100, 101, 102, 103, 104, 105, 106, 107, 108, 109],
        groupId: 2,
      });
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(2, {
        title: 'github.com',
      });
    });

    test('should skip merging when multiple duplicates are protected', async () => {
      const groups = [
        { id: 1, title: 'github.com (10)', windowId: -2 },
        { id: 2, title: 'github.com (5)', windowId: -2 },
      ];
      const group1Tabs = Array.from({ length: 10 }, (_, i) => ({ id: 100 + i, groupId: 1 }));
      const group2Tabs = Array.from({ length: 5 }, (_, i) => ({ id: 200 + i, groupId: 2 }));

      // Both are protected
      chrome.storage.local.get.mockResolvedValue({
        protectedGroups: {
          1: { groupTitle: 'github.com' },
          2: { groupTitle: 'github.com' }
        }
      });

      chrome.tabGroups.query.mockResolvedValue(groups);
      chrome.tabs.query
        .mockResolvedValueOnce(group1Tabs)
        .mockResolvedValueOnce(group2Tabs);

      const result = await mergeDuplicateGroups();

      expect(chrome.tabs.group).not.toHaveBeenCalled();
      expect(result.mergedGroups).toBe(0);
      expect(result.skippedProtected).toBe(1);
    });
  });

  describe('Multiple Duplicate Sets', () => {
    test('should handle multiple sets of duplicates', async () => {
      const groups = [
        { id: 1, title: 'github.com (10)', windowId: -2 },
        { id: 2, title: 'github.com (5)', windowId: -2 },
        { id: 3, title: 'gitlab.com (8)', windowId: -2 },
        { id: 4, title: 'gitlab.com (3)', windowId: -2 },
      ];

      chrome.tabGroups.query.mockResolvedValue(groups);
      chrome.tabs.query
        .mockResolvedValueOnce(Array.from({ length: 10 }, (_, i) => ({ id: 100 + i, groupId: 1 })))
        .mockResolvedValueOnce(Array.from({ length: 5 }, (_, i) => ({ id: 200 + i, groupId: 2 })))
        .mockResolvedValueOnce(Array.from({ length: 8 }, (_, i) => ({ id: 300 + i, groupId: 3 })))
        .mockResolvedValueOnce(Array.from({ length: 3 }, (_, i) => ({ id: 400 + i, groupId: 4 })));
      chrome.tabs.group.mockResolvedValue(1);
      chrome.tabGroups.update.mockResolvedValue({});

      const result = await mergeDuplicateGroups();

      expect(result.mergedGroups).toBe(2);
      expect(result.tabsMoved).toBe(8); // 5 from github + 3 from gitlab
    });
  });

  describe('Edge Cases', () => {
    test('should return message when no duplicates found', async () => {
      const groups = [
        { id: 1, title: 'github.com (10)', windowId: -2 },
        { id: 2, title: 'gitlab.com (5)', windowId: -2 },
      ];

      chrome.tabGroups.query.mockResolvedValue(groups);

      const result = await mergeDuplicateGroups();

      expect(result.message).toBe('No duplicate groups to merge');
    });

    test('should handle groups with no tabs gracefully', async () => {
      const groups = [
        { id: 1, title: 'github.com (10)', windowId: -2 },
        { id: 2, title: 'github.com (0)', windowId: -2 },
      ];

      chrome.tabGroups.query.mockResolvedValue(groups);
      chrome.tabs.query
        .mockResolvedValueOnce(Array.from({ length: 10 }, (_, i) => ({ id: 100 + i, groupId: 1 })))
        .mockResolvedValueOnce([]); // Empty group

      const result = await mergeDuplicateGroups();

      // Should not attempt to merge empty group
      expect(chrome.tabs.group).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle tabGroups.query failure', async () => {
      chrome.tabGroups.query.mockRejectedValue(new Error('Failed to query tab groups'));

      const result = await mergeDuplicateGroups();

      expect(result.errors).toBe(1);
      expect(result.mergedGroups).toBe(0);
      expect(result.message).toContain('Failed to merge groups');
      expect(console.error).toHaveBeenCalledWith(
        'Failed to merge duplicate groups:',
        expect.any(Error)
      );
    });

    test('should handle tabs.query failure for individual groups', async () => {
      const groups = [
        { id: 1, title: 'github.com (10)', windowId: -2 },
        { id: 2, title: 'github.com (5)', windowId: -2 },
      ];

      chrome.tabGroups.query.mockResolvedValue(groups);
      chrome.tabs.query
        .mockRejectedValueOnce(new Error('Failed to query tabs')) // Group 1 fails
        .mockResolvedValueOnce(Array.from({ length: 5 }, (_, i) => ({ id: 200 + i, groupId: 2 }))); // Group 2 succeeds

      const result = await mergeDuplicateGroups();

      // Should treat failed group as having 0 tabs and not merge
      expect(chrome.tabs.group).not.toHaveBeenCalled();
      expect(result.mergedGroups).toBe(0);
      expect(console.error).toHaveBeenCalledWith(
        'Failed to query tabs for group 1:',
        expect.any(Error)
      );
    });

    test('should handle tabs.group failure and continue with other merges', async () => {
      const groups = [
        { id: 1, title: 'github.com (10)', windowId: -2 },
        { id: 2, title: 'github.com (5)', windowId: -2 },
        { id: 3, title: 'gitlab.com (8)', windowId: -2 },
        { id: 4, title: 'gitlab.com (3)', windowId: -2 },
      ];

      chrome.tabGroups.query.mockResolvedValue(groups);
      chrome.tabs.query
        .mockResolvedValueOnce(Array.from({ length: 10 }, (_, i) => ({ id: 100 + i, groupId: 1 })))
        .mockResolvedValueOnce(Array.from({ length: 5 }, (_, i) => ({ id: 200 + i, groupId: 2 })))
        .mockResolvedValueOnce(Array.from({ length: 8 }, (_, i) => ({ id: 300 + i, groupId: 3 })))
        .mockResolvedValueOnce(Array.from({ length: 3 }, (_, i) => ({ id: 400 + i, groupId: 4 })));

      // First merge (github.com) fails, second (gitlab.com) succeeds
      chrome.tabs.group
        .mockRejectedValueOnce(new Error('Failed to group tabs'))
        .mockResolvedValueOnce(3);
      chrome.tabGroups.update.mockResolvedValue({});

      const result = await mergeDuplicateGroups();

      expect(result.errors).toBe(1);
      expect(result.mergedGroups).toBe(1); // gitlab.com merged successfully
      expect(result.tabsMoved).toBe(3);
      expect(result.message).toContain('with 1 errors');
      expect(console.error).toHaveBeenCalledWith(
        'Failed to merge groups for "github.com":',
        expect.any(Error)
      );
    });

    test('should handle tabGroups.update failure', async () => {
      const groups = [
        { id: 1, title: 'github.com (10)', windowId: -2 },
        { id: 2, title: 'github.com (5)', windowId: -2 },
      ];
      const group1Tabs = Array.from({ length: 10 }, (_, i) => ({ id: 100 + i, groupId: 1 }));
      const group2Tabs = Array.from({ length: 5 }, (_, i) => ({ id: 200 + i, groupId: 2 }));

      chrome.tabGroups.query.mockResolvedValue(groups);
      chrome.tabs.query
        .mockResolvedValueOnce(group1Tabs)
        .mockResolvedValueOnce(group2Tabs);
      chrome.tabs.group.mockResolvedValue(1);
      chrome.tabGroups.update.mockRejectedValue(new Error('Failed to update group'));

      const result = await mergeDuplicateGroups();

      // Merge operation itself succeeds, but update fails
      expect(chrome.tabs.group).toHaveBeenCalled();
      expect(result.errors).toBe(1);
      expect(console.error).toHaveBeenCalledWith(
        'Failed to merge groups for "github.com":',
        expect.any(Error)
      );
    });

    test('should provide appropriate error message when all merges fail', async () => {
      const groups = [
        { id: 1, title: 'github.com (10)', windowId: -2 },
        { id: 2, title: 'github.com (5)', windowId: -2 },
      ];

      chrome.tabGroups.query.mockResolvedValue(groups);
      chrome.tabs.query
        .mockResolvedValueOnce(Array.from({ length: 10 }, (_, i) => ({ id: 100 + i, groupId: 1 })))
        .mockResolvedValueOnce(Array.from({ length: 5 }, (_, i) => ({ id: 200 + i, groupId: 2 })));
      chrome.tabs.group.mockRejectedValue(new Error('Failed to group tabs'));

      const result = await mergeDuplicateGroups();

      expect(result.errors).toBe(1);
      expect(result.mergedGroups).toBe(0);
      expect(result.message).toBe('Failed to merge groups (1 errors)');
    });

    test('should handle invalid query response', async () => {
      chrome.tabGroups.query.mockResolvedValue('invalid response');

      const result = await mergeDuplicateGroups();

      expect(result.errors).toBe(1);
      expect(result.message).toContain('Failed to query tab groups: invalid response');
    });
  });
});

// Add console.error mock to prevent test output pollution
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  console.error.mockRestore();
});
