// ABOUTME: Combines two tab groups by moving all tabs from source group into target group.
// ABOUTME: Source group dissolves automatically when emptied.

import { extractGroupBaseName } from '../utils/extractGroupBaseName.js';

/**
 * Combines two tab groups by moving all tabs from source into target.
 * @param {number} sourceGroupId - The group to dissolve
 * @param {number} targetGroupId - The group to merge into
 * @returns {Promise<Object>} Result with source/target names and tab counts
 */
export async function combineGroups(sourceGroupId, targetGroupId) {
  // Get source and target group info
  const [sourceGroup, targetGroup] = await Promise.all([
    chrome.tabGroups.get(sourceGroupId),
    chrome.tabGroups.get(targetGroupId)
  ]);

  const sourceGroupName = extractGroupBaseName(sourceGroup.title);
  const targetGroupName = extractGroupBaseName(targetGroup.title);

  // Get tabs in source group
  const sourceTabs = await chrome.tabs.query({ groupId: sourceGroupId });

  if (sourceTabs.length === 0) {
    return {
      error: 'Source group has no tabs'
    };
  }

  // Get current target tab count for final count calculation
  const targetTabs = await chrome.tabs.query({ groupId: targetGroupId });
  const tabsMoved = sourceTabs.length;
  const newTargetTabCount = targetTabs.length + tabsMoved;

  // Move source tabs to target group
  const sourceTabIds = sourceTabs.map(tab => tab.id);
  await chrome.tabs.group({ tabIds: sourceTabIds, groupId: targetGroupId });

  // Update target group title with new count
  await chrome.tabGroups.update(targetGroupId, {
    title: `${targetGroupName} (${newTargetTabCount})`
  });

  return {
    sourceGroupName,
    targetGroupName,
    tabsMoved,
    newTargetTabCount
  };
}
