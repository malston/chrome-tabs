// ABOUTME: Manages user-defined categories for tab organization.
// ABOUTME: Handles pattern matching, specificity calculation, and chrome.storage persistence.

/**
 * Default categories shipped with the extension.
 * Users can edit, disable, or delete these categories.
 */
const DEFAULT_CATEGORIES = [
  {
    id: 'development',
    name: 'Development',
    patterns: [
      '*github*',
      '*gitlab*',
      '*bitbucket*',
      '*stackoverflow*',
      '*stackexchange*',
      '*npmjs*',
      '*pypi*',
      '*maven*',
      '*docker*',
      '*kubernetes*',
      'localhost*'
    ],
    enabled: true
  },
  {
    id: 'documentation',
    name: 'Documentation',
    patterns: [
      '*docs.*',
      '*documentation*',
      '*readthedocs*',
      '*developer.*',
      '*tutorial*',
      '*learn*',
      '*coursera*',
      '*udemy*',
      '*edx*',
      '*pluralsight*',
      '*codecademy*'
    ],
    enabled: true
  },
  {
    id: 'social-media',
    name: 'Social Media',
    patterns: [
      '*facebook*',
      '*threads*',
      '*x.com*',
      '*twitter*',
      '*instagram*',
      '*linkedin*',
      '*reddit*',
      '*tiktok*',
      '*snapchat*',
      '*pinterest*',
      '*mastodon*',
      '*bluesky*'
    ],
    enabled: true
  },
  {
    id: 'communication',
    name: 'Communication',
    patterns: [
      '*slack*',
      '*discord*',
      '*teams*',
      '*zoom*',
      '*meet*',
      '*webex*',
      '*mail*',
      '*gmail*',
      '*outlook*',
      '*protonmail*',
      '*telegram*'
    ],
    enabled: true
  },
  {
    id: 'shopping',
    name: 'Shopping',
    patterns: [
      '*amazon*',
      '*ebay*',
      '*etsy*',
      '*shop*',
      '*store*',
      '*cart*',
      '*checkout*',
      '*buy*',
      '*walmart*',
      '*target*',
      '*bestbuy*'
    ],
    enabled: true
  },
  {
    id: 'productivity',
    name: 'Productivity',
    patterns: [
      '*dropbox*',
      '*onedrive*',
      '*icloud*',
      '*notion*',
      '*evernote*',
      '*trello*',
      '*asana*',
      '*monday*',
      '*airtable*',
      '*sharepoint*',
      '*confluence*'
    ],
    enabled: true
  },
  {
    id: 'news-media',
    name: 'News & Media',
    patterns: [
      '*news*',
      '*cnn*',
      '*bbc*',
      '*nytimes*',
      '*wsj*',
      '*reuters*',
      '*medium*',
      '*substack*',
      '*blog*',
      '*article*',
      '*post*'
    ],
    enabled: true
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    patterns: [
      '*youtube*',
      '*netflix*',
      '*hulu*',
      '*spotify*',
      '*twitch*',
      '*vimeo*',
      '*soundcloud*',
      '*disneyplus*',
      '*hbomax*',
      '*gaming*',
      '*game*'
    ],
    enabled: true
  },
  {
    id: 'finance',
    name: 'Finance',
    patterns: [
      '*bank*',
      '*paypal*',
      '*venmo*',
      '*stripe*',
      '*mint*',
      '*finance*',
      '*investing*',
      '*trading*',
      '*crypto*',
      '*coinbase*',
      '*robinhood*'
    ],
    enabled: true
  },
  {
    id: 'cloud-services',
    name: 'Cloud Services',
    patterns: [
      '*aws*',
      '*azure*',
      '*cloud.google*',
      '*heroku*',
      '*vercel*',
      '*netlify*',
      '*digitalocean*',
      '*linode*',
      '*vultr*'
    ],
    enabled: true
  }
];

// Cache for loaded categories
let cachedCategories = null;
let categoriesLoadedPromise = null;

/**
 * Tests if a URL/hostname matches a glob pattern.
 * Supports * as wildcard (matches any characters).
 * Case-insensitive matching.
 *
 * @param {string} str - The string to test
 * @param {string} pattern - Glob pattern with * wildcards
 * @returns {boolean} - Whether the string matches the pattern
 */
function matchesPattern(str, pattern) {
  // Convert glob pattern to regex:
  // 1. Escape regex special chars (except *)
  // 2. Replace * with .*
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');

  const regex = new RegExp('^' + escaped + '$', 'i');
  return regex.test(str);
}

/**
 * Calculates the specificity of a pattern.
 * Higher values = more specific.
 * Fewer wildcards = more specific.
 * Longer pattern = more specific (when wildcard count is equal).
 *
 * @param {string} pattern - Glob pattern
 * @returns {number} - Specificity score
 */
function calculateSpecificity(pattern) {
  const wildcardCount = (pattern.match(/\*/g) || []).length;
  const literalLength = pattern.replace(/\*/g, '').length;

  // Base: 1000 points minus 100 per wildcard
  // Bonus: 1 point per literal character
  return 1000 - (wildcardCount * 100) + literalLength;
}

/**
 * Categorizes a URL based on user-defined categories.
 * Returns the category name for the most specific matching pattern.
 *
 * @param {string} url - Full URL to categorize
 * @param {Array} categories - Array of category objects
 * @returns {string} - Category name or 'Other' if no match
 */
function categorizeUrl(url, categories = null) {
  const cats = categories || getCategories();

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');
    const fullUrl = url.toLowerCase();

    let bestMatch = { category: 'Other', specificity: -1 };

    for (const category of cats) {
      if (!category.enabled) continue;

      for (const pattern of category.patterns) {
        // Test against hostname and full URL
        const matchesHostname = matchesPattern(hostname, pattern);
        const matchesUrl = matchesPattern(fullUrl, pattern);

        if (matchesHostname || matchesUrl) {
          const specificity = calculateSpecificity(pattern);

          if (specificity > bestMatch.specificity) {
            bestMatch = { category: category.name, specificity };
          }
        }
      }
    }

    return bestMatch.category;
  } catch (e) {
    // Invalid URL
    return 'Other';
  }
}

/**
 * Loads categories from chrome.storage.sync.
 * If no categories are stored, saves and returns defaults.
 * Returns existing promise if already loading to prevent race conditions.
 *
 * @returns {Promise<Array>} - Array of category objects
 */
async function loadCategories() {
  if (categoriesLoadedPromise) {
    return categoriesLoadedPromise;
  }

  categoriesLoadedPromise = (async () => {
    const result = await chrome.storage.sync.get('categories');

    if (!result.categories || result.categories.length === 0) {
      // First run: save defaults
      await chrome.storage.sync.set({ categories: DEFAULT_CATEGORIES });
      cachedCategories = DEFAULT_CATEGORIES;
    } else {
      cachedCategories = result.categories;
    }

    return cachedCategories;
  })();

  return categoriesLoadedPromise;
}

/**
 * Saves categories to chrome.storage.sync.
 *
 * @param {Array} categories - Array of category objects to save
 * @returns {Promise<void>}
 */
async function saveCategories(categories) {
  await chrome.storage.sync.set({ categories });
  cachedCategories = categories;
  // Invalidate the loading promise so next load fetches fresh data
  categoriesLoadedPromise = Promise.resolve(categories);
}

/**
 * Returns cached categories or defaults if not loaded yet.
 *
 * @returns {Array} - Array of category objects
 */
function getCategories() {
  return cachedCategories || DEFAULT_CATEGORIES;
}

/**
 * Resets categories to defaults.
 *
 * @returns {Promise<void>}
 */
async function resetCategories() {
  await saveCategories(DEFAULT_CATEGORIES);
}

/**
 * Resets internal state for testing purposes.
 * Clears cached categories and loading promise.
 */
function resetCategoriesState() {
  cachedCategories = null;
  categoriesLoadedPromise = null;
}

export {
  matchesPattern,
  calculateSpecificity,
  categorizeUrl,
  loadCategories,
  saveCategories,
  getCategories,
  resetCategories,
  resetCategoriesState,
  DEFAULT_CATEGORIES
};
