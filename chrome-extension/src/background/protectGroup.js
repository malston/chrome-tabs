// ABOUTME: Protects tab groups by saving them to bookmarks for easy recovery.
// ABOUTME: Stores protection metadata in chrome.storage.local.

import { getOtherBookmarksId } from '../utils/getOtherBookmarksId.js';

/**
 * Gets protected groups from storage
 * @returns {Promise<Object>} Map of groupId to protection metadata
 */
async function getProtectedGroupsFromStorage() {
  const result = await chrome.storage.local.get('protectedGroups');
  return result.protectedGroups || {};
}

/**
 * Protects multiple tab groups by saving to bookmarks
 * @param {number[]} groupIds - The tab group IDs to protect
 * @returns {Promise<{success: boolean, protectedCount: number, totalTabs: number, groupTitles: string[]}>}
 */
async function protectGroups(groupIds) {
  const otherBookmarksId = await getOtherBookmarksId();
  const timestamp = new Date().toISOString().split('T')[0];
  const protectedGroupsStorage = await getProtectedGroupsFromStorage();

  const results = [];

  for (const groupId of groupIds) {
    // 1. Get group info
    const group = await chrome.tabGroups.get(groupId);
    const tabs = await chrome.tabs.query({ groupId });

    if (tabs.length === 0) {
      continue; // Skip empty groups
    }

    // 2. Create bookmark folder with protection naming
    const groupTitle = group.title || 'Untitled';
    const folderName = `🔒 ${groupTitle} - ${timestamp}`;

    const folder = await chrome.bookmarks.create({
      parentId: otherBookmarksId,
      title: folderName
    });

    // 3. Save each tab as bookmark
    for (const tab of tabs) {
      await chrome.bookmarks.create({
        parentId: folder.id,
        title: tab.title,
        url: tab.url
      });
    }

    // 4. Store protection metadata
    protectedGroupsStorage[groupId] = {
      bookmarkFolderId: folder.id,
      groupTitle: groupTitle,
      tabCount: tabs.length,
      protectedAt: new Date().toISOString()
    };

    results.push({
      groupTitle,
      tabCount: tabs.length
    });
  }

  await chrome.storage.local.set({ protectedGroups: protectedGroupsStorage });

  const totalTabs = results.reduce((sum, r) => sum + r.tabCount, 0);
  const groupTitles = results.map(r => r.groupTitle);

  return {
    success: true,
    protectedCount: results.length,
    totalTabs,
    groupTitles
  };
}

export { protectGroups, getProtectedGroupsFromStorage };
