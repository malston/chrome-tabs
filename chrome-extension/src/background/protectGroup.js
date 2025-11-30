// ABOUTME: Protects a tab group by saving it to bookmarks for easy recovery.
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
 * Protects a tab group by saving to bookmarks
 * @param {number} groupId - The tab group ID to protect
 * @returns {Promise<{success: boolean, bookmarkFolderId: string, tabCount: number, groupTitle: string}>}
 */
async function protectGroup(groupId) {
  // 1. Get group info
  const group = await chrome.tabGroups.get(groupId);
  const tabs = await chrome.tabs.query({ groupId });

  if (tabs.length === 0) {
    return { error: 'Group has no tabs to protect' };
  }

  // 2. Create bookmark folder with protection naming
  const timestamp = new Date().toISOString().split('T')[0];
  const groupTitle = group.title || 'Untitled';
  const folderName = `🔒 ${groupTitle} - ${timestamp}`;

  const otherBookmarksId = await getOtherBookmarksId();
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
  const protectedGroups = await getProtectedGroupsFromStorage();
  protectedGroups[groupId] = {
    bookmarkFolderId: folder.id,
    groupTitle: groupTitle,
    tabCount: tabs.length,
    protectedAt: new Date().toISOString()
  };
  await chrome.storage.local.set({ protectedGroups });

  return {
    success: true,
    bookmarkFolderId: folder.id,
    tabCount: tabs.length,
    groupTitle: groupTitle
  };
}

export { protectGroup, getProtectedGroupsFromStorage };
