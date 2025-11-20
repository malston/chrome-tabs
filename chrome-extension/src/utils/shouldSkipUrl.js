// ABOUTME: Filters URLs to determine which should be skipped during tab organization.
// ABOUTME: Skips Chrome internal pages, system pages, and other non-user-navigable URLs.

/**
 * Determines whether a URL should be skipped during tab operations.
 * Skips Chrome internal pages (chrome://), extension pages (chrome-extension://),
 * and special browser pages (about:).
 *
 * @param {string} url - The URL to check
 * @returns {boolean} True if the URL should be skipped, false otherwise
 */
function shouldSkipUrl(url) {
  if (!url) return true;

  return url.startsWith('chrome://') ||
         url.startsWith('chrome-extension://') ||
         url.startsWith('about:');
}

export { shouldSkipUrl };
