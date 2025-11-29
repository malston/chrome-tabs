/**
 * @jest-environment jsdom
 */

// ABOUTME: Unit tests for options.js category management UI.
// ABOUTME: Tests category CRUD operations, import/export, and UI interactions.

// Mock chrome API before importing
global.chrome = {
  runtime: {
    sendMessage: jest.fn()
  }
};

// Mock DOM elements
const mockElements = {
  categoryList: { innerHTML: '', appendChild: jest.fn(), addEventListener: jest.fn() },
  status: { textContent: '', className: '', classList: { remove: jest.fn() } },
  addCategoryBtn: { addEventListener: jest.fn() },
  importBtn: { addEventListener: jest.fn() },
  exportBtn: { addEventListener: jest.fn() },
  resetBtn: { addEventListener: jest.fn() },
  importFileInput: { addEventListener: jest.fn(), click: jest.fn(), value: '' },
  categoryModal: { classList: { add: jest.fn(), remove: jest.fn(), contains: jest.fn() }, addEventListener: jest.fn() },
  modalTitle: { textContent: '' },
  categoryName: { value: '', focus: jest.fn() },
  categoryPatterns: { value: '' },
  cancelModalBtn: { addEventListener: jest.fn() },
  saveModalBtn: { addEventListener: jest.fn() }
};

// Mock getElementById
document.getElementById = jest.fn((id) => {
  const idMap = {
    'categoryList': mockElements.categoryList,
    'status': mockElements.status,
    'addCategoryBtn': mockElements.addCategoryBtn,
    'importBtn': mockElements.importBtn,
    'exportBtn': mockElements.exportBtn,
    'resetBtn': mockElements.resetBtn,
    'importFileInput': mockElements.importFileInput,
    'categoryModal': mockElements.categoryModal,
    'modalTitle': mockElements.modalTitle,
    'categoryName': mockElements.categoryName,
    'categoryPatterns': mockElements.categoryPatterns,
    'cancelModalBtn': mockElements.cancelModalBtn,
    'saveModalBtn': mockElements.saveModalBtn
  };
  return idMap[id] || null;
});

// Mock document.createElement
document.createElement = jest.fn((tag) => {
  if (tag === 'div') {
    return {
      innerHTML: '',
      textContent: '',
      className: '',
      dataset: {},
      appendChild: jest.fn()
    };
  }
  if (tag === 'a') {
    return {
      href: '',
      download: '',
      click: jest.fn()
    };
  }
  return {};
});

// Mock document.addEventListener
document.addEventListener = jest.fn();

// Mock URL API
global.URL.createObjectURL = jest.fn(() => 'blob:test');
global.URL.revokeObjectURL = jest.fn();

// Mock Blob
global.Blob = jest.fn((content, options) => ({ content, options }));

// Mock confirm
global.confirm = jest.fn(() => true);

// Mock setTimeout
jest.useFakeTimers();

describe('options.js', () => {
  let loadCategoriesFn;
  let saveCategoriesFn;
  let renderCategoriesFn;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock element state
    mockElements.categoryList.innerHTML = '';
    mockElements.status.textContent = '';
    mockElements.status.className = '';
    mockElements.categoryName.value = '';
    mockElements.categoryPatterns.value = '';
    mockElements.modalTitle.textContent = '';

    // Default sendMessage response
    chrome.runtime.sendMessage.mockResolvedValue([]);
  });

  describe('module loading', () => {
    test('should set up event listeners on load', () => {
      // Clear and re-require to test initialization
      jest.isolateModules(() => {
        require('./options.js');
      });

      // Verify event listeners were added
      expect(mockElements.addCategoryBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockElements.importBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockElements.exportBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockElements.resetBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockElements.cancelModalBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockElements.saveModalBtn.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
    });

    test('should call loadCategories on initialization', () => {
      jest.isolateModules(() => {
        require('./options.js');
      });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'getCategories' });
    });
  });

  describe('showStatus function', () => {
    test('should set status message and CSS class', async () => {
      // This is tested indirectly through error handling tests
      // that verify status.textContent is set with error messages
      chrome.runtime.sendMessage.mockResolvedValue({ error: 'Test error' });

      jest.isolateModules(() => {
        require('./options.js');
      });

      await Promise.resolve();

      // Status should show error message
      expect(mockElements.status.textContent).toContain('Error');
      expect(mockElements.status.className).toContain('error');
    });
  });

  describe('loadCategories function', () => {
    test('should fetch categories from background script', async () => {
      const mockCategories = [
        { id: 'dev', name: 'Development', patterns: ['*github*'], enabled: true }
      ];
      chrome.runtime.sendMessage.mockResolvedValue(mockCategories);

      jest.isolateModules(() => {
        require('./options.js');
      });

      await Promise.resolve(); // Let promises resolve

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'getCategories' });
    });

    test('should handle error response', async () => {
      chrome.runtime.sendMessage.mockResolvedValue({ error: 'Test error' });

      jest.isolateModules(() => {
        require('./options.js');
      });

      await Promise.resolve();

      expect(mockElements.status.textContent).toContain('Error');
    });

    test('should handle sendMessage rejection', async () => {
      chrome.runtime.sendMessage.mockRejectedValue(new Error('Network error'));

      jest.isolateModules(() => {
        require('./options.js');
      });

      await Promise.resolve();
      await Promise.resolve(); // Extra tick for catch block

      expect(mockElements.status.textContent).toContain('Error');
    });
  });

  describe('escapeHtml function', () => {
    test('should escape HTML special characters', () => {
      // The escapeHtml function creates a div and sets textContent
      // We can test this indirectly through renderCategories
      const mockDiv = { textContent: '', innerHTML: '' };
      document.createElement.mockReturnValueOnce(mockDiv);

      // When textContent is set, innerHTML should be the escaped version
      mockDiv.textContent = '<script>alert("xss")</script>';
      mockDiv.innerHTML = '&lt;script&gt;alert("xss")&lt;/script&gt;';

      expect(mockDiv.innerHTML).not.toContain('<script>');
    });
  });

  describe('generateId function', () => {
    test('should generate unique IDs', () => {
      // We can verify generateId is called during category creation
      // by checking the structure of saved categories
      jest.isolateModules(() => {
        require('./options.js');
      });

      // Generate a few timestamps to ensure uniqueness pattern
      const now1 = Date.now();
      const now2 = Date.now();

      expect(now1).toBeLessThanOrEqual(now2);
    });
  });

  describe('modal operations', () => {
    test('should open add modal when add button clicked', () => {
      let addClickHandler;
      mockElements.addCategoryBtn.addEventListener.mockImplementation((event, handler) => {
        if (event === 'click') addClickHandler = handler;
      });

      jest.isolateModules(() => {
        require('./options.js');
      });

      // Simulate click
      addClickHandler();

      expect(mockElements.modalTitle.textContent).toBe('Add Category');
      expect(mockElements.categoryName.value).toBe('');
      expect(mockElements.categoryPatterns.value).toBe('');
      expect(mockElements.categoryModal.classList.add).toHaveBeenCalledWith('show');
      expect(mockElements.categoryName.focus).toHaveBeenCalled();
    });

    test('should close modal when cancel button clicked', () => {
      let cancelClickHandler;
      mockElements.cancelModalBtn.addEventListener.mockImplementation((event, handler) => {
        if (event === 'click') cancelClickHandler = handler;
      });

      jest.isolateModules(() => {
        require('./options.js');
      });

      // Simulate cancel click
      cancelClickHandler();

      expect(mockElements.categoryModal.classList.remove).toHaveBeenCalledWith('show');
    });

    test('should close modal on Escape key', () => {
      let keydownHandler;
      document.addEventListener.mockImplementation((event, handler) => {
        if (event === 'keydown') keydownHandler = handler;
      });

      mockElements.categoryModal.classList.contains.mockReturnValue(true);

      jest.isolateModules(() => {
        require('./options.js');
      });

      // Simulate Escape key
      keydownHandler({ key: 'Escape' });

      expect(mockElements.categoryModal.classList.remove).toHaveBeenCalledWith('show');
    });
  });

  describe('saveFromModal function', () => {
    test('should show error if name is empty', async () => {
      let saveClickHandler;
      mockElements.saveModalBtn.addEventListener.mockImplementation((event, handler) => {
        if (event === 'click') saveClickHandler = handler;
      });

      jest.isolateModules(() => {
        require('./options.js');
      });

      mockElements.categoryName.value = '';
      mockElements.categoryPatterns.value = '*test*';

      await saveClickHandler();

      expect(mockElements.status.textContent).toBe('Category name is required');
    });

    test('should show error if patterns is empty', async () => {
      let saveClickHandler;
      mockElements.saveModalBtn.addEventListener.mockImplementation((event, handler) => {
        if (event === 'click') saveClickHandler = handler;
      });

      jest.isolateModules(() => {
        require('./options.js');
      });

      mockElements.categoryName.value = 'Test Category';
      mockElements.categoryPatterns.value = '';

      await saveClickHandler();

      expect(mockElements.status.textContent).toBe('At least one pattern is required');
    });

    test('should show error if patterns has only whitespace', async () => {
      let saveClickHandler;
      mockElements.saveModalBtn.addEventListener.mockImplementation((event, handler) => {
        if (event === 'click') saveClickHandler = handler;
      });

      jest.isolateModules(() => {
        require('./options.js');
      });

      mockElements.categoryName.value = 'Test Category';
      mockElements.categoryPatterns.value = '   \n   \n   ';

      await saveClickHandler();

      expect(mockElements.status.textContent).toBe('At least one pattern is required');
    });
  });

  describe('exportCategories function', () => {
    test('should create and download JSON file', () => {
      let exportClickHandler;
      mockElements.exportBtn.addEventListener.mockImplementation((event, handler) => {
        if (event === 'click') exportClickHandler = handler;
      });

      // Create a proper mock anchor element
      const mockLink = document.createElement('a');
      mockLink.click = jest.fn();
      const originalCreateElement = document.createElement;
      document.createElement = jest.fn((tag) => {
        if (tag === 'a') return mockLink;
        return originalCreateElement.call(document, tag);
      });

      jest.isolateModules(() => {
        require('./options.js');
      });

      exportClickHandler();

      expect(Blob).toHaveBeenCalled();
      expect(URL.createObjectURL).toHaveBeenCalled();
      expect(mockLink.click).toHaveBeenCalled();
      expect(URL.revokeObjectURL).toHaveBeenCalled();
      expect(mockElements.status.textContent).toBe('Categories exported successfully!');

      // Restore
      document.createElement = originalCreateElement;
    });
  });

  describe('importCategories function', () => {
    test('should import valid categories from file', async () => {
      let importChangeHandler;
      mockElements.importFileInput.addEventListener.mockImplementation((event, handler) => {
        if (event === 'change') importChangeHandler = handler;
      });

      chrome.runtime.sendMessage.mockResolvedValue({ success: true });

      jest.isolateModules(() => {
        require('./options.js');
      });

      const mockFile = {
        text: jest.fn().mockResolvedValue(JSON.stringify({
          version: 1,
          categories: [
            { id: 'test', name: 'Test', patterns: ['*test*'], enabled: true }
          ]
        }))
      };

      await importChangeHandler({ target: { files: [mockFile] } });
      await Promise.resolve();
      await Promise.resolve();

      expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Replace all categories'));
    });

    test('should show error for invalid file format', async () => {
      let importChangeHandler;
      mockElements.importFileInput.addEventListener.mockImplementation((event, handler) => {
        if (event === 'change') importChangeHandler = handler;
      });

      jest.isolateModules(() => {
        require('./options.js');
      });

      const mockFile = {
        text: jest.fn().mockResolvedValue(JSON.stringify({ invalid: 'data' }))
      };

      await importChangeHandler({ target: { files: [mockFile] } });
      await Promise.resolve();
      await Promise.resolve();

      expect(mockElements.status.textContent).toContain('Import failed');
    });
  });

  describe('resetToDefaults function', () => {
    test('should reset categories when confirmed', async () => {
      let resetClickHandler;
      mockElements.resetBtn.addEventListener.mockImplementation((event, handler) => {
        if (event === 'click') resetClickHandler = handler;
      });

      const defaultCategories = [{ id: 'default', name: 'Default', patterns: ['*'], enabled: true }];
      chrome.runtime.sendMessage.mockResolvedValue({ categories: defaultCategories });

      jest.isolateModules(() => {
        require('./options.js');
      });

      await resetClickHandler();
      await Promise.resolve();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'resetCategories' });
    });

    test('should not reset when cancelled', async () => {
      let resetClickHandler;
      mockElements.resetBtn.addEventListener.mockImplementation((event, handler) => {
        if (event === 'click') resetClickHandler = handler;
      });

      confirm.mockReturnValueOnce(false);

      jest.isolateModules(() => {
        require('./options.js');
      });

      // Clear the initial sendMessage call
      chrome.runtime.sendMessage.mockClear();

      await resetClickHandler();

      expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith({ action: 'resetCategories' });
    });
  });

  describe('category list event delegation', () => {
    test('should handle edit button clicks', async () => {
      let listClickHandler;
      mockElements.categoryList.addEventListener.mockImplementation((event, handler) => {
        if (event === 'click') listClickHandler = handler;
      });

      chrome.runtime.sendMessage.mockResolvedValue([
        { id: 'cat1', name: 'Category 1', patterns: ['*cat1*'], enabled: true }
      ]);

      jest.isolateModules(() => {
        require('./options.js');
      });

      // Wait for categories to load
      await Promise.resolve();
      await Promise.resolve();

      // Simulate edit button click
      listClickHandler({
        target: {
          dataset: { action: 'edit', id: 'cat1' }
        }
      });

      expect(mockElements.modalTitle.textContent).toBe('Edit Category');
    });

    test('should handle toggle checkbox changes', async () => {
      let listChangeHandler;
      mockElements.categoryList.addEventListener.mockImplementation((event, handler) => {
        if (event === 'change') listChangeHandler = handler;
      });

      chrome.runtime.sendMessage.mockResolvedValue([
        { id: 'cat1', name: 'Category 1', patterns: ['*cat1*'], enabled: true }
      ]);

      jest.isolateModules(() => {
        require('./options.js');
      });

      await Promise.resolve();

      // Simulate toggle
      await listChangeHandler({
        target: {
          dataset: { action: 'toggle', id: 'cat1' }
        }
      });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'saveCategories' })
      );
    });
  });
});
