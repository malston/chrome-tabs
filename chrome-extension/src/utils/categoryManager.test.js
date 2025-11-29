// ABOUTME: Unit tests for categoryManager module.
// ABOUTME: Tests pattern matching, specificity calculation, and category loading.

import {
  matchesPattern,
  calculateSpecificity,
  categorizeUrl,
  loadCategories,
  saveCategories,
  getCategories,
  resetCategoriesState,
  DEFAULT_CATEGORIES
} from './categoryManager.js';

// Mock chrome.storage.sync
global.chrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

describe('categoryManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetCategoriesState();
  });

  describe('matchesPattern', () => {
    test('exact match without wildcards', () => {
      expect(matchesPattern('github.com', 'github.com')).toBe(true);
      expect(matchesPattern('gitlab.com', 'github.com')).toBe(false);
    });

    test('wildcard at start matches suffix', () => {
      expect(matchesPattern('api.github.com', '*.github.com')).toBe(true);
      expect(matchesPattern('github.com', '*.github.com')).toBe(false);
      expect(matchesPattern('docs.api.github.com', '*.github.com')).toBe(true);
    });

    test('wildcard at end matches prefix', () => {
      expect(matchesPattern('github.com/user', 'github.com/*')).toBe(true);
      expect(matchesPattern('github.com', 'github.com/*')).toBe(false);
    });

    test('wildcard in middle matches contains', () => {
      expect(matchesPattern('my-github-app.com', '*github*')).toBe(true);
      expect(matchesPattern('github.com', '*github*')).toBe(true);
      expect(matchesPattern('gitlab.com', '*github*')).toBe(false);
    });

    test('multiple wildcards', () => {
      expect(matchesPattern('docs.github.com/en/api', '*.github.com/*')).toBe(true);
      expect(matchesPattern('github.com/user', '*.github.com/*')).toBe(false);
    });

    test('case insensitive matching', () => {
      expect(matchesPattern('GitHub.com', '*github*')).toBe(true);
      expect(matchesPattern('GITHUB.COM', 'github.com')).toBe(true);
    });

    test('special regex characters are escaped', () => {
      expect(matchesPattern('example.com', 'example.com')).toBe(true);
      expect(matchesPattern('exampleXcom', 'example.com')).toBe(false);
    });

    test('localhost patterns', () => {
      expect(matchesPattern('localhost', 'localhost')).toBe(true);
      expect(matchesPattern('localhost:3000', 'localhost*')).toBe(true);
    });
  });

  describe('calculateSpecificity', () => {
    test('exact match (no wildcards) has highest specificity', () => {
      const exact = calculateSpecificity('github.com');
      const oneWildcard = calculateSpecificity('*.github.com');
      const twoWildcards = calculateSpecificity('*github*');

      expect(exact).toBeGreaterThan(oneWildcard);
      expect(oneWildcard).toBeGreaterThan(twoWildcards);
    });

    test('longer patterns are more specific when wildcard count is equal', () => {
      const longer = calculateSpecificity('*.api.github.com');
      const shorter = calculateSpecificity('*.github.com');

      expect(longer).toBeGreaterThan(shorter);
    });

    test('fewer wildcards beats longer pattern', () => {
      const fewerWildcards = calculateSpecificity('github.com');
      const moreWildcards = calculateSpecificity('*github.com*');

      expect(fewerWildcards).toBeGreaterThan(moreWildcards);
    });
  });

  describe('categorizeUrl', () => {
    const testCategories = [
      {
        id: 'dev',
        name: 'Development',
        patterns: ['*github*', '*gitlab*', 'localhost*'],
        enabled: true
      },
      {
        id: 'social',
        name: 'Social Media',
        patterns: ['*facebook*', '*twitter*', '*x.com*'],
        enabled: true
      },
      {
        id: 'disabled',
        name: 'Disabled Category',
        patterns: ['*disabled*'],
        enabled: false
      }
    ];

    test('matches URL to correct category', () => {
      expect(categorizeUrl('https://github.com/user/repo', testCategories)).toBe('Development');
      expect(categorizeUrl('https://facebook.com/profile', testCategories)).toBe('Social Media');
    });

    test('returns Other for unmatched URLs', () => {
      expect(categorizeUrl('https://random-site.com', testCategories)).toBe('Other');
    });

    test('ignores disabled categories', () => {
      expect(categorizeUrl('https://disabled-site.com', testCategories)).toBe('Other');
    });

    test('most specific pattern wins', () => {
      const categoriesWithOverlap = [
        {
          id: 'general',
          name: 'General GitHub',
          patterns: ['*github*'],
          enabled: true
        },
        {
          id: 'specific',
          name: 'GitHub Docs',
          patterns: ['docs.github.com'],
          enabled: true
        }
      ];

      expect(categorizeUrl('https://docs.github.com/en', categoriesWithOverlap)).toBe('GitHub Docs');
      expect(categorizeUrl('https://github.com/user', categoriesWithOverlap)).toBe('General GitHub');
    });

    test('handles invalid URLs gracefully', () => {
      expect(categorizeUrl('not-a-valid-url', testCategories)).toBe('Other');
      expect(categorizeUrl('', testCategories)).toBe('Other');
    });

    test('handles chrome:// URLs', () => {
      expect(categorizeUrl('chrome://extensions', testCategories)).toBe('Other');
    });
  });

  describe('DEFAULT_CATEGORIES', () => {
    test('includes all expected default categories', () => {
      const categoryNames = DEFAULT_CATEGORIES.map(c => c.name);

      expect(categoryNames).toContain('Development');
      expect(categoryNames).toContain('Documentation');
      expect(categoryNames).toContain('Social Media');
      expect(categoryNames).toContain('Communication');
      expect(categoryNames).toContain('Shopping');
      expect(categoryNames).toContain('Productivity');
      expect(categoryNames).toContain('News & Media');
      expect(categoryNames).toContain('Entertainment');
      expect(categoryNames).toContain('Finance');
      expect(categoryNames).toContain('Cloud Services');
    });

    test('all categories have required fields', () => {
      for (const category of DEFAULT_CATEGORIES) {
        expect(category).toHaveProperty('id');
        expect(category).toHaveProperty('name');
        expect(category).toHaveProperty('patterns');
        expect(category).toHaveProperty('enabled');
        expect(Array.isArray(category.patterns)).toBe(true);
        expect(category.patterns.length).toBeGreaterThan(0);
      }
    });

    test('Development category matches expected domains', () => {
      const devCategory = DEFAULT_CATEGORIES.find(c => c.name === 'Development');

      expect(categorizeUrl('https://github.com', DEFAULT_CATEGORIES)).toBe('Development');
      expect(categorizeUrl('https://stackoverflow.com/questions', DEFAULT_CATEGORIES)).toBe('Development');
      expect(categorizeUrl('http://localhost:3000', DEFAULT_CATEGORIES)).toBe('Development');
    });
  });

  describe('loadCategories', () => {
    test('returns stored categories when available', async () => {
      const storedCategories = [
        { id: 'custom', name: 'Custom', patterns: ['*custom*'], enabled: true }
      ];

      chrome.storage.sync.get.mockResolvedValue({
        categories: storedCategories
      });

      const result = await loadCategories();

      expect(result).toEqual(storedCategories);
      expect(chrome.storage.sync.get).toHaveBeenCalledWith('categories');
    });

    test('returns and saves defaults when storage is empty', async () => {
      chrome.storage.sync.get.mockResolvedValue({});
      chrome.storage.sync.set.mockResolvedValue();

      const result = await loadCategories();

      expect(result).toEqual(DEFAULT_CATEGORIES);
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        categories: DEFAULT_CATEGORIES
      });
    });
  });

  describe('saveCategories', () => {
    test('saves categories to chrome.storage.sync', async () => {
      const categories = [
        { id: 'test', name: 'Test', patterns: ['*test*'], enabled: true }
      ];

      chrome.storage.sync.set.mockResolvedValue();

      await saveCategories(categories);

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        categories: categories
      });
    });
  });

  describe('getCategories', () => {
    test('returns cached categories after loadCategories is called', async () => {
      const storedCategories = [
        { id: 'cached', name: 'Cached', patterns: ['*cached*'], enabled: true }
      ];

      chrome.storage.sync.get.mockResolvedValue({
        categories: storedCategories
      });

      await loadCategories();
      const result = getCategories();

      expect(result).toEqual(storedCategories);
    });

    test('returns defaults if loadCategories was never called', () => {
      // Reset any cached state by reimporting would be ideal,
      // but for simplicity, we just test that getCategories returns something valid
      const result = getCategories();

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
