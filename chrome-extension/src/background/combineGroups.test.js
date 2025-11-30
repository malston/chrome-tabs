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

  describe('Single Source Group', () => {
    test('should move all tabs from single source group to target group', async () => {
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
        .mockResolvedValueOnce(targetGroup)
        .mockResolvedValueOnce(sourceGroup);
      chrome.tabs.query
        .mockResolvedValueOnce(sourceTabs)
        .mockResolvedValueOnce(targetTabs);
      chrome.tabs.group.mockResolvedValue(2);
      chrome.tabGroups.update.mockResolvedValue(targetGroup);

      const result = await combineGroups([1], 2);

      expect(chrome.tabGroups.get).toHaveBeenCalledWith(2);
      expect(chrome.tabGroups.get).toHaveBeenCalledWith(1);
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
        sourceGroupNames: ['Documentation'],
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
        .mockResolvedValueOnce(targetGroup)
        .mockResolvedValueOnce(sourceGroup);
      chrome.tabs.query
        .mockResolvedValueOnce(sourceTabs)
        .mockResolvedValueOnce(targetTabs);
      chrome.tabs.group.mockResolvedValue(2);
      chrome.tabGroups.update.mockResolvedValue(targetGroup);

      const result = await combineGroups([1], 2);

      expect(result.sourceGroupNames).toEqual(['Docs']);
      expect(result.targetGroupName).toBe('Dev');
      expect(result.tabsMoved).toBe(1);
      expect(result.newTargetTabCount).toBe(2);
    });
  });

  describe('Multiple Source Groups', () => {
    test('should move all tabs from multiple source groups to target group', async () => {
      const sourceGroup1 = { id: 1, title: 'Documentation (2)', color: 'blue' };
      const sourceGroup2 = { id: 3, title: 'Research (3)', color: 'red' };
      const targetGroup = { id: 2, title: 'Development (4)', color: 'green' };
      const sourceTabs1 = [
        { id: 101, groupId: 1 },
        { id: 102, groupId: 1 },
      ];
      const sourceTabs2 = [
        { id: 301, groupId: 3 },
        { id: 302, groupId: 3 },
        { id: 303, groupId: 3 },
      ];
      const targetTabs = [
        { id: 201, groupId: 2 },
        { id: 202, groupId: 2 },
        { id: 203, groupId: 2 },
        { id: 204, groupId: 2 },
      ];

      chrome.tabGroups.get
        .mockResolvedValueOnce(targetGroup)
        .mockResolvedValueOnce(sourceGroup1)
        .mockResolvedValueOnce(sourceGroup2);
      chrome.tabs.query
        .mockResolvedValueOnce(sourceTabs1)
        .mockResolvedValueOnce(sourceTabs2)
        .mockResolvedValueOnce(targetTabs);
      chrome.tabs.group.mockResolvedValue(2);
      chrome.tabGroups.update.mockResolvedValue(targetGroup);

      const result = await combineGroups([1, 3], 2);

      expect(chrome.tabs.group).toHaveBeenCalledWith({
        tabIds: [101, 102, 301, 302, 303],
        groupId: 2,
      });
      expect(chrome.tabGroups.update).toHaveBeenCalledWith(2, {
        title: 'Development (9)',
      });
      expect(result).toEqual({
        sourceGroupNames: ['Documentation', 'Research'],
        targetGroupName: 'Development',
        tabsMoved: 5,
        newTargetTabCount: 9,
      });
    });

    test('should handle three source groups', async () => {
      const sourceGroup1 = { id: 1, title: 'Group A (2)', color: 'blue' };
      const sourceGroup2 = { id: 3, title: 'Group B (2)', color: 'red' };
      const sourceGroup3 = { id: 4, title: 'Group C (2)', color: 'yellow' };
      const targetGroup = { id: 2, title: 'Target (1)', color: 'green' };

      chrome.tabGroups.get
        .mockResolvedValueOnce(targetGroup)
        .mockResolvedValueOnce(sourceGroup1)
        .mockResolvedValueOnce(sourceGroup2)
        .mockResolvedValueOnce(sourceGroup3);
      chrome.tabs.query
        .mockResolvedValueOnce([{ id: 101 }, { id: 102 }])
        .mockResolvedValueOnce([{ id: 301 }, { id: 302 }])
        .mockResolvedValueOnce([{ id: 401 }, { id: 402 }])
        .mockResolvedValueOnce([{ id: 201 }]);
      chrome.tabs.group.mockResolvedValue(2);
      chrome.tabGroups.update.mockResolvedValue(targetGroup);

      const result = await combineGroups([1, 3, 4], 2);

      expect(result.sourceGroupNames).toEqual(['Group A', 'Group B', 'Group C']);
      expect(result.tabsMoved).toBe(6);
      expect(result.newTargetTabCount).toBe(7);
    });
  });

  describe('Edge Cases', () => {
    test('should return error when all source groups have no tabs', async () => {
      const sourceGroup = { id: 1, title: 'Empty (0)', color: 'blue' };
      const targetGroup = { id: 2, title: 'Target (3)', color: 'green' };

      chrome.tabGroups.get
        .mockResolvedValueOnce(targetGroup)
        .mockResolvedValueOnce(sourceGroup);
      chrome.tabs.query.mockResolvedValueOnce([]);

      const result = await combineGroups([1], 2);

      expect(result).toEqual({ error: 'Source groups have no tabs' });
      expect(chrome.tabs.group).not.toHaveBeenCalled();
      expect(chrome.tabGroups.update).not.toHaveBeenCalled();
    });

    test('should handle many tabs across multiple source groups', async () => {
      const sourceGroup1 = { id: 1, title: 'Big1 (25)', color: 'blue' };
      const sourceGroup2 = { id: 3, title: 'Big2 (25)', color: 'red' };
      const targetGroup = { id: 2, title: 'Target (10)', color: 'green' };
      const sourceTabs1 = Array.from({ length: 25 }, (_, i) => ({
        id: i + 1,
        groupId: 1,
      }));
      const sourceTabs2 = Array.from({ length: 25 }, (_, i) => ({
        id: i + 100,
        groupId: 3,
      }));
      const targetTabs = Array.from({ length: 10 }, (_, i) => ({
        id: i + 200,
        groupId: 2,
      }));

      chrome.tabGroups.get
        .mockResolvedValueOnce(targetGroup)
        .mockResolvedValueOnce(sourceGroup1)
        .mockResolvedValueOnce(sourceGroup2);
      chrome.tabs.query
        .mockResolvedValueOnce(sourceTabs1)
        .mockResolvedValueOnce(sourceTabs2)
        .mockResolvedValueOnce(targetTabs);
      chrome.tabs.group.mockResolvedValue(2);
      chrome.tabGroups.update.mockResolvedValue(targetGroup);

      const result = await combineGroups([1, 3], 2);

      expect(result.tabsMoved).toBe(50);
      expect(result.newTargetTabCount).toBe(60);
    });

    test('should handle groups with special characters in names', async () => {
      const sourceGroup = { id: 1, title: 'Test & Dev (2)', color: 'blue' };
      const targetGroup = { id: 2, title: 'Main <Group> (3)', color: 'green' };
      const sourceTabs = [{ id: 101, groupId: 1 }, { id: 102, groupId: 1 }];
      const targetTabs = [{ id: 201, groupId: 2 }, { id: 202, groupId: 2 }, { id: 203, groupId: 2 }];

      chrome.tabGroups.get
        .mockResolvedValueOnce(targetGroup)
        .mockResolvedValueOnce(sourceGroup);
      chrome.tabs.query
        .mockResolvedValueOnce(sourceTabs)
        .mockResolvedValueOnce(targetTabs);
      chrome.tabs.group.mockResolvedValue(2);
      chrome.tabGroups.update.mockResolvedValue(targetGroup);

      const result = await combineGroups([1], 2);

      expect(result.sourceGroupNames).toEqual(['Test & Dev']);
      expect(result.targetGroupName).toBe('Main <Group>');
    });
  });

  describe('Error Handling', () => {
    test('should propagate error when chrome.tabGroups.get fails', async () => {
      chrome.tabGroups.get.mockRejectedValue(new Error('Group not found'));

      await expect(combineGroups([1], 2)).rejects.toThrow('Group not found');
    });

    test('should propagate error when chrome.tabs.group fails', async () => {
      const sourceGroup = { id: 1, title: 'Source (2)', color: 'blue' };
      const targetGroup = { id: 2, title: 'Target (2)', color: 'green' };
      const sourceTabs = [{ id: 101, groupId: 1 }, { id: 102, groupId: 1 }];
      const targetTabs = [{ id: 201, groupId: 2 }, { id: 202, groupId: 2 }];

      chrome.tabGroups.get
        .mockResolvedValueOnce(targetGroup)
        .mockResolvedValueOnce(sourceGroup);
      chrome.tabs.query
        .mockResolvedValueOnce(sourceTabs)
        .mockResolvedValueOnce(targetTabs);
      chrome.tabs.group.mockRejectedValue(new Error('Failed to group tabs'));

      await expect(combineGroups([1], 2)).rejects.toThrow('Failed to group tabs');
    });

    test('should propagate error when chrome.tabGroups.update fails', async () => {
      const sourceGroup = { id: 1, title: 'Source (2)', color: 'blue' };
      const targetGroup = { id: 2, title: 'Target (2)', color: 'green' };
      const sourceTabs = [{ id: 101, groupId: 1 }, { id: 102, groupId: 1 }];
      const targetTabs = [{ id: 201, groupId: 2 }, { id: 202, groupId: 2 }];

      chrome.tabGroups.get
        .mockResolvedValueOnce(targetGroup)
        .mockResolvedValueOnce(sourceGroup);
      chrome.tabs.query
        .mockResolvedValueOnce(sourceTabs)
        .mockResolvedValueOnce(targetTabs);
      chrome.tabs.group.mockResolvedValue(2);
      chrome.tabGroups.update.mockRejectedValue(new Error('Failed to update group'));

      await expect(combineGroups([1], 2)).rejects.toThrow('Failed to update group');
    });
  });

  describe('Return Value Validation', () => {
    test('should return all required properties for single source', async () => {
      const sourceGroup = { id: 1, title: 'Source (2)', color: 'blue' };
      const targetGroup = { id: 2, title: 'Target (3)', color: 'green' };
      const sourceTabs = [{ id: 101, groupId: 1 }, { id: 102, groupId: 1 }];
      const targetTabs = [{ id: 201, groupId: 2 }, { id: 202, groupId: 2 }, { id: 203, groupId: 2 }];

      chrome.tabGroups.get
        .mockResolvedValueOnce(targetGroup)
        .mockResolvedValueOnce(sourceGroup);
      chrome.tabs.query
        .mockResolvedValueOnce(sourceTabs)
        .mockResolvedValueOnce(targetTabs);
      chrome.tabs.group.mockResolvedValue(2);
      chrome.tabGroups.update.mockResolvedValue(targetGroup);

      const result = await combineGroups([1], 2);

      expect(result).toHaveProperty('sourceGroupNames');
      expect(result).toHaveProperty('targetGroupName');
      expect(result).toHaveProperty('tabsMoved');
      expect(result).toHaveProperty('newTargetTabCount');
      expect(Array.isArray(result.sourceGroupNames)).toBe(true);
      expect(typeof result.targetGroupName).toBe('string');
      expect(typeof result.tabsMoved).toBe('number');
      expect(typeof result.newTargetTabCount).toBe('number');
    });

    test('should return all required properties for multiple sources', async () => {
      const sourceGroup1 = { id: 1, title: 'Source1 (2)', color: 'blue' };
      const sourceGroup2 = { id: 3, title: 'Source2 (2)', color: 'red' };
      const targetGroup = { id: 2, title: 'Target (3)', color: 'green' };

      chrome.tabGroups.get
        .mockResolvedValueOnce(targetGroup)
        .mockResolvedValueOnce(sourceGroup1)
        .mockResolvedValueOnce(sourceGroup2);
      chrome.tabs.query
        .mockResolvedValueOnce([{ id: 101 }, { id: 102 }])
        .mockResolvedValueOnce([{ id: 301 }, { id: 302 }])
        .mockResolvedValueOnce([{ id: 201 }, { id: 202 }, { id: 203 }]);
      chrome.tabs.group.mockResolvedValue(2);
      chrome.tabGroups.update.mockResolvedValue(targetGroup);

      const result = await combineGroups([1, 3], 2);

      expect(result.sourceGroupNames).toHaveLength(2);
      expect(result.sourceGroupNames).toContain('Source1');
      expect(result.sourceGroupNames).toContain('Source2');
    });
  });
});
