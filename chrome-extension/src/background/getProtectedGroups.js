// ABOUTME: Retrieves list of protected groups and their status.
// ABOUTME: Matches current groups to their bookmark backups.

import { getProtectedGroupsFromStorage } from './protectGroup.js';

/**
 * Gets all protected groups with their current status
 * @returns {Promise<Array<{groupId: number, title: string, tabCount: number, bookmarkFolderId: string, protectedAt: string, stillExists: boolean}>>}
 */
async function getProtectedGroups() {
  const protectedGroups = await getProtectedGroupsFromStorage();
  const currentGroups = await chrome.tabGroups.query({});

  const result = [];

  for (const [groupId, metadata] of Object.entries(protectedGroups)) {
    const currentGroup = currentGroups.find(g => g.id === parseInt(groupId));

    result.push({
      groupId: parseInt(groupId),
      title: metadata.groupTitle,
      tabCount: metadata.tabCount,
      bookmarkFolderId: metadata.bookmarkFolderId,
      protectedAt: metadata.protectedAt,
      stillExists: !!currentGroup
    });
  }

  return result;
}

export { getProtectedGroups };
