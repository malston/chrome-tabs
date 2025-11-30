// ABOUTME: Retrieves the ID of the "Other Bookmarks" folder from Chrome's bookmark tree.
// ABOUTME: Falls back to "Bookmarks Bar" or first available folder if "Other Bookmarks" not found.

/**
 * Gets the ID of the "Other Bookmarks" folder by searching the bookmark tree.
 * Falls back to "Bookmarks Bar" or first available folder for compatibility
 * with fresh Chrome profiles (e.g., in CI environments).
 *
 * @returns {Promise<string>} The ID of a suitable bookmark folder
 * @throws {Error} If no bookmark folder is available
 */
async function getOtherBookmarksId() {
  const tree = await chrome.bookmarks.getTree();

  if (!tree || tree.length === 0 || !tree[0].children) {
    throw new Error('No bookmark folders available');
  }

  // Try "Other Bookmarks" first (preferred)
  const otherBookmarks = tree[0].children.find(node => node.title === 'Other Bookmarks');
  if (otherBookmarks) {
    return otherBookmarks.id;
  }

  // Fall back to "Bookmarks Bar"
  const bookmarksBar = tree[0].children.find(node => node.title === 'Bookmarks Bar' || node.title === 'Bookmarks bar');
  if (bookmarksBar) {
    return bookmarksBar.id;
  }

  // Fall back to first available folder
  if (tree[0].children.length > 0) {
    return tree[0].children[0].id;
  }

  throw new Error('No bookmark folders available');
}

export { getOtherBookmarksId };
