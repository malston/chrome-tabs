// ABOUTME: Saves current tabs to Chrome bookmarks organized by groups.
// ABOUTME: Creates timestamped folder structure in Other Bookmarks.

const { shouldSkipUrl } = require('../utils/shouldSkipUrl.js');
const { getOtherBookmarksId } = require('../utils/getOtherBookmarksId.js');

async function saveTabsToBookmarks() {
  console.log('Saving tabs to bookmarks...');

  const tabs = await chrome.tabs.query({ currentWindow: true });
  const groups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });

  // Create a map of group IDs to group info
  const groupMap = new Map();
  for (const group of groups) {
    groupMap.set(group.id, group);
  }

  // Create root folder with timestamp
  const timestamp = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).replace(/[/:]/g, '-').replace(', ', ' ');

  const rootFolderName = `Tab Organizer - ${timestamp}`;

  // Create root bookmark folder in "Other Bookmarks"
  const otherBookmarksId = await getOtherBookmarksId();
  const rootFolder = await chrome.bookmarks.create({
    parentId: otherBookmarksId,
    title: rootFolderName
  });

  // Group tabs by their group ID
  const tabsByGroup = new Map();
  const ungroupedTabs = [];

  for (const tab of tabs) {
    // Skip chrome internal pages
    if (shouldSkipUrl(tab.url)) {
      continue;
    }

    if (tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
      ungroupedTabs.push(tab);
    } else {
      if (!tabsByGroup.has(tab.groupId)) {
        tabsByGroup.set(tab.groupId, []);
      }
      tabsByGroup.get(tab.groupId).push(tab);
    }
  }

  let savedCount = 0;
  let folderCount = 0;

  // Save grouped tabs
  for (const [groupId, groupTabs] of tabsByGroup.entries()) {
    const group = groupMap.get(groupId);
    const folderName = group ? group.title : 'Unknown Group';

    // Create folder for this group
    const groupFolder = await chrome.bookmarks.create({
      parentId: rootFolder.id,
      title: folderName
    });
    folderCount++;

    // Add bookmarks for each tab in the group (parallel for better performance)
    const bookmarkPromises = groupTabs.map(tab =>
      chrome.bookmarks.create({
        parentId: groupFolder.id,
        title: tab.title || tab.url,
        url: tab.url
      }).catch(e => {
        console.error(`Error saving bookmark for ${tab.url}:`, e);
        return null;
      })
    );
    const results = await Promise.all(bookmarkPromises);
    savedCount += results.filter(r => r !== null).length;
  }

  // Save ungrouped tabs if any exist
  if (ungroupedTabs.length > 0) {
    const ungroupedFolder = await chrome.bookmarks.create({
      parentId: rootFolder.id,
      title: 'Ungrouped Tabs'
    });
    folderCount++;

    // Add bookmarks for ungrouped tabs (parallel for better performance)
    const bookmarkPromises = ungroupedTabs.map(tab =>
      chrome.bookmarks.create({
        parentId: ungroupedFolder.id,
        title: tab.title || tab.url,
        url: tab.url
      }).catch(e => {
        console.error(`Error saving bookmark for ${tab.url}:`, e);
        return null;
      })
    );
    const results = await Promise.all(bookmarkPromises);
    savedCount += results.filter(r => r !== null).length;
  }

  console.log(`Saved ${savedCount} bookmarks in ${folderCount} folders`);

  return {
    totalTabs: tabs.length,
    savedBookmarks: savedCount,
    folders: folderCount,
    rootFolderName: rootFolderName
  };
}

module.exports = { saveTabsToBookmarks };
