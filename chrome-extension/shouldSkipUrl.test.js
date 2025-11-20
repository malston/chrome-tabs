/**
 * Unit Tests for shouldSkipUrl function
 *
 * Tests URL filtering logic to determine which URLs should be skipped
 * during tab organization operations.
 */

// Mock Chrome APIs (required for background.js to load)
global.chrome = {
  tabs: {
    query: jest.fn(),
    remove: jest.fn(),
    group: jest.fn(),
    ungroup: jest.fn(),
    create: jest.fn(),
    move: jest.fn(),
    TAB_GROUP_ID_NONE: -1
  },
  tabGroups: {
    query: jest.fn(),
    update: jest.fn(),
    get: jest.fn(),
    TAB_GROUP_ID_NONE: -1
  },
  bookmarks: {
    get: jest.fn(),
    getChildren: jest.fn(),
    create: jest.fn()
  },
  windows: {
    getCurrent: jest.fn(),
    WINDOW_ID_CURRENT: 1
  },
  runtime: {
    onMessage: {
      addListener: jest.fn()
    }
  }
};

// Import the shouldSkipUrl function from background.js
const { shouldSkipUrl } = require('./background.js');

describe('shouldSkipUrl', () => {
  describe('Chrome Internal URLs', () => {
    test('should skip chrome:// URLs', () => {
      expect(shouldSkipUrl('chrome://extensions')).toBe(true);
      expect(shouldSkipUrl('chrome://settings')).toBe(true);
      expect(shouldSkipUrl('chrome://flags')).toBe(true);
    });

    test('should skip chrome-extension:// URLs', () => {
      expect(shouldSkipUrl('chrome-extension://abcdefg/popup.html')).toBe(true);
      expect(shouldSkipUrl('chrome-extension://xyz123/background.js')).toBe(true);
    });

    test('should skip about: URLs', () => {
      expect(shouldSkipUrl('about:blank')).toBe(true);
      expect(shouldSkipUrl('about:newtab')).toBe(true);
    });
  });

  describe('Regular URLs', () => {
    test('should not skip regular http URLs', () => {
      expect(shouldSkipUrl('http://example.com')).toBe(false);
    });

    test('should not skip regular https URLs', () => {
      expect(shouldSkipUrl('https://github.com')).toBe(false);
      expect(shouldSkipUrl('https://www.google.com')).toBe(false);
    });

    test('should not skip localhost URLs', () => {
      expect(shouldSkipUrl('http://localhost:3000')).toBe(false);
    });

    test('should not skip IP address URLs', () => {
      expect(shouldSkipUrl('http://192.168.1.1')).toBe(false);
      expect(shouldSkipUrl('http://8.8.8.8')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should skip URLs starting with chrome even in path', () => {
      // This should NOT be skipped - only URLs with chrome:// protocol
      expect(shouldSkipUrl('https://chrome.google.com')).toBe(false);
    });

    test('should handle empty string', () => {
      expect(shouldSkipUrl('')).toBe(true);
    });

    test('should handle null', () => {
      expect(shouldSkipUrl(null)).toBe(true);
    });

    test('should handle undefined', () => {
      expect(shouldSkipUrl(undefined)).toBe(true);
    });
  });
});
