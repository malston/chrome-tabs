// Mock Chrome API
global.chrome = {
  tabs: {
    query: jest.fn(),
  },
  tabGroups: {
    query: jest.fn(),
  },
  windows: {
    WINDOW_ID_CURRENT: -2,
  },
  runtime: {
    onMessage: {
      addListener: jest.fn(),
    },
  },
};

// Import the function to test
const { getExistingGroups } = require('./getExistingGroups');

describe('getExistingGroups', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    test('should return all groups with tab counts', async () => {
      const mockGroups = [
        { id: 1, title: 'Development (4)', color: 'blue' },
        { id: 2, title: 'Documentation (3)', color: 'green' },
      ];

      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.tabs.query
        .mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]) // 4 tabs in group 1
        .mockResolvedValueOnce([{ id: 5 }, { id: 6 }, { id: 7 }]); // 3 tabs in group 2

      const result = await getExistingGroups();

      expect(chrome.tabGroups.query).toHaveBeenCalledWith({ windowId: -2 });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 1,
        title: 'Development (4)',
        baseName: 'Development',
        tabCount: 4,
        color: 'blue',
      });
      expect(result[1]).toEqual({
        id: 2,
        title: 'Documentation (3)',
        baseName: 'Documentation',
        tabCount: 3,
        color: 'green',
      });
    });

    test('should sort groups alphabetically by base name', async () => {
      const mockGroups = [
        { id: 1, title: 'Zebra (2)', color: 'blue' },
        { id: 2, title: 'Apple (3)', color: 'green' },
        { id: 3, title: 'Mango (1)', color: 'red' },
      ];

      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.tabs.query
        .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
        .mockResolvedValueOnce([{ id: 3 }, { id: 4 }, { id: 5 }])
        .mockResolvedValueOnce([{ id: 6 }]);

      const result = await getExistingGroups();

      expect(result[0].baseName).toBe('Apple');
      expect(result[1].baseName).toBe('Mango');
      expect(result[2].baseName).toBe('Zebra');
    });

    test('should handle groups without count suffix', async () => {
      const mockGroups = [
        { id: 1, title: 'Simple Group', color: 'blue' },
      ];

      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.tabs.query.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

      const result = await getExistingGroups();

      expect(result[0].baseName).toBe('Simple Group');
      expect(result[0].tabCount).toBe(2);
    });

    test('should use specific window ID when provided', async () => {
      const mockGroups = [{ id: 1, title: 'Test (2)', color: 'blue' }];

      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.tabs.query.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

      await getExistingGroups(12345);

      expect(chrome.tabGroups.query).toHaveBeenCalledWith({ windowId: 12345 });
    });
  });

  describe('Edge Cases', () => {
    test('should return empty array when no groups exist', async () => {
      chrome.tabGroups.query.mockResolvedValue([]);

      const result = await getExistingGroups();

      expect(result).toEqual([]);
    });

    test('should handle single group', async () => {
      const mockGroups = [{ id: 1, title: 'Only Group (5)', color: 'purple' }];

      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.tabs.query.mockResolvedValueOnce([
        { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 },
      ]);

      const result = await getExistingGroups();

      expect(result).toHaveLength(1);
      expect(result[0].baseName).toBe('Only Group');
      expect(result[0].tabCount).toBe(5);
    });

    test('should handle many groups', async () => {
      const mockGroups = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        title: `Group ${i + 1} (${i + 1})`,
        color: 'blue',
      }));

      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      mockGroups.forEach((_, i) => {
        chrome.tabs.query.mockResolvedValueOnce(
          Array.from({ length: i + 1 }, (_, j) => ({ id: j }))
        );
      });

      const result = await getExistingGroups();

      expect(result).toHaveLength(20);
    });

    test('should handle groups with empty titles', async () => {
      const mockGroups = [{ id: 1, title: '', color: 'blue' }];

      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.tabs.query.mockResolvedValueOnce([{ id: 1 }]);

      const result = await getExistingGroups();

      expect(result[0].baseName).toBe('');
      expect(result[0].tabCount).toBe(1);
    });

    test('should handle groups with special characters', async () => {
      const mockGroups = [
        { id: 1, title: 'Test & Dev (2)', color: 'blue' },
        { id: 2, title: 'Main <Group> (3)', color: 'green' },
      ];

      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.tabs.query
        .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
        .mockResolvedValueOnce([{ id: 3 }, { id: 4 }, { id: 5 }]);

      const result = await getExistingGroups();

      expect(result[0].baseName).toBe('Main <Group>');
      expect(result[1].baseName).toBe('Test & Dev');
    });

    test('should handle groups with numeric-only names', async () => {
      const mockGroups = [{ id: 1, title: '12345 (2)', color: 'blue' }];

      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.tabs.query.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

      const result = await getExistingGroups();

      expect(result[0].baseName).toBe('12345');
    });
  });

  describe('Error Handling', () => {
    test('should propagate error when chrome.tabGroups.query fails', async () => {
      chrome.tabGroups.query.mockRejectedValue(new Error('Query failed'));

      await expect(getExistingGroups()).rejects.toThrow('Query failed');
    });

    test('should propagate error when chrome.tabs.query fails', async () => {
      const mockGroups = [{ id: 1, title: 'Test (2)', color: 'blue' }];

      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.tabs.query.mockRejectedValue(new Error('Tab query failed'));

      await expect(getExistingGroups()).rejects.toThrow('Tab query failed');
    });
  });

  describe('Return Value Validation', () => {
    test('should return objects with all required properties', async () => {
      const mockGroups = [{ id: 1, title: 'Test (2)', color: 'blue' }];

      chrome.tabGroups.query.mockResolvedValue(mockGroups);
      chrome.tabs.query.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

      const result = await getExistingGroups();

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('title');
      expect(result[0]).toHaveProperty('baseName');
      expect(result[0]).toHaveProperty('tabCount');
      expect(result[0]).toHaveProperty('color');
      expect(typeof result[0].id).toBe('number');
      expect(typeof result[0].title).toBe('string');
      expect(typeof result[0].baseName).toBe('string');
      expect(typeof result[0].tabCount).toBe('number');
      expect(typeof result[0].color).toBe('string');
    });
  });
});
