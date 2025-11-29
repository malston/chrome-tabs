// ABOUTME: Unit tests for background.js message router.
// ABOUTME: Tests that messages are correctly routed to handler functions.

// Mock all imported modules before importing background.js
jest.mock('./organizeTabs.js', () => ({
  organizeTabs: jest.fn()
}));

jest.mock('./removeDuplicateTabs.js', () => ({
  removeDuplicateTabs: jest.fn()
}));

jest.mock('./removeAllGroups.js', () => ({
  removeAllGroups: jest.fn()
}));

jest.mock('./saveTabsToBookmarks.js', () => ({
  saveTabsToBookmarks: jest.fn()
}));

jest.mock('./restoreFromBookmarks.js', () => ({
  restoreFromBookmarks: jest.fn()
}));

jest.mock('../utils/getTabOrganizerBookmarkFolders.js', () => ({
  getTabOrganizerBookmarkFolders: jest.fn()
}));

jest.mock('../utils/categoryManager.js', () => ({
  loadCategories: jest.fn().mockResolvedValue([]),
  saveCategories: jest.fn().mockResolvedValue(),
  getCategories: jest.fn().mockReturnValue([]),
  resetCategories: jest.fn().mockResolvedValue(),
  DEFAULT_CATEGORIES: [{ id: 'test', name: 'Test', patterns: ['*test*'], enabled: true }]
}));

// Mock chrome API
global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn()
    }
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

// Import mocked modules
import { organizeTabs } from './organizeTabs.js';
import { removeDuplicateTabs } from './removeDuplicateTabs.js';
import { removeAllGroups } from './removeAllGroups.js';
import { saveTabsToBookmarks } from './saveTabsToBookmarks.js';
import { restoreFromBookmarks } from './restoreFromBookmarks.js';
import { getTabOrganizerBookmarkFolders } from '../utils/getTabOrganizerBookmarkFolders.js';
import {
  loadCategories,
  saveCategories,
  resetCategories,
  DEFAULT_CATEGORIES
} from '../utils/categoryManager.js';

describe('background.js message router', () => {
  let messageListener;
  let sendResponse;

  beforeAll(() => {
    // Import background.js to register the message listener
    require('./background.js');

    // Get the registered message listener
    messageListener = chrome.runtime.onMessage.addListener.mock.calls[0][0];
  });

  beforeEach(() => {
    jest.clearAllMocks();
    sendResponse = jest.fn();

    // Reset default mock implementations after clearAllMocks
    loadCategories.mockResolvedValue([]);
    saveCategories.mockResolvedValue();
    resetCategories.mockResolvedValue();
  });

  describe('organizeTabs action', () => {
    test('should call organizeTabs with default mode', async () => {
      organizeTabs.mockResolvedValue({ grouped: 5 });

      const result = messageListener(
        { action: 'organizeTabs' },
        {},
        sendResponse
      );

      expect(result).toBe(true); // Keep channel open
      await Promise.resolve(); // Let promise resolve

      expect(organizeTabs).toHaveBeenCalledWith('domain', false);
    });

    test('should call organizeTabs with specified mode', async () => {
      organizeTabs.mockResolvedValue({ grouped: 5 });

      messageListener(
        { action: 'organizeTabs', mode: 'category', allWindows: true },
        {},
        sendResponse
      );

      await Promise.resolve();

      expect(organizeTabs).toHaveBeenCalledWith('category', true);
    });

    test('should send response on success', async () => {
      const mockResult = { grouped: 5 };
      organizeTabs.mockResolvedValue(mockResult);

      messageListener({ action: 'organizeTabs' }, {}, sendResponse);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(sendResponse).toHaveBeenCalledWith(mockResult);
    });

    test('should send error response on failure', async () => {
      organizeTabs.mockRejectedValue(new Error('Test error'));

      messageListener({ action: 'organizeTabs' }, {}, sendResponse);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(sendResponse).toHaveBeenCalledWith({ error: 'Test error' });
    });
  });

  describe('removeDuplicates action', () => {
    test('should call removeDuplicateTabs', async () => {
      removeDuplicateTabs.mockResolvedValue({ removed: 3 });

      const result = messageListener(
        { action: 'removeDuplicates' },
        {},
        sendResponse
      );

      expect(result).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(removeDuplicateTabs).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ removed: 3 });
    });

    test('should handle errors', async () => {
      removeDuplicateTabs.mockRejectedValue(new Error('Remove failed'));

      messageListener({ action: 'removeDuplicates' }, {}, sendResponse);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(sendResponse).toHaveBeenCalledWith({ error: 'Remove failed' });
    });
  });

  describe('removeGroups action', () => {
    test('should call removeAllGroups', async () => {
      removeAllGroups.mockResolvedValue({ ungrouped: 10 });

      const result = messageListener(
        { action: 'removeGroups' },
        {},
        sendResponse
      );

      expect(result).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(removeAllGroups).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ ungrouped: 10 });
    });
  });

  describe('saveToBookmarks action', () => {
    test('should call saveTabsToBookmarks', async () => {
      saveTabsToBookmarks.mockResolvedValue({ saved: true });

      const result = messageListener(
        { action: 'saveToBookmarks' },
        {},
        sendResponse
      );

      expect(result).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(saveTabsToBookmarks).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({ saved: true });
    });
  });

  describe('getBookmarkFolders action', () => {
    test('should call getTabOrganizerBookmarkFolders', async () => {
      const folders = [{ id: '1', title: 'Folder 1' }];
      getTabOrganizerBookmarkFolders.mockResolvedValue(folders);

      const result = messageListener(
        { action: 'getBookmarkFolders' },
        {},
        sendResponse
      );

      expect(result).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(getTabOrganizerBookmarkFolders).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith(folders);
    });
  });

  describe('restoreFromBookmarks action', () => {
    test('should call restoreFromBookmarks with folderId', async () => {
      restoreFromBookmarks.mockResolvedValue({ restored: 5 });

      const result = messageListener(
        { action: 'restoreFromBookmarks', folderId: '123' },
        {},
        sendResponse
      );

      expect(result).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(restoreFromBookmarks).toHaveBeenCalledWith('123');
      expect(sendResponse).toHaveBeenCalledWith({ restored: 5 });
    });
  });

  describe('getCategories action', () => {
    test('should call loadCategories', async () => {
      const categories = [{ id: 'dev', name: 'Development' }];
      loadCategories.mockResolvedValue(categories);

      const result = messageListener(
        { action: 'getCategories' },
        {},
        sendResponse
      );

      expect(result).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(loadCategories).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith(categories);
    });
  });

  describe('saveCategories action', () => {
    test('should call saveCategories with categories', async () => {
      const categories = [{ id: 'custom', name: 'Custom' }];
      saveCategories.mockResolvedValue();

      const result = messageListener(
        { action: 'saveCategories', categories },
        {},
        sendResponse
      );

      expect(result).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(saveCategories).toHaveBeenCalledWith(categories);
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('resetCategories action', () => {
    test('should call resetCategories and return defaults', async () => {
      resetCategories.mockResolvedValue();

      const result = messageListener(
        { action: 'resetCategories' },
        {},
        sendResponse
      );

      expect(result).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(resetCategories).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        categories: DEFAULT_CATEGORIES
      });
    });
  });

  describe('reloadCategories action', () => {
    test('should call loadCategories and return result', async () => {
      const categories = [{ id: 'reloaded', name: 'Reloaded' }];
      loadCategories.mockResolvedValue(categories);

      const result = messageListener(
        { action: 'reloadCategories' },
        {},
        sendResponse
      );

      expect(result).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(loadCategories).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        categories
      });
    });
  });

  describe('unknown action', () => {
    test('should not return true for unknown actions', () => {
      const result = messageListener(
        { action: 'unknownAction' },
        {},
        sendResponse
      );

      expect(result).toBeUndefined();
      expect(sendResponse).not.toHaveBeenCalled();
    });
  });
});
