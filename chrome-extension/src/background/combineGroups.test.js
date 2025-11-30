// Mock Chrome API
global.chrome = {
  tabs: {
    query: jest.fn(),
    group: jest.fn(),
  },
  tabGroups: {
    get: jest.fn(),
    update: jest.fn(),
  },
  runtime: {
    onMessage: {
      addListener: jest.fn(),
    },
  },
};

// Import the function to test
const { combineGroups } = require('./combineGroups');

describe('combineGroups', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    test('should move all tabs from source group to target group', async () => {
      const sourceGroup = { id: 1, title: 'Documentation (3)', color: 'blue' };
      const targetGroup = { id: 2, title: 'Development (4)', color: 'green' };
      const sourceTabs = [
        { id: 101, groupId: 1 },
        { id: 102, groupId: 1 },
        { id: 103, groupId: 1 },
      ];
      const targetTabs = [
        { id: 201, groupId: 2 },
        { id: 202, groupId: 2 },
        { id: 203, groupId: 2 },
        { id: 204, groupId: 2 },
      ];

      chrome.tabGroups.get
        .mockResolvedValueOnce(sourceGroup)
        .mockResolvedValueOnce(targetGroup);
      chrome.tabs.query
        .mockResolvedValueOnce(sourceTabs)
        .mockResolvedValueOnce(targetTabs);
      chrome.tabs.group.mockResolvedValue(2);
      chrome.tabGroups.update.mockResolvedValue(targetGroup);

      const result = await combineGroups(1, 2);

      expect(chrome.tabGroups.get).toHaveBeenCalledWith(1);
      expect(chrome.tabGroups.get).toHaveBeenCalledWith(2);
      expect(chrome.tabs.query).toHaveBeenCalledWith({ groupId: 1 });
      expect(chrome.tabs.query).toHaveBeenCalledWith({ groupId: 2 });
      expect(chrome.tabs.group).toHaveBeenCalledWith({
        tabIds: [101, 102, 103],
        groupId: 2,
      });
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(2, {
        title: 'Development (7)',
      });
      expect(result).toEqual({
        sourceGroupName: 'Documentation',
        targetGroupName: 'Development',
        tabsMoved: 3,
        newTargetTabCount: 7,
      });
    });

    test('should handle groups without count suffix in title', async () => {
      const sourceGroup = { id: 1, title: 'Docs', color: 'blue' };
      const targetGroup = { id: 2, title: 'Dev', color: 'green' };
      const sourceTabs = [{ id: 101, groupId: 1 }];
      const targetTabs = [{ id: 201, groupId: 2 }];

      chrome.tabGroups.get
        .mockResolvedValueOnce(sourceGroup)
        .mockResolvedValueOnce(targetGroup);
      chrome.tabs.query
        .mockResolvedValueOnce(sourceTabs)
        .mockResolvedValueOnce(targetTabs);
      chrome.tabs.group.mockResolvedValue(2);
      chrome.tabGroups.update.mockResolvedValue(targetGroup);

      const result = await combineGroups(1, 2);

      expect(result.sourceGroupName).toBe('Docs');
      expect(result.targetGroupName).toBe('Dev');
      expect(result.tabsMoved).toBe(1);
      expect(result.newTargetTabCount).toBe(2);
    });

    test('should handle single tab in source group', async () => {
      const sourceGroup = { id: 1, title: 'Single (1)', color: 'blue' };
      const targetGroup = { id: 2, title: 'Target (5)', color: 'green' };
      const sourceTabs = [{ id: 101, groupId: 1 }];
      const targetTabs = [
        { id: 201, groupId: 2 },
        { id: 202, groupId: 2 },
        { id: 203, groupId: 2 },
        { id: 204, groupId: 2 },
        { id: 205, groupId: 2 },
      ];

      chrome.tabGroups.get
        .mockResolvedValueOnce(sourceGroup)
        .mockResolvedValueOnce(targetGroup);
      chrome.tabs.query
        .mockResolvedValueOnce(sourceTabs)
        .mockResolvedValueOnce(targetTabs);
      chrome.tabs.group.mockResolvedValue(2);
      chrome.tabGroups.update.mockResolvedValue(targetGroup);

      const result = await combineGroups(1, 2);

      expect(result.tabsMoved).toBe(1);
      expect(result.newTargetTabCount).toBe(6);
    });
  });

  describe('Edge Cases', () => {
    test('should return error when source group has no tabs', async () => {
      const sourceGroup = { id: 1, title: 'Empty (0)', color: 'blue' };
      const targetGroup = { id: 2, title: 'Target (3)', color: 'green' };

      chrome.tabGroups.get
        .mockResolvedValueOnce(sourceGroup)
        .mockResolvedValueOnce(targetGroup);
      chrome.tabs.query.mockResolvedValueOnce([]);

      const result = await combineGroups(1, 2);

      expect(result).toEqual({ error: 'Source group has no tabs' });
      expect(chrome.tabs.group).not.toHaveBeenCalled();
      expect(chrome.tabGroups.update).not.toHaveBeenCalled();
    });

    test('should handle many tabs in source group', async () => {
      const sourceGroup = { id: 1, title: 'Big (50)', color: 'blue' };
      const targetGroup = { id: 2, title: 'Target (10)', color: 'green' };
      const sourceTabs = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        groupId: 1,
      }));
      const targetTabs = Array.from({ length: 10 }, (_, i) => ({
        id: i + 100,
        groupId: 2,
      }));

      chrome.tabGroups.get
        .mockResolvedValueOnce(sourceGroup)
        .mockResolvedValueOnce(targetGroup);
      chrome.tabs.query
        .mockResolvedValueOnce(sourceTabs)
        .mockResolvedValueOnce(targetTabs);
      chrome.tabs.group.mockResolvedValue(2);
      chrome.tabGroups.update.mockResolvedValue(targetGroup);

      const result = await combineGroups(1, 2);

      expect(result.tabsMoved).toBe(50);
      expect(result.newTargetTabCount).toBe(60);
      expect(chrome.tabs.group).toHaveBeenCalledWith({
        tabIds: expect.arrayContaining([1, 50]),
        groupId: 2,
      });
    });

    test('should handle groups with special characters in names', async () => {
      const sourceGroup = { id: 1, title: 'Test & Dev (2)', color: 'blue' };
      const targetGroup = { id: 2, title: 'Main <Group> (3)', color: 'green' };
      const sourceTabs = [{ id: 101, groupId: 1 }, { id: 102, groupId: 1 }];
      const targetTabs = [{ id: 201, groupId: 2 }, { id: 202, groupId: 2 }, { id: 203, groupId: 2 }];

      chrome.tabGroups.get
        .mockResolvedValueOnce(sourceGroup)
        .mockResolvedValueOnce(targetGroup);
      chrome.tabs.query
        .mockResolvedValueOnce(sourceTabs)
        .mockResolvedValueOnce(targetTabs);
      chrome.tabs.group.mockResolvedValue(2);
      chrome.tabGroups.update.mockResolvedValue(targetGroup);

      const result = await combineGroups(1, 2);

      expect(result.sourceGroupName).toBe('Test & Dev');
      expect(result.targetGroupName).toBe('Main <Group>');
    });
  });

  describe('Error Handling', () => {
    test('should propagate error when chrome.tabGroups.get fails', async () => {
      chrome.tabGroups.get.mockRejectedValue(new Error('Group not found'));

      await expect(combineGroups(1, 2)).rejects.toThrow('Group not found');
    });

    test('should propagate error when chrome.tabs.group fails', async () => {
      const sourceGroup = { id: 1, title: 'Source (2)', color: 'blue' };
      const targetGroup = { id: 2, title: 'Target (2)', color: 'green' };
      const sourceTabs = [{ id: 101, groupId: 1 }, { id: 102, groupId: 1 }];
      const targetTabs = [{ id: 201, groupId: 2 }, { id: 202, groupId: 2 }];

      chrome.tabGroups.get
        .mockResolvedValueOnce(sourceGroup)
        .mockResolvedValueOnce(targetGroup);
      chrome.tabs.query
        .mockResolvedValueOnce(sourceTabs)
        .mockResolvedValueOnce(targetTabs);
      chrome.tabs.group.mockRejectedValue(new Error('Failed to group tabs'));

      await expect(combineGroups(1, 2)).rejects.toThrow('Failed to group tabs');
    });

    test('should propagate error when chrome.tabGroups.update fails', async () => {
      const sourceGroup = { id: 1, title: 'Source (2)', color: 'blue' };
      const targetGroup = { id: 2, title: 'Target (2)', color: 'green' };
      const sourceTabs = [{ id: 101, groupId: 1 }, { id: 102, groupId: 1 }];
      const targetTabs = [{ id: 201, groupId: 2 }, { id: 202, groupId: 2 }];

      chrome.tabGroups.get
        .mockResolvedValueOnce(sourceGroup)
        .mockResolvedValueOnce(targetGroup);
      chrome.tabs.query
        .mockResolvedValueOnce(sourceTabs)
        .mockResolvedValueOnce(targetTabs);
      chrome.tabs.group.mockResolvedValue(2);
      chrome.tabGroups.update.mockRejectedValue(new Error('Failed to update group'));

      await expect(combineGroups(1, 2)).rejects.toThrow('Failed to update group');
    });
  });

  describe('Return Value Validation', () => {
    test('should return all required properties', async () => {
      const sourceGroup = { id: 1, title: 'Source (2)', color: 'blue' };
      const targetGroup = { id: 2, title: 'Target (3)', color: 'green' };
      const sourceTabs = [{ id: 101, groupId: 1 }, { id: 102, groupId: 1 }];
      const targetTabs = [{ id: 201, groupId: 2 }, { id: 202, groupId: 2 }, { id: 203, groupId: 2 }];

      chrome.tabGroups.get
        .mockResolvedValueOnce(sourceGroup)
        .mockResolvedValueOnce(targetGroup);
      chrome.tabs.query
        .mockResolvedValueOnce(sourceTabs)
        .mockResolvedValueOnce(targetTabs);
      chrome.tabs.group.mockResolvedValue(2);
      chrome.tabGroups.update.mockResolvedValue(targetGroup);

      const result = await combineGroups(1, 2);

      expect(result).toHaveProperty('sourceGroupName');
      expect(result).toHaveProperty('targetGroupName');
      expect(result).toHaveProperty('tabsMoved');
      expect(result).toHaveProperty('newTargetTabCount');
      expect(typeof result.sourceGroupName).toBe('string');
      expect(typeof result.targetGroupName).toBe('string');
      expect(typeof result.tabsMoved).toBe('number');
      expect(typeof result.newTargetTabCount).toBe('number');
    });
  });
});
