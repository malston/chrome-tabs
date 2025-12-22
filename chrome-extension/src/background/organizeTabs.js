// ABOUTME: Groups tabs by domain or category using Chrome Tab Groups API.
// ABOUTME: Handles smart merging with existing groups and moves ungrouped tabs to end.

import { extractDomain } from '../utils/extractDomain.js';
import { shouldSkipUrl } from '../utils/shouldSkipUrl.js';
import { extractGroupBaseName } from '../utils/extractGroupBaseName.js';
import { getNextColor, resetColorIndex } from '../utils/colorManager.js';
import { categorizeUrl } from '../utils/categoryManager.js';
import { mergeDuplicateGroups } from './mergeDuplicateGroups.js';

async function organizeTabs(mode = 'domain', allWindows = false) {
  // Check if auto-merge is enabled
  let mergeResult = null;
  const settings = await chrome.storage.local.get('autoMergeDuplicates');
  if (settings && settings.autoMergeDuplicates) {
    try {
      mergeResult = await mergeDuplicateGroups();
    } catch (error) {
      console.error('Auto-merge failed, continuing with organize:', error);
      // Continue with organize even if merge fails
    }
  }

  // Get current window for reference
  const currentWindow = await chrome.windows.getCurrent();

  // Get all tabs - either from current window or all windows
  let tabs = await chrome.tabs.query(allWindows ? {} : { currentWindow: true });
  let duplicatesClosed = 0;
  let tabsMoved = 0;

  // If organizing across all windows, first remove duplicates and move all tabs to current window
  if (allWindows) {
    // First pass: identify grouped tabs (prioritized)
    const groupedUrls = new Map(); // url -> tab
    for (const tab of tabs) {
      if (shouldSkipUrl(tab.url)) continue;
      if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
        if (!groupedUrls.has(tab.url)) {
          groupedUrls.set(tab.url, tab);
        }
      }
    }

    // Second pass: find duplicates and tabs to move
    const seenUrls = new Map(); // url -> tab (first seen)
    const tabsToClose = [];
    const tabsToMove = [];

    for (const tab of tabs) {
      if (shouldSkipUrl(tab.url)) continue;

      // Check if this is a duplicate of a grouped tab
      if (groupedUrls.has(tab.url) && groupedUrls.get(tab.url).id !== tab.id) {
        tabsToClose.push(tab.id);
      } else if (seenUrls.has(tab.url)) {
        // Duplicate of another seen tab
        tabsToClose.push(tab.id);
      } else {
        seenUrls.set(tab.url, tab);
        // If tab is in a different window, mark for moving
        if (tab.windowId !== currentWindow.id) {
          tabsToMove.push(tab);
        }
      }
    }

    // Close duplicate tabs
    if (tabsToClose.length > 0) {
      await chrome.tabs.remove(tabsToClose);
      duplicatesClosed = tabsToClose.length;
    }

    // Move tabs from other windows to current window
    if (tabsToMove.length > 0) {
      for (const tab of tabsToMove) {
        try {
          await chrome.tabs.move(tab.id, { windowId: currentWindow.id, index: -1 });
          tabsMoved++;
        } catch (e) {
          console.error(`Error moving tab ${tab.id}:`, e);
        }
      }
    }

    // Re-query tabs in current window after moving
    tabs = await chrome.tabs.query({ currentWindow: true });
  } else {
    // Single-window mode: remove ungrouped duplicates
    // Step 1: Identify grouped tab URLs (these take priority)
    const groupedUrls = new Map(); // url -> tab
    for (const tab of tabs) {
      if (shouldSkipUrl(tab.url)) continue;
      if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
        if (!groupedUrls.has(tab.url)) {
          groupedUrls.set(tab.url, tab);
        }
      }
    }

    // Step 2: Find ungrouped duplicates to close
    const seenUngroupedUrls = new Map(); // url -> tab
    const tabsToClose = [];

    for (const tab of tabs) {
      if (shouldSkipUrl(tab.url)) continue;
      if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) continue; // Skip grouped tabs

      if (groupedUrls.has(tab.url)) {
        // Ungrouped duplicate of grouped tab - close it
        tabsToClose.push(tab.id);
      } else if (seenUngroupedUrls.has(tab.url)) {
        // Ungrouped duplicate of another ungrouped tab - close it
        tabsToClose.push(tab.id);
      } else {
        seenUngroupedUrls.set(tab.url, tab);
      }
    }

    // Step 3: Close duplicates
    if (tabsToClose.length > 0) {
      await chrome.tabs.remove(tabsToClose);
      duplicatesClosed = tabsToClose.length;
    }

    // Step 4: Re-query tabs after removing duplicates
    if (duplicatesClosed > 0) {
      tabs = await chrome.tabs.query({ currentWindow: true });
    }
  }

  // Group tabs by domain or category
  const groups = {};

  for (const tab of tabs) {
    // Skip chrome internal pages
    if (shouldSkipUrl(tab.url)) {
      continue;
    }

    const groupKey = mode === 'category' ? categorizeUrl(tab.url) : extractDomain(tab.url);

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }

    groups[groupKey].push(tab);
  }

  // Query existing tab groups to enable smart merging
  const existingGroups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });

  // Build a map of existing groups by their base name (without count)
  const existingGroupsByName = new Map();
  for (const group of existingGroups) {
    const baseName = extractGroupBaseName(group.title);
    if (baseName) {
      existingGroupsByName.set(baseName, group);
    }
  }

  // Create groups for domains/categories with multiple tabs
  let groupedCount = 0;
  let groupsCreated = 0;
  let groupsUpdated = 0;
  resetColorIndex(); // Reset color index for new groups

  // Sort groups by tab count (most tabs first)
  const sortedGroups = Object.entries(groups)
    .filter(([_, tabs]) => tabs.length > 1)  // Only group if 2+ tabs
    .sort((a, b) => b[1].length - a[1].length);

  // Track which tabs should be in groups
  const tabsInGroups = new Set();

  for (const [groupName, groupTabs] of sortedGroups) {
    if (groupTabs.length <= 1) continue;

    // Sort tabs within group by title (alphabetically)
    const sortedTabs = groupTabs.sort((a, b) => {
      const titleA = (a.title || '').toLowerCase();
      const titleB = (b.title || '').toLowerCase();
      return titleA.localeCompare(titleB);
    });

    // Get tab IDs in sorted order
    const newTabIds = sortedTabs.map(t => t.id);
    newTabIds.forEach(id => tabsInGroups.add(id));

    try {
      const existingGroup = existingGroupsByName.get(groupName);

      if (existingGroup) {
        // Group exists - update it (smart merge)
        // Get current tabs in this group
        const currentGroupTabs = await chrome.tabs.query({ groupId: existingGroup.id });
        const currentTabIds = currentGroupTabs.map(t => t.id);

        // Calculate diff: tabs to add and tabs to remove
        const toAdd = newTabIds.filter(id => !currentTabIds.includes(id));
        const toRemove = currentTabIds.filter(id => !newTabIds.includes(id));

        // Add new tabs to the existing group
        if (toAdd.length > 0) {
          await chrome.tabs.group({ tabIds: toAdd, groupId: existingGroup.id });
        }

        // Remove tabs that shouldn't be in this group anymore
        if (toRemove.length > 0) {
          await chrome.tabs.ungroup(toRemove);
        }

        // Update group title (preserve color and collapsed state)
        await chrome.tabGroups.update(existingGroup.id, {
          title: groupName
        });

        groupsUpdated++;
      } else {
        // Group doesn't exist - create it (same as before)
        const groupId = await chrome.tabs.group({ tabIds: newTabIds });

        await chrome.tabGroups.update(groupId, {
          title: groupName,
          color: getNextColor(),
          collapsed: false
        });

        // Add to map for potential future updates in this session
        existingGroupsByName.set(groupName, await chrome.tabGroups.get(groupId));

        groupsCreated++;
      }

      groupedCount += newTabIds.length;
    } catch (e) {
      console.error(`Error managing group for ${groupName}:`, e);
    }
  }

  // Ungroup tabs that shouldn't be in any group
  for (const tab of tabs) {
    if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE && !tabsInGroups.has(tab.id)) {
      try {
        await chrome.tabs.ungroup(tab.id);
      } catch (e) {
        console.error('Error ungrouping tab:', e);
      }
    }
  }

  // Move all ungrouped tabs to the end of the tab bar
  let ungroupedTabsMoved = 0;

  // Re-query tabs to get current state after organization
  const currentTabs = await chrome.tabs.query({ currentWindow: true });

  // Identify ungrouped tabs (skip chrome internal pages)
  const ungroupedTabsToMove = currentTabs.filter(tab =>
    tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE &&
    !shouldSkipUrl(tab.url)
  );

  if (ungroupedTabsToMove.length > 0) {
    // Move tabs to the end, preserving their relative order
    // Batch move for better performance - Chrome API accepts array of tab IDs
    const tabIdsToMove = ungroupedTabsToMove.map(tab => tab.id);
    try {
      await chrome.tabs.move(tabIdsToMove, { index: -1 });
      ungroupedTabsMoved = tabIdsToMove.length;
    } catch (e) {
      console.error('Error moving ungrouped tabs:', e);
    }
  }

  return {
    totalTabs: tabs.length,
    groupedTabs: groupedCount,
    groups: sortedGroups.length,
    groupsCreated: groupsCreated,
    groupsUpdated: groupsUpdated,
    ungroupedTabs: tabs.length - groupedCount,
    duplicatesClosed: duplicatesClosed,
    tabsMoved: tabsMoved,
    ungroupedTabsMoved: ungroupedTabsMoved,
    duplicateGroupsMerged: mergeResult?.mergedGroups || 0,
    tabsMovedFromMerge: mergeResult?.tabsMoved || 0,
    mergeErrors: mergeResult?.errors || 0
  };
}

export { organizeTabs };
