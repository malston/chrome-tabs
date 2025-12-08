// ABOUTME: Removes duplicate tabs from the current window while maintaining group titles.
// ABOUTME: Keeps the first occurrence of each URL and closes all subsequent duplicates.

import { shouldSkipUrl } from '../utils/shouldSkipUrl.js';
import { extractGroupBaseName } from '../utils/extractGroupBaseName.js';

/**
 * Removes duplicate tabs from the current window.
 * Keeps the first occurrence of each URL and closes all subsequent duplicates.
 * Updates group titles to reflect new tab counts after removal.
 *
 * @returns {Promise<Object>} Statistics about duplicates found and removed
 *   - totalTabs: Total tabs in the window before removal
 *   - duplicatesFound: Number of duplicate URLs detected
 *   - duplicatesClosed: Number of duplicate tabs successfully closed
 *   - remainingTabs: Total tabs remaining after removal
 */
async function removeDuplicateTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });

  // Track seen URLs
  const seenUrls = new Map(); // url -> first tab with that URL
  const tabsToClose = [];

  for (const tab of tabs) {
    const url = tab.url;

    // Skip chrome internal pages
    if (shouldSkipUrl(url)) {
      continue;
    }

    if (seenUrls.has(url)) {
      // This is a duplicate - mark for closure
      tabsToClose.push(tab.id);
    } else {
      // First occurrence - keep it
      seenUrls.set(url, tab);
    }
  }

  // Close duplicate tabs (batch operation for better performance)
  let closedCount = 0;
  if (tabsToClose.length > 0) {
    try {
      await chrome.tabs.remove(tabsToClose);
      closedCount = tabsToClose.length;
    } catch (e) {
      console.error('Error closing tabs:', e);
    }
  }

  // Update group titles to reflect new tab counts after removing duplicates
  if (closedCount > 0) {
    const groups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });

    for (const group of groups) {
      // Count tabs currently in this group
      const tabsInGroup = await chrome.tabs.query({ groupId: group.id });
      const newCount = tabsInGroup.length;

      // Extract base name (without count) and update with new count
      const baseName = extractGroupBaseName(group.title);
      const newTitle = `${baseName} (${newCount})`;

      // Only update if the title has changed
      if (group.title !== newTitle) {
        await chrome.tabGroups.update(group.id, { title: newTitle });
      }
    }
  }

  return {
    totalTabs: tabs.length,
    duplicatesFound: tabsToClose.length,
    duplicatesClosed: closedCount,
    remainingTabs: tabs.length - closedCount
  };
}

export { removeDuplicateTabs };
