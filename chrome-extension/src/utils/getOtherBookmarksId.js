// ABOUTME: Retrieves the ID of the "Other Bookmarks" folder from Chrome's bookmark tree.
// ABOUTME: Avoids hardcoding IDs which may vary across Chrome versions.

/**
 * Gets the ID of the "Other Bookmarks" folder by searching the bookmark tree.
 * This avoids hardcoding "2" which could change across Chrome versions.
 *
 * @returns {Promise<string>} The ID of the "Other Bookmarks" folder
 * @throws {Error} If the "Other Bookmarks" folder is not found
 */
async function getOtherBookmarksId() {
  const tree = await chrome.bookmarks.getTree();

  if (!tree || tree.length === 0 || !tree[0].children) {
    throw new Error('Other Bookmarks folder not found');
  }

  const otherBookmarks = tree[0].children.find(node => node.title === 'Other Bookmarks');

  if (!otherBookmarks) {
    throw new Error('Other Bookmarks folder not found');
  }

  return otherBookmarks.id;
}

export { getOtherBookmarksId };
