// ABOUTME: Retrieves Tab Organizer bookmark folders from the "Other Bookmarks" folder.
// ABOUTME: Filters folders by name prefix and sorts by timestamp (newest first).

const { getOtherBookmarksId } = require('./getOtherBookmarksId.js');

/**
 * Gets all Tab Organizer bookmark folders from the "Other Bookmarks" folder.
 * Filters for folders with titles starting with "Tab Organizer -" and sorts
 * them by title in reverse lexical order (newest first based on timestamp in title).
 *
 * @returns {Promise<Array>} Array of objects with { id, title } for each Tab Organizer folder
 * @throws {Error} If unable to retrieve bookmarks or find Other Bookmarks folder
 */
async function getTabOrganizerBookmarkFolders() {
  console.log('Getting Tab Organizer bookmark folders...');

  // Get "Other Bookmarks" folder ID dynamically
  const otherBookmarksId = await getOtherBookmarksId();
  const children = await chrome.bookmarks.getChildren(otherBookmarksId);

  // Find all folders that start with "Tab Organizer -"
  const tabOrganizerFolders = children.filter(child =>
    !child.url && child.title && child.title.startsWith('Tab Organizer -')
  );

  // Sort by title (which includes timestamp) in reverse order (newest first)
  tabOrganizerFolders.sort((a, b) => b.title.localeCompare(a.title));

  return tabOrganizerFolders.map(folder => ({
    id: folder.id,
    title: folder.title
  }));
}

module.exports = { getTabOrganizerBookmarkFolders };
