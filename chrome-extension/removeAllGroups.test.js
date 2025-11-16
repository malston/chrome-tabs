// Mock Chrome API
global.chrome = {
  tabs: {
    query: jest.fn(),
    ungroup: jest.fn(),
  },
  tabGroups: {
    TAB_GROUP_ID_NONE: -1,
  },
  runtime: {
    onMessage: {
      addListener: jest.fn(),
    },
  },
};

// Import the function to test
const { removeAllGroups } = require('./background');

describe('removeAllGroups', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
  });

  describe('Basic Functionality', () => {
    test('should ungroup all grouped tabs', async () => {
      const mockTabs = [
        { id: 1, groupId: 1, title: 'Tab 1', url: 'https://example.com/1' },
        { id: 2, groupId: 2, title: 'Tab 2', url: 'https://example.com/2' },
        { id: 3, groupId: 1, title: 'Tab 3', url: 'https://example.com/3' },
        { id: 4, groupId: -1, title: 'Tab 4', url: 'https://example.com/4' }, // Already ungrouped
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.ungroup.mockResolvedValue(undefined);

      const result = await removeAllGroups();

      expect(chrome.tabs.query).toHaveBeenCalledWith({ currentWindow: true });
      expect(chrome.tabs.ungroup).toHaveBeenCalledTimes(3); // Three grouped tabs
      expect(chrome.tabs.ungroup).toHaveBeenCalledWith(1);
      expect(chrome.tabs.ungroup).toHaveBeenCalledWith(2);
      expect(chrome.tabs.ungroup).toHaveBeenCalledWith(3);
      expect(result.ungrouped).toBe(3);
    });

    test('should handle tabs with no groups', async () => {
      const mockTabs = [
        { id: 1, groupId: -1, title: 'Tab 1', url: 'https://example.com/1' },
        { id: 2, groupId: -1, title: 'Tab 2', url: 'https://example.com/2' },
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);

      const result = await removeAllGroups();

      expect(chrome.tabs.ungroup).not.toHaveBeenCalled();
      expect(result.ungrouped).toBe(0);
    });

    test('should handle all tabs being grouped', async () => {
      const mockTabs = [
        { id: 1, groupId: 1, title: 'Tab 1', url: 'https://github.com/1' },
        { id: 2, groupId: 1, title: 'Tab 2', url: 'https://github.com/2' },
        { id: 3, groupId: 2, title: 'Tab 3', url: 'https://google.com/1' },
        { id: 4, groupId: 2, title: 'Tab 4', url: 'https://google.com/2' },
        { id: 5, groupId: 3, title: 'Tab 5', url: 'https://stackoverflow.com/1' },
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.ungroup.mockResolvedValue(undefined);

      const result = await removeAllGroups();

      expect(chrome.tabs.ungroup).toHaveBeenCalledTimes(5);
      expect(result.ungrouped).toBe(5);
    });

    test('should handle single grouped tab', async () => {
      const mockTabs = [
        { id: 1, groupId: 1, title: 'Tab 1', url: 'https://example.com' },
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.ungroup.mockResolvedValue(undefined);

      const result = await removeAllGroups();

      expect(chrome.tabs.ungroup).toHaveBeenCalledTimes(1);
      expect(chrome.tabs.ungroup).toHaveBeenCalledWith(1);
      expect(result.ungrouped).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty tab list', async () => {
      chrome.tabs.query.mockResolvedValue([]);

      const result = await removeAllGroups();

      expect(chrome.tabs.ungroup).not.toHaveBeenCalled();
      expect(result.ungrouped).toBe(0);
    });

    test('should handle tabs with groupId 0', async () => {
      const mockTabs = [
        { id: 1, groupId: 0, title: 'Tab 1', url: 'https://example.com/1' },
        { id: 2, groupId: -1, title: 'Tab 2', url: 'https://example.com/2' },
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.ungroup.mockResolvedValue(undefined);

      const result = await removeAllGroups();

      // groupId 0 is a valid group (not TAB_GROUP_ID_NONE which is -1)
      expect(chrome.tabs.ungroup).toHaveBeenCalledTimes(1);
      expect(chrome.tabs.ungroup).toHaveBeenCalledWith(1);
      expect(result.ungrouped).toBe(1);
    });

    test('should handle tabs with very large group IDs', async () => {
      const mockTabs = [
        { id: 1, groupId: 999999, title: 'Tab 1', url: 'https://example.com/1' },
        { id: 2, groupId: 999999, title: 'Tab 2', url: 'https://example.com/2' },
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.ungroup.mockResolvedValue(undefined);

      const result = await removeAllGroups();

      expect(chrome.tabs.ungroup).toHaveBeenCalledTimes(2);
      expect(result.ungrouped).toBe(2);
    });

    test('should handle many groups with many tabs', async () => {
      // Create 100 tabs across 10 groups
      const mockTabs = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        groupId: Math.floor(i / 10), // 10 tabs per group
        title: `Tab ${i + 1}`,
        url: `https://example.com/${i + 1}`,
      }));

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.ungroup.mockResolvedValue(undefined);

      const result = await removeAllGroups();

      expect(chrome.tabs.ungroup).toHaveBeenCalledTimes(100);
      expect(result.ungrouped).toBe(100);
    });

    test('should handle tabs with missing groupId property', async () => {
      const mockTabs = [
        { id: 1, title: 'Tab 1', url: 'https://example.com/1' }, // No groupId
        { id: 2, groupId: 1, title: 'Tab 2', url: 'https://example.com/2' },
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.ungroup.mockResolvedValue(undefined);

      const result = await removeAllGroups();

      // Only tab 2 should be ungrouped (tab 1 has undefined groupId which !== -1)
      expect(chrome.tabs.ungroup).toHaveBeenCalledTimes(2);
    });

    test('should handle tabs with null groupId', async () => {
      const mockTabs = [
        { id: 1, groupId: null, title: 'Tab 1', url: 'https://example.com/1' },
        { id: 2, groupId: 1, title: 'Tab 2', url: 'https://example.com/2' },
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.ungroup.mockResolvedValue(undefined);

      const result = await removeAllGroups();

      // null !== -1, so null groupId tabs should be ungrouped
      expect(chrome.tabs.ungroup).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Scenarios', () => {
    test('should handle chrome.tabs.query errors', async () => {
      const error = new Error('Failed to query tabs');
      chrome.tabs.query.mockRejectedValue(error);

      await expect(removeAllGroups()).rejects.toThrow('Failed to query tabs');
      expect(chrome.tabs.ungroup).not.toHaveBeenCalled();
    });

    test('should continue if some ungroup operations fail', async () => {
      const mockTabs = [
        { id: 1, groupId: 1, title: 'Tab 1', url: 'https://example.com/1' },
        { id: 2, groupId: 2, title: 'Tab 2', url: 'https://example.com/2' },
        { id: 3, groupId: 3, title: 'Tab 3', url: 'https://example.com/3' },
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.ungroup
        .mockResolvedValueOnce(undefined) // Tab 1 succeeds
        .mockRejectedValueOnce(new Error('Tab 2 failed')) // Tab 2 fails
        .mockResolvedValueOnce(undefined); // Tab 3 succeeds

      const result = await removeAllGroups();

      expect(chrome.tabs.ungroup).toHaveBeenCalledTimes(3);
      expect(console.error).toHaveBeenCalledWith('Error ungrouping tab:', expect.any(Error));
      expect(result.ungrouped).toBe(3); // Count includes all grouped tabs, even failed ones
    });

    test('should handle all ungroup operations failing', async () => {
      const mockTabs = [
        { id: 1, groupId: 1, title: 'Tab 1', url: 'https://example.com/1' },
        { id: 2, groupId: 2, title: 'Tab 2', url: 'https://example.com/2' },
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.ungroup.mockRejectedValue(new Error('Ungroup failed'));

      const result = await removeAllGroups();

      expect(chrome.tabs.ungroup).toHaveBeenCalledTimes(2);
      expect(console.error).toHaveBeenCalledTimes(2);
      expect(result.ungrouped).toBe(2);
    });

    test('should handle ungroup errors with different error types', async () => {
      const mockTabs = [
        { id: 1, groupId: 1, title: 'Tab 1', url: 'https://example.com/1' },
        { id: 2, groupId: 2, title: 'Tab 2', url: 'https://example.com/2' },
        { id: 3, groupId: 3, title: 'Tab 3', url: 'https://example.com/3' },
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.ungroup
        .mockRejectedValueOnce(new Error('Permission denied'))
        .mockRejectedValueOnce(new TypeError('Invalid tab ID'))
        .mockRejectedValueOnce('String error');

      const result = await removeAllGroups();

      expect(console.error).toHaveBeenCalledTimes(3);
      expect(result.ungrouped).toBe(3);
    });

    test('should handle tabs with invalid IDs during ungroup', async () => {
      const mockTabs = [
        { id: -1, groupId: 1, title: 'Tab 1', url: 'https://example.com/1' },
        { id: 0, groupId: 2, title: 'Tab 2', url: 'https://example.com/2' },
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.ungroup.mockRejectedValue(new Error('Invalid tab ID'));

      const result = await removeAllGroups();

      expect(chrome.tabs.ungroup).toHaveBeenCalledWith(-1);
      expect(chrome.tabs.ungroup).toHaveBeenCalledWith(0);
      expect(console.error).toHaveBeenCalledTimes(2);
    });
  });

  describe('Return Value Validation', () => {
    test('should return correct ungrouped count', async () => {
      const mockTabs = [
        { id: 1, groupId: 1, title: 'Tab 1', url: 'https://example.com/1' },
        { id: 2, groupId: 2, title: 'Tab 2', url: 'https://example.com/2' },
        { id: 3, groupId: 3, title: 'Tab 3', url: 'https://example.com/3' },
        { id: 4, groupId: -1, title: 'Tab 4', url: 'https://example.com/4' },
        { id: 5, groupId: -1, title: 'Tab 5', url: 'https://example.com/5' },
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.ungroup.mockResolvedValue(undefined);

      const result = await removeAllGroups();

      expect(result).toHaveProperty('ungrouped');
      expect(result.ungrouped).toBe(3);
    });

    test('should have all required properties in return value', async () => {
      chrome.tabs.query.mockResolvedValue([]);

      const result = await removeAllGroups();

      expect(result).toEqual({
        ungrouped: 0,
      });
      expect(typeof result.ungrouped).toBe('number');
    });
  });

  describe('Console Logging', () => {
    test('should log when removing groups', async () => {
      const mockTabs = [
        { id: 1, groupId: 1, title: 'Tab 1', url: 'https://example.com' },
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.ungroup.mockResolvedValue(undefined);

      await removeAllGroups();

      expect(console.log).toHaveBeenCalledWith('Removing all tab groups...');
    });

    test('should log errors when ungrouping fails', async () => {
      const mockTabs = [
        { id: 1, groupId: 1, title: 'Tab 1', url: 'https://example.com' },
      ];
      const error = new Error('Ungroup failed');

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.ungroup.mockRejectedValue(error);

      await removeAllGroups();

      expect(console.error).toHaveBeenCalledWith('Error ungrouping tab:', error);
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle mixed grouped and ungrouped tabs correctly', async () => {
      const mockTabs = [
        { id: 1, groupId: 1, title: 'Grouped 1', url: 'https://example.com/1' },
        { id: 2, groupId: -1, title: 'Ungrouped 1', url: 'https://example.com/2' },
        { id: 3, groupId: 2, title: 'Grouped 2', url: 'https://example.com/3' },
        { id: 4, groupId: -1, title: 'Ungrouped 2', url: 'https://example.com/4' },
        { id: 5, groupId: 1, title: 'Grouped 3', url: 'https://example.com/5' },
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.ungroup.mockResolvedValue(undefined);

      const result = await removeAllGroups();

      // Should only ungroup tabs 1, 3, and 5
      expect(chrome.tabs.ungroup).toHaveBeenCalledTimes(3);
      expect(chrome.tabs.ungroup).toHaveBeenCalledWith(1);
      expect(chrome.tabs.ungroup).toHaveBeenCalledWith(3);
      expect(chrome.tabs.ungroup).toHaveBeenCalledWith(5);
      expect(result.ungrouped).toBe(3);
    });

    test('should work with after organizing tabs', async () => {
      // Simulate tabs that were just organized into groups
      const mockTabs = [
        { id: 1, groupId: 1, title: 'github.com - Repo 1', url: 'https://github.com/repo1' },
        { id: 2, groupId: 1, title: 'github.com - Repo 2', url: 'https://github.com/repo2' },
        { id: 3, groupId: 2, title: 'google.com - Search', url: 'https://google.com/search' },
        { id: 4, groupId: 2, title: 'google.com - Gmail', url: 'https://google.com/gmail' },
      ];

      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.ungroup.mockResolvedValue(undefined);

      const result = await removeAllGroups();

      expect(chrome.tabs.ungroup).toHaveBeenCalledTimes(4);
      expect(result.ungrouped).toBe(4);
    });
  });
});
