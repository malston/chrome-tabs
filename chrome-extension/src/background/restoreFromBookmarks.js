// ABOUTME: Restores tabs from bookmark folders, merging with existing groups.
// ABOUTME: Skips duplicates and Chrome internal URLs.

import { shouldSkipUrl } from '../utils/shouldSkipUrl.js';
import { getNextColor } from '../utils/colorManager.js';

/**
 * Restores tabs from a bookmark folder, creating or merging into existing tab groups.
 * Skips duplicate URLs and Chrome internal URLs.
 *
 * @param {string} bookmarkFolderId - The ID of the bookmark folder containing tab groups
 * @returns {Promise<Object>} Statistics object with: totalRestored, duplicatesSkipped, groupsCreated, groupsMerged
 */
async function restoreFromBookmarks(bookmarkFolderId) {
  // Get the bookmark folder
  const [folder] = await chrome.bookmarks.get(bookmarkFolderId);
  if (!folder) {
    throw new Error('Bookmark folder not found');
  }

  // Get all children (bookmark folders)
  const children = await chrome.bookmarks.getChildren(bookmarkFolderId);

  // Get existing tabs to check for duplicates
  const existingTabs = await chrome.tabs.query({ currentWindow: true });
  const existingUrls = new Set(existingTabs.map(t => t.url));

  // Get existing groups to check if group name exists
  const existingGroups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
  const groupsByTitle = new Map();
  for (const group of existingGroups) {
    groupsByTitle.set(group.title, group);
  }

  let totalRestored = 0;
  let duplicatesSkipped = 0;
  let groupsCreated = 0;
  let groupsMerged = 0;

  // Check if this is a protected group folder (bookmarks directly in folder, no subfolders)
  // Protected folders start with 🔒 and contain bookmarks directly
  const hasSubfolders = children.some(child => !child.url);
  const hasDirectBookmarks = children.some(child => child.url);
  const isProtectedGroupFolder = folder.title.startsWith('🔒') && hasDirectBookmarks && !hasSubfolders;

  if (isProtectedGroupFolder) {
    // Handle protected group folder: bookmarks are directly in the folder
    // Extract group name from folder title (e.g., "🔒 github.com - 2024-01-15" -> "github.com")
    const groupName = folder.title.replace(/^🔒\s*/, '').replace(/\s*-\s*\d{4}-\d{2}-\d{2}.*$/, '');

    const urlsToRestore = [];
    for (const bookmark of children) {
      if (bookmark.url && !shouldSkipUrl(bookmark.url)) {
        if (existingUrls.has(bookmark.url)) {
          duplicatesSkipped++;
        } else {
          urlsToRestore.push(bookmark.url);
          existingUrls.add(bookmark.url);
        }
      }
    }

    if (urlsToRestore.length > 0) {
      const tabPromises = urlsToRestore.map(url =>
        chrome.tabs.create({ url, active: false }).catch(e => {
          console.error(`Error creating tab for ${url}:`, e);
          return null;
        })
      );
      const tabs = await Promise.all(tabPromises);
      const newTabIds = tabs.filter(t => t !== null).map(t => t.id);
      totalRestored += newTabIds.length;

      if (newTabIds.length > 0) {
        const existingGroup = groupsByTitle.get(groupName);
        if (existingGroup) {
          // Add tabs to existing group
          try {
            await chrome.tabs.group({ tabIds: newTabIds, groupId: existingGroup.id });
            groupsMerged++;
            console.log(`Added ${newTabIds.length} tabs to existing group: ${groupName}`);
          } catch (e) {
            console.error(`Error adding tabs to group ${groupName}:`, e);
          }
        } else {
          // Create new group
          try {
            const groupId = await chrome.tabs.group({ tabIds: newTabIds });
            await chrome.tabGroups.update(groupId, {
              title: groupName,
              color: getNextColor(),
              collapsed: false
            });
            groupsCreated++;

            // Add to our tracking map
            const newGroup = await chrome.tabGroups.get(groupId);
            groupsByTitle.set(groupName, newGroup);

            console.log(`Created new group: ${groupName} with ${newTabIds.length} tabs`);
          } catch (e) {
            console.error(`Error creating group ${groupName}:`, e);
          }
        }
      }
    }
  } else {
    // Handle regular Tab Organizer folder: subfolders represent tab groups
    for (const child of children) {
      // Only process folders
      if (!child.url) {
        const groupName = child.title;
        const bookmarks = await chrome.bookmarks.getChildren(child.id);

        // Filter out non-URL bookmarks and duplicates
        const urlsToRestore = [];
        for (const bookmark of bookmarks) {
          if (bookmark.url && !shouldSkipUrl(bookmark.url)) {
            if (existingUrls.has(bookmark.url)) {
              duplicatesSkipped++;
            } else {
              urlsToRestore.push(bookmark.url);
              existingUrls.add(bookmark.url); // Track to avoid duplicates within this restore
            }
          }
        }

        if (urlsToRestore.length === 0) {
          continue; // Skip empty folders
        }

        // Create tabs for these URLs (parallel for better performance)
        const tabPromises = urlsToRestore.map(url =>
          chrome.tabs.create({
            url: url,
            active: false
          }).catch(e => {
            console.error(`Error creating tab for ${url}:`, e);
            return null;
          })
        );
        const tabs = await Promise.all(tabPromises);
        const newTabIds = tabs.filter(t => t !== null).map(t => t.id);
        totalRestored += newTabIds.length;

        if (newTabIds.length === 0) {
          continue; // No tabs created
        }

        // Check if group with this name already exists
        const existingGroup = groupsByTitle.get(groupName);

        if (existingGroup) {
          // Add tabs to existing group
          try {
            await chrome.tabs.group({
              tabIds: newTabIds,
              groupId: existingGroup.id
            });
            groupsMerged++;
            console.log(`Added ${newTabIds.length} tabs to existing group: ${groupName}`);
          } catch (e) {
            console.error(`Error adding tabs to group ${groupName}:`, e);
          }
        } else {
          // Create new group
          try {
            const groupId = await chrome.tabs.group({ tabIds: newTabIds });
            await chrome.tabGroups.update(groupId, {
              title: groupName,
              color: getNextColor(),
              collapsed: false
            });
            groupsCreated++;

            // Add to our tracking map
            const newGroup = await chrome.tabGroups.get(groupId);
            groupsByTitle.set(groupName, newGroup);

            console.log(`Created new group: ${groupName} with ${newTabIds.length} tabs`);
          } catch (e) {
            console.error(`Error creating group ${groupName}:`, e);
          }
        }
      }
    }
  }

  return {
    totalRestored: totalRestored,
    duplicatesSkipped: duplicatesSkipped,
    groupsCreated: groupsCreated,
    groupsMerged: groupsMerged
  };
}

export { restoreFromBookmarks };
