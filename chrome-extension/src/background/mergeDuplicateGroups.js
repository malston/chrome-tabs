// ABOUTME: Merges duplicate tab groups with the same base name.
// ABOUTME: Respects protected groups - they can absorb but never dissolve.

import { extractGroupBaseName } from '../utils/extractGroupBaseName.js';
import { getProtectedGroupsFromStorage } from './protectGroup.js';

/**
 * Checks if a group name is valid for merging (not just numbers or empty)
 * @param {string} name - The base name to check
 * @returns {boolean} True if valid for merging
 */
function isValidGroupName(name) {
  if (!name || name.trim() === '') return false;
  // Skip groups that are just numbers
  if (/^\d+$/.test(name.trim())) return false;
  return true;
}

/**
 * Merges duplicate tab groups by moving tabs from smaller groups into larger ones.
 * @returns {Promise<{mergedGroups: number, tabsMoved: number, skippedProtected: number, message: string}>}
 */
async function mergeDuplicateGroups() {
  // Get all groups in current window
  const allGroups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });

  // Validate query result
  if (!Array.isArray(allGroups)) {
    throw new Error('Failed to query tab groups: invalid response');
  }

  // Get protected groups
  const protectedGroups = await getProtectedGroupsFromStorage();
  const protectedGroupIds = new Set(Object.keys(protectedGroups).map(id => parseInt(id)));

  // Group by base name
  const groupsByBaseName = new Map();

  for (const group of allGroups) {
    const baseName = extractGroupBaseName(group.title);

    if (!isValidGroupName(baseName)) {
      continue;
    }

    if (!groupsByBaseName.has(baseName)) {
      groupsByBaseName.set(baseName, []);
    }
    groupsByBaseName.get(baseName).push(group);
  }

  let mergedGroups = 0;
  let tabsMoved = 0;
  let skippedProtected = 0;

  // Process each set of duplicates
  for (const [baseName, groups] of groupsByBaseName) {
    if (groups.length < 2) continue; // No duplicates

    // Get tab counts for each group
    const groupsWithTabs = await Promise.all(
      groups.map(async (group) => {
        const tabs = await chrome.tabs.query({ groupId: group.id });
        return { group, tabs, tabCount: tabs.length };
      })
    );

    // Filter out empty groups
    const nonEmptyGroups = groupsWithTabs.filter(g => g.tabCount > 0);
    if (nonEmptyGroups.length < 2) continue;

    // Check protection status
    const protectedInSet = nonEmptyGroups.filter(g => protectedGroupIds.has(g.group.id));

    if (protectedInSet.length > 1) {
      // Multiple protected duplicates - skip this set
      skippedProtected++;
      continue;
    }

    // Determine target group:
    // - If one is protected, it becomes the target
    // - Otherwise, largest becomes target
    let targetGroupData;
    let sourceGroupsData;

    if (protectedInSet.length === 1) {
      targetGroupData = protectedInSet[0];
      sourceGroupsData = nonEmptyGroups.filter(g => g.group.id !== targetGroupData.group.id);
    } else {
      // Sort by tab count descending, largest first
      nonEmptyGroups.sort((a, b) => b.tabCount - a.tabCount);
      targetGroupData = nonEmptyGroups[0];
      sourceGroupsData = nonEmptyGroups.slice(1);
    }

    // Merge all source groups into target
    const allSourceTabIds = sourceGroupsData.flatMap(g => g.tabs.map(t => t.id));

    if (allSourceTabIds.length === 0) continue;

    await chrome.tabs.group({ tabIds: allSourceTabIds, groupId: targetGroupData.group.id });

    // Update target group title with new count
    const newTabCount = targetGroupData.tabCount + allSourceTabIds.length;
    await chrome.tabGroups.update(targetGroupData.group.id, {
      title: `${baseName} (${newTabCount})`
    });

    mergedGroups += sourceGroupsData.length;
    tabsMoved += allSourceTabIds.length;
  }

  return {
    mergedGroups,
    tabsMoved,
    skippedProtected,
    message: mergedGroups === 0 ? 'No duplicate groups to merge' : `Merged ${mergedGroups} groups (${tabsMoved} tabs moved)`
  };
}

export { mergeDuplicateGroups, isValidGroupName };
