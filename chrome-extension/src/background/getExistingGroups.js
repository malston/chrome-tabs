// ABOUTME: Retrieves all tab groups in the current window with their metadata.
// ABOUTME: Used to populate group selection UI for combine groups feature.

import { extractGroupBaseName } from '../utils/extractGroupBaseName.js';

/**
 * Gets all tab groups in the specified window with tab counts.
 * @param {number} [windowId] - Window ID, defaults to current window
 * @returns {Promise<Array>} Array of { id, title, baseName, tabCount, color }
 */
export async function getExistingGroups(windowId) {
  // Get all groups in the window (default to current window)
  const targetWindowId = windowId ?? chrome.windows.WINDOW_ID_CURRENT;
  const groups = await chrome.tabGroups.query({ windowId: targetWindowId });

  // Get tab counts for each group
  const groupsWithCounts = await Promise.all(
    groups.map(async (group) => {
      const tabs = await chrome.tabs.query({ groupId: group.id });
      return {
        id: group.id,
        title: group.title,
        baseName: extractGroupBaseName(group.title),
        tabCount: tabs.length,
        color: group.color
      };
    })
  );

  // Sort alphabetically by base name
  groupsWithCounts.sort((a, b) => a.baseName.localeCompare(b.baseName));

  return groupsWithCounts;
}
