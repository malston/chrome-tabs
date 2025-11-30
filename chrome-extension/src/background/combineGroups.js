// ABOUTME: Combines multiple tab groups by moving all tabs from source groups into target group.
// ABOUTME: Source groups dissolve automatically when emptied.

import { extractGroupBaseName } from '../utils/extractGroupBaseName.js';

/**
 * Combines multiple tab groups by moving all tabs from sources into target.
 * @param {number[]} sourceGroupIds - The groups to dissolve
 * @param {number} targetGroupId - The group to merge into
 * @returns {Promise<Object>} Result with source/target names and tab counts
 */
export async function combineGroups(sourceGroupIds, targetGroupId) {
  // Get target group info
  const targetGroup = await chrome.tabGroups.get(targetGroupId);
  const targetGroupName = extractGroupBaseName(targetGroup.title);

  // Get all source groups info
  const sourceGroups = await Promise.all(
    sourceGroupIds.map(id => chrome.tabGroups.get(id))
  );
  const sourceGroupNames = sourceGroups.map(g => extractGroupBaseName(g.title));

  // Get tabs from all source groups
  const sourceTabsArrays = await Promise.all(
    sourceGroupIds.map(id => chrome.tabs.query({ groupId: id }))
  );
  const allSourceTabs = sourceTabsArrays.flat();

  if (allSourceTabs.length === 0) {
    return {
      error: 'Source groups have no tabs'
    };
  }

  // Get current target tab count for final count calculation
  const targetTabs = await chrome.tabs.query({ groupId: targetGroupId });
  const tabsMoved = allSourceTabs.length;
  const newTargetTabCount = targetTabs.length + tabsMoved;

  // Move all source tabs to target group
  const sourceTabIds = allSourceTabs.map(tab => tab.id);
  await chrome.tabs.group({ tabIds: sourceTabIds, groupId: targetGroupId });

  // Update target group title with new count
  await chrome.tabGroups.update(targetGroupId, {
    title: `${targetGroupName} (${newTargetTabCount})`
  });

  return {
    sourceGroupNames,
    targetGroupName,
    tabsMoved,
    newTargetTabCount
  };
}
