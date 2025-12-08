// ABOUTME: Retrieves Tab Organizer bookmark folders from the "Other Bookmarks" folder.
// ABOUTME: Filters folders by name prefix and sorts by timestamp (newest first).

import { getOtherBookmarksId } from './getOtherBookmarksId.js';

/**
 * Gets all Tab Organizer bookmark folders from the "Other Bookmarks" folder.
 * Filters for folders with titles starting with "Tab Organizer -" or "🔒" (protected groups)
 * and sorts them by title in reverse lexical order (newest first based on timestamp in title).
 *
 * @returns {Promise<Array>} Array of objects with { id, title } for each Tab Organizer folder
 * @throws {Error} If unable to retrieve bookmarks or find Other Bookmarks folder
 */
async function getTabOrganizerBookmarkFolders() {
  // Get "Other Bookmarks" folder ID dynamically
  const otherBookmarksId = await getOtherBookmarksId();
  const children = await chrome.bookmarks.getChildren(otherBookmarksId);

  // Find all folders that start with "Tab Organizer -" or "🔒" (protected groups)
  const tabOrganizerFolders = children.filter(child =>
    !child.url && child.title && (
      child.title.startsWith('Tab Organizer -') ||
      child.title.startsWith('🔒')
    )
  );

  // Sort by title (which includes timestamp) in reverse order (newest first)
  tabOrganizerFolders.sort((a, b) => b.title.localeCompare(a.title));

  return tabOrganizerFolders.map(folder => ({
    id: folder.id,
    title: folder.title
  }));
}

export { getTabOrganizerBookmarkFolders };
