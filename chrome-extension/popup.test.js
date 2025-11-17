/**
 * Unit Tests for popup.js
 *
 * Tests the popup UI logic including:
 * - Button click event handlers
 * - Status message display
 * - Communication with background script
 * - Bookmark folder selection
 * - Edge cases and error scenarios
 */

// Mock DOM elements and methods
const createMockElement = (id) => {
  const listeners = {};
  const element = {
    id,
    disabled: false,
    textContent: '',
    className: '',
    style: { display: '' },
    innerHTML: '',
    value: '',
    options: [],
    classList: {
      add: function(className) {
        if (!element.className.includes(className)) {
          element.className += (element.className ? ' ' : '') + className;
        }
      },
      remove: function(className) {
        element.className = element.className
          .split(' ')
          .filter(c => c !== className)
          .join(' ');
      },
      contains: function(className) {
        return element.className.split(' ').includes(className);
      }
    },
    addEventListener: (event, handler) => {
      listeners[event] = handler;
    },
    click: function() {
      if (listeners.click && !this.disabled) {
        listeners.click();
      }
    },
    appendChild: function(child) {
      this.options.push(child);
    },
    querySelectorAll: () => [],
  };
  return element;
};

const createElement = (tag) => {
  return {
    value: '',
    textContent: '',
  };
};

// Setup DOM environment
let organizeBtn, organizeCategoryBtn, dedupeBtn, saveBookmarksBtn, restoreBookmarksBtn, removeGroupsBtn;
let statusDiv, bookmarkSelector, folderSelect, restoreSelectedBtn, cancelSelectBtn;
const allButtons = [];

// Mock Chrome API
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
  },
};

// Mock document
global.document = {
  getElementById: (id) => {
    switch(id) {
      case 'organizeBtn': return organizeBtn;
      case 'organizeCategoryBtn': return organizeCategoryBtn;
      case 'dedupeBtn': return dedupeBtn;
      case 'saveBookmarksBtn': return saveBookmarksBtn;
      case 'restoreBookmarksBtn': return restoreBookmarksBtn;
      case 'removeGroupsBtn': return removeGroupsBtn;
      case 'status': return statusDiv;
      case 'bookmarkSelector': return bookmarkSelector;
      case 'folderSelect': return folderSelect;
      case 'restoreSelectedBtn': return restoreSelectedBtn;
      case 'cancelSelectBtn': return cancelSelectBtn;
      default: return null;
    }
  },
  createElement: createElement,
  querySelectorAll: (selector) => allButtons,
};

function setupDOM() {
  organizeBtn = createMockElement('organizeBtn');
  organizeCategoryBtn = createMockElement('organizeCategoryBtn');
  dedupeBtn = createMockElement('dedupeBtn');
  saveBookmarksBtn = createMockElement('saveBookmarksBtn');
  restoreBookmarksBtn = createMockElement('restoreBookmarksBtn');
  removeGroupsBtn = createMockElement('removeGroupsBtn');
  statusDiv = createMockElement('status');
  bookmarkSelector = createMockElement('bookmarkSelector');
  folderSelect = createMockElement('folderSelect');
  folderSelect.options = [];
  folderSelect.innerHTML = '';
  restoreSelectedBtn = createMockElement('restoreSelectedBtn');
  cancelSelectBtn = createMockElement('cancelSelectBtn');

  allButtons.length = 0;
  allButtons.push(organizeBtn, organizeCategoryBtn, dedupeBtn, saveBookmarksBtn, restoreBookmarksBtn, removeGroupsBtn);
  allButtons.forEach = function(callback) {
    for (let i = 0; i < this.length; i++) {
      callback(this[i]);
    }
  };
}

describe('popup.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    setupDOM();

    // Clear any previous event listeners by re-requiring the module
    jest.resetModules();
    require('./popup.js');
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('showStatus function', () => {
    test('should display success message', () => {
      const message = 'Operation successful!';

      // Trigger an event that calls showStatus
      chrome.runtime.sendMessage.mockResolvedValue({
        groupedTabs: 10,
        groups: 3
      });

      organizeBtn.click();

      return Promise.resolve().then(() => {
        expect(statusDiv.textContent).toContain('Organized 10 tabs into 3 groups!');
        expect(statusDiv.className).toContain('success');
        expect(statusDiv.className).toContain('show');
      });
    });

    test('should display error message', () => {
      chrome.runtime.sendMessage.mockResolvedValue({
        error: 'Something went wrong'
      });

      organizeBtn.click();

      return Promise.resolve().then(() => {
        expect(statusDiv.textContent).toContain('Error: Something went wrong');
        expect(statusDiv.className).toContain('error');
        expect(statusDiv.className).toContain('show');
      });
    });

    test('should hide status after 3 seconds', () => {
      chrome.runtime.sendMessage.mockResolvedValue({
        groupedTabs: 10,
        groups: 3
      });

      organizeBtn.click();

      return Promise.resolve().then(() => {
        expect(statusDiv.className).toContain('show');

        // Fast-forward time by 3 seconds
        jest.advanceTimersByTime(3000);

        expect(statusDiv.className).not.toContain('show');
      });
    });
  });

  describe('Organize by Domain button', () => {
    test('should send organizeTabs message with domain mode', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({
        groupedTabs: 10,
        groups: 3
      });

      organizeBtn.click();

      await Promise.resolve();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'organizeTabs',
        mode: 'domain'
      });
    });

    test('should disable button while organizing', () => {
      chrome.runtime.sendMessage.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ groupedTabs: 10, groups: 3 }), 100))
      );

      expect(organizeBtn.disabled).toBe(false);
      organizeBtn.click();

      expect(organizeBtn.disabled).toBe(true);
      expect(organizeBtn.textContent).toBe('Organizing...');
    });

    test('should re-enable button after completion', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({
        groupedTabs: 10,
        groups: 3
      });

      organizeBtn.click();

      await Promise.resolve();
      await Promise.resolve();

      expect(organizeBtn.disabled).toBe(false);
      expect(organizeBtn.textContent).toBe('Organize by Domain');
    });

    test('should display success status', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({
        groupedTabs: 15,
        groups: 5
      });

      organizeBtn.click();

      await Promise.resolve();

      expect(statusDiv.textContent).toBe('✓ Organized 15 tabs into 5 groups!');
      expect(statusDiv.className).toContain('success');
    });

    test('should display error status on failure', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({
        error: 'Failed to organize'
      });

      organizeBtn.click();

      await Promise.resolve();

      expect(statusDiv.textContent).toBe('Error: Failed to organize');
      expect(statusDiv.className).toContain('error');
    });

    test('should handle exception from sendMessage', async () => {
      chrome.runtime.sendMessage.mockRejectedValue(new Error('Connection failed'));

      organizeBtn.click();

      await Promise.resolve();
      await Promise.resolve();

      expect(statusDiv.textContent).toBe('Error: Connection failed');
      expect(statusDiv.className).toContain('error');
    });
  });

  describe('Organize by Category button', () => {
    test('should send organizeTabs message with category mode', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({
        groupedTabs: 8,
        groups: 4
      });

      organizeCategoryBtn.click();

      await Promise.resolve();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'organizeTabs',
        mode: 'category'
      });
    });

    test('should disable button while organizing', () => {
      chrome.runtime.sendMessage.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ groupedTabs: 8, groups: 4 }), 100))
      );

      organizeCategoryBtn.click();

      expect(organizeCategoryBtn.disabled).toBe(true);
      expect(organizeCategoryBtn.textContent).toBe('Organizing...');
    });

    test('should display success status with "categories"', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({
        groupedTabs: 12,
        groups: 3
      });

      organizeCategoryBtn.click();

      await Promise.resolve();

      expect(statusDiv.textContent).toBe('✓ Organized 12 tabs into 3 categories!');
    });
  });

  describe('Remove Duplicates button', () => {
    test('should send removeDuplicates message', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({
        duplicatesClosed: 5
      });

      dedupeBtn.click();

      await Promise.resolve();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'removeDuplicates'
      });
    });

    test('should disable button while finding duplicates', () => {
      chrome.runtime.sendMessage.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ duplicatesClosed: 5 }), 100))
      );

      dedupeBtn.click();

      expect(dedupeBtn.disabled).toBe(true);
      expect(dedupeBtn.textContent).toBe('Finding duplicates...');
    });

    test('should display success when duplicates found', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({
        duplicatesClosed: 7
      });

      dedupeBtn.click();

      await Promise.resolve();

      expect(statusDiv.textContent).toBe('✓ Removed 7 duplicate tabs!');
    });

    test('should display message when no duplicates found', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({
        duplicatesClosed: 0
      });

      dedupeBtn.click();

      await Promise.resolve();

      expect(statusDiv.textContent).toBe('✓ No duplicates found!');
    });
  });

  describe('Save to Bookmarks button', () => {
    test('should send saveToBookmarks message', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({
        savedBookmarks: 20,
        folders: 3
      });

      saveBookmarksBtn.click();

      await Promise.resolve();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'saveToBookmarks'
      });
    });

    test('should disable button while saving', () => {
      chrome.runtime.sendMessage.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ savedBookmarks: 20, folders: 3 }), 100))
      );

      saveBookmarksBtn.click();

      expect(saveBookmarksBtn.disabled).toBe(true);
      expect(saveBookmarksBtn.textContent).toBe('Saving...');
    });

    test('should display success status', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({
        savedBookmarks: 25,
        folders: 4
      });

      saveBookmarksBtn.click();

      await Promise.resolve();

      expect(statusDiv.textContent).toBe('✓ Saved 25 bookmarks in 4 folders!');
    });
  });

  describe('Restore from Bookmarks button', () => {
    test('should send getBookmarkFolders message', async () => {
      chrome.runtime.sendMessage.mockResolvedValue([
        { id: '1', title: 'Tab Organizer - 2024-01-15' },
        { id: '2', title: 'Tab Organizer - 2024-01-16' }
      ]);

      restoreBookmarksBtn.click();

      await Promise.resolve();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'getBookmarkFolders'
      });
    });

    test('should disable button while loading', () => {
      chrome.runtime.sendMessage.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve([]), 100))
      );

      restoreBookmarksBtn.click();

      expect(restoreBookmarksBtn.disabled).toBe(true);
      expect(restoreBookmarksBtn.textContent).toBe('Loading...');
    });

    test('should show bookmark selector when folders found', async () => {
      chrome.runtime.sendMessage.mockResolvedValue([
        { id: '1', title: 'Tab Organizer - 2024-01-15' },
        { id: '2', title: 'Tab Organizer - 2024-01-16' }
      ]);

      restoreBookmarksBtn.click();

      await Promise.resolve();

      expect(bookmarkSelector.style.display).toBe('block');
      expect(organizeBtn.style.display).toBe('none');
      expect(folderSelect.options.length).toBe(2);
      expect(folderSelect.options[0].value).toBe('1');
      expect(folderSelect.options[0].textContent).toBe('Tab Organizer - 2024-01-15');
    });

    test('should show error when no folders found', async () => {
      chrome.runtime.sendMessage.mockResolvedValue([]);

      restoreBookmarksBtn.click();

      await Promise.resolve();

      expect(statusDiv.textContent).toBe('No saved bookmark folders found');
      expect(statusDiv.className).toContain('error');
      // Bookmark selector was never shown, so display should be empty string (initial value)
      expect(bookmarkSelector.style.display).not.toBe('block');
    });

    test('should handle error response', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({
        error: 'Failed to load folders'
      });

      restoreBookmarksBtn.click();

      await Promise.resolve();

      expect(statusDiv.textContent).toBe('Error: Failed to load folders');
    });
  });

  describe('Restore Selected button', () => {
    beforeEach(async () => {
      // First load bookmark folders
      chrome.runtime.sendMessage.mockResolvedValue([
        { id: '100', title: 'Tab Organizer - 2024-01-15' },
        { id: '101', title: 'Tab Organizer - 2024-01-16' }
      ]);

      restoreBookmarksBtn.click();
      await Promise.resolve();

      // Select the first folder
      folderSelect.value = '100';
    });

    test('should send restoreFromBookmarks message with selected folder', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({
        totalRestored: 15,
        groupsCreated: 3,
        groupsMerged: 1,
        duplicatesSkipped: 2
      });

      restoreSelectedBtn.click();

      await Promise.resolve();
      await Promise.resolve();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'restoreFromBookmarks',
        folderId: '100'
      });
    });

    test('should show error when no folder selected', async () => {
      folderSelect.value = '';

      restoreSelectedBtn.click();

      await Promise.resolve();

      expect(statusDiv.textContent).toBe('Please select a folder');
      expect(statusDiv.className).toContain('error');
    });

    test('should disable button while restoring', () => {
      chrome.runtime.sendMessage.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ totalRestored: 15 }), 100))
      );

      restoreSelectedBtn.click();

      expect(restoreSelectedBtn.disabled).toBe(true);
      expect(restoreSelectedBtn.textContent).toBe('Restoring...');
    });

    test('should display success with all counts', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({
        totalRestored: 20,
        groupsCreated: 4,
        groupsMerged: 2,
        duplicatesSkipped: 3
      });

      restoreSelectedBtn.click();

      await Promise.resolve();
      await Promise.resolve();

      expect(statusDiv.textContent).toContain('✓ Restored 20 tabs!');
      expect(statusDiv.textContent).toContain('Created 4 new groups.');
      expect(statusDiv.textContent).toContain('Merged into 2 existing groups.');
      expect(statusDiv.textContent).toContain('Skipped 3 duplicates.');
    });

    test('should display success without optional counts', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({
        totalRestored: 10,
        groupsCreated: 0,
        groupsMerged: 0,
        duplicatesSkipped: 0
      });

      restoreSelectedBtn.click();

      await Promise.resolve();
      await Promise.resolve();

      expect(statusDiv.textContent).toBe('✓ Restored 10 tabs!');
    });

    test('should hide selector and show main buttons after restore', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({
        totalRestored: 10,
        groupsCreated: 2,
        groupsMerged: 0,
        duplicatesSkipped: 0
      });

      restoreSelectedBtn.click();

      await Promise.resolve();
      await Promise.resolve();

      expect(bookmarkSelector.style.display).toBe('none');
      expect(organizeBtn.style.display).toBe('block');
    });
  });

  describe('Cancel Select button', () => {
    beforeEach(async () => {
      // Show bookmark selector
      chrome.runtime.sendMessage.mockResolvedValue([
        { id: '1', title: 'Tab Organizer - 2024-01-15' }
      ]);

      restoreBookmarksBtn.click();
      await Promise.resolve();
    });

    test('should hide selector and show main buttons', () => {
      expect(bookmarkSelector.style.display).toBe('block');

      cancelSelectBtn.click();

      expect(bookmarkSelector.style.display).toBe('none');
      expect(organizeBtn.style.display).toBe('block');
    });
  });

  describe('Remove All Groups button', () => {
    test('should send removeGroups message', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({});

      removeGroupsBtn.click();

      await Promise.resolve();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'removeGroups'
      });
    });

    test('should disable button while removing', () => {
      chrome.runtime.sendMessage.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({}), 100))
      );

      removeGroupsBtn.click();

      expect(removeGroupsBtn.disabled).toBe(true);
      expect(removeGroupsBtn.textContent).toBe('Removing...');
    });

    test('should display success status', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({});

      removeGroupsBtn.click();

      await Promise.resolve();

      expect(statusDiv.textContent).toBe('✓ All groups removed!');
    });
  });

  describe('Edge Cases', () => {
    test('should handle multiple quick clicks on same button', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({
        groupedTabs: 10,
        groups: 3
      });

      organizeBtn.click();
      organizeBtn.click(); // Second click while first is processing
      organizeBtn.click(); // Third click

      await Promise.resolve();

      // Should only send one message because button is disabled
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    });

    test('should handle clicks on different buttons', async () => {
      chrome.runtime.sendMessage
        .mockResolvedValueOnce({ groupedTabs: 10, groups: 3 })
        .mockResolvedValueOnce({ duplicatesClosed: 5 });

      organizeBtn.click();
      await Promise.resolve();

      dedupeBtn.click();
      await Promise.resolve();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
    });

    test('should handle status message with special characters', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({
        error: '<script>alert("XSS")</script>'
      });

      organizeBtn.click();

      await Promise.resolve();

      // textContent should escape HTML
      expect(statusDiv.innerHTML).not.toContain('<script>');
      expect(statusDiv.textContent).toContain('<script>');
    });

    test('should handle very long error messages', async () => {
      const longError = 'Error: ' + 'a'.repeat(1000);
      chrome.runtime.sendMessage.mockResolvedValue({
        error: longError
      });

      organizeBtn.click();

      await Promise.resolve();

      expect(statusDiv.textContent).toContain(longError);
    });

    test('should handle missing response properties', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({});

      dedupeBtn.click();

      await Promise.resolve();

      // duplicatesClosed is undefined, will show "Removed undefined duplicate tabs!"
      // This is expected behavior - the response should always include duplicatesClosed
      expect(statusDiv.textContent).toBe('✓ Removed undefined duplicate tabs!');
    });
  });

  describe('Error Scenarios', () => {
    test('should handle network errors', async () => {
      chrome.runtime.sendMessage.mockRejectedValue(new Error('Network error'));

      organizeBtn.click();

      await Promise.resolve();
      await Promise.resolve();

      expect(statusDiv.textContent).toBe('Error: Network error');
      expect(organizeBtn.disabled).toBe(false);
    });

    test('should handle timeout errors', async () => {
      chrome.runtime.sendMessage.mockRejectedValue(new Error('Request timeout'));

      dedupeBtn.click();

      await Promise.resolve();
      await Promise.resolve();

      expect(statusDiv.textContent).toBe('Error: Request timeout');
    });

    test('should re-enable button on error', async () => {
      chrome.runtime.sendMessage.mockRejectedValue(new Error('Failed'));

      organizeBtn.click();

      await Promise.resolve();
      await Promise.resolve();

      expect(organizeBtn.disabled).toBe(false);
      expect(organizeBtn.textContent).toBe('Organize by Domain');
    });

    test('should handle error in restoreFromBookmarks', async () => {
      // Setup folder selection
      chrome.runtime.sendMessage.mockResolvedValue([
        { id: '1', title: 'Test Folder' }
      ]);

      restoreBookmarksBtn.click();
      await Promise.resolve();

      folderSelect.value = '1';

      // Now trigger error on restore
      chrome.runtime.sendMessage.mockResolvedValue({
        error: 'Failed to restore tabs'
      });

      restoreSelectedBtn.click();

      await Promise.resolve();
      await Promise.resolve();

      expect(statusDiv.textContent).toBe('Error: Failed to restore tabs');
    });
  });
});
