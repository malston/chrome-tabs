// Background service worker for Tab Organizer extension

// Import utility functions
const path = require('path');
const { shouldSkipUrl } = require(path.join(__dirname, './src/utils/shouldSkipUrl.js'));
const { extractGroupBaseName } = require(path.join(__dirname, './src/utils/extractGroupBaseName.js'));
const { getOtherBookmarksId } = require(path.join(__dirname, './src/utils/getOtherBookmarksId.js'));
const { getTabOrganizerBookmarkFolders } = require(path.join(__dirname, './src/utils/getTabOrganizerBookmarkFolders.js'));
const { organizeTabs } = require(path.join(__dirname, './src/background/organizeTabs.js'));
const { getNextColor } = require(path.join(__dirname, './src/utils/colorManager.js'));

/**
 * Checks if an IPv4 address is in a private range according to RFC 1918.
 * Private ranges:
 * - 10.0.0.0/8 (10.0.0.0 - 10.255.255.255)
 * - 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
 * - 192.168.0.0/16 (192.168.0.0 - 192.168.255.255)
 *
 * @param {string} ip - The IP address to check
 * @returns {boolean} True if the IP is in a private range
 */
function isPrivateIPv4(ip) {
  // 192.168.0.0/16 - All 192.168.x.x addresses
  if (ip.startsWith('192.168.')) {
    return true;
  }

  // 10.0.0.0/8 - All 10.x.x.x addresses
  if (ip.startsWith('10.')) {
    return true;
  }

  // 172.16.0.0/12 - Only 172.16.x.x through 172.31.x.x
  if (ip.startsWith('172.')) {
    const parts = ip.split('.');
    if (parts.length >= 2) {
      const secondOctet = parseInt(parts[1], 10);
      return secondOctet >= 16 && secondOctet <= 31;
    }
  }

  return false;
}

/**
 * Extracts the base domain from a URL, grouping subdomains together.
 *
 * Examples:
 * - vcsa.markalston.net → markalston.net
 * - api.github.com → github.com
 * - www.example.co.uk → example.co.uk
 *
 * @param {string} url - The URL to extract the domain from
 * @returns {string} The base domain or special identifier
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    let domain = urlObj.hostname;

    // Remove www. prefix
    if (domain.startsWith('www.')) {
      domain = domain.substring(4);
    }

    // Handle localhost
    if (domain.startsWith('localhost')) {
      return 'localhost';
    }

    // Handle IP addresses - group private IPs together
    if (/^[\d.:]+$/.test(domain)) {
      // Check for RFC 1918 private IP ranges
      if (isPrivateIPv4(domain)) {
        return 'local-network';
      }
      return 'ip-addresses';
    }

    // Extract base domain (eTLD+1) to group subdomains together
    // This groups vcsa.markalston.net, opsman.lab.markalston.net → markalston.net
    return extractBaseDomain(domain);
  } catch (e) {
    return 'unknown';
  }
}

/**
 * Extracts the base domain (eTLD+1) from a hostname.
 * Handles common multi-part TLDs like .co.uk, .com.au, etc.
 *
 * @param {string} hostname - The hostname to process
 * @returns {string} The base domain
 */
function extractBaseDomain(hostname) {
  const parts = hostname.split('.');

  // If only one or two parts, return as-is (e.g., "localhost", "example.com")
  if (parts.length <= 2) {
    return hostname;
  }

  // Known multi-part TLDs (country-code TLDs and special cases)
  const multiPartTLDs = [
    'co.uk', 'co.jp', 'co.kr', 'co.nz', 'co.za',
    'com.au', 'com.br', 'com.cn', 'com.mx', 'com.ar',
    'net.au', 'org.au', 'edu.au',
    'ac.uk', 'gov.uk', 'org.uk',
    'ne.jp', 'or.jp', 'go.jp',
    'github.io', 'gitlab.io', 'netlify.app', 'vercel.app',
    'herokuapp.com', 'azurewebsites.net', 'cloudfront.net'
  ];

  // Check if domain ends with a known multi-part TLD
  for (const tld of multiPartTLDs) {
    if (hostname.endsWith('.' + tld)) {
      // For multi-part TLDs, keep 3 parts: subdomain.domain.tld1.tld2
      // Example: api.example.co.uk → example.co.uk
      return parts.slice(-3).join('.');
    }
  }

  // Default: keep last 2 parts for standard TLDs
  // Example: vcsa.markalston.net → markalston.net
  return parts.slice(-2).join('.');
}

async function removeAllGroups() {
  console.log('Removing all tab groups...');

  const tabs = await chrome.tabs.query({ currentWindow: true });

  // Batch ungroup operation for better performance
  const groupedTabIds = tabs
    .filter(tab => tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE)
    .map(tab => tab.id);

  if (groupedTabIds.length > 0) {
    try {
      await chrome.tabs.ungroup(groupedTabIds);
    } catch (e) {
      console.error('Error ungrouping tabs:', e);
    }
  }

  return { ungrouped: groupedTabIds.length };
}

async function removeDuplicateTabs() {
  console.log('Removing duplicate tabs...');

  const tabs = await chrome.tabs.query({ currentWindow: true });

  // Track seen URLs
  const seenUrls = new Map(); // url -> first tab with that URL
  const tabsToClose = [];

  for (const tab of tabs) {
    const url = tab.url;

    // Skip chrome internal pages
    if (shouldSkipUrl(url)) {
      continue;
    }

    if (seenUrls.has(url)) {
      // This is a duplicate - mark for closure
      tabsToClose.push(tab.id);
      console.log(`Found duplicate: ${tab.title} (${url})`);
    } else {
      // First occurrence - keep it
      seenUrls.set(url, tab);
    }
  }

  // Close duplicate tabs (batch operation for better performance)
  let closedCount = 0;
  if (tabsToClose.length > 0) {
    try {
      await chrome.tabs.remove(tabsToClose);
      closedCount = tabsToClose.length;
    } catch (e) {
      console.error('Error closing tabs:', e);
    }
  }

  // Update group titles to reflect new tab counts after removing duplicates
  if (closedCount > 0) {
    const groups = await chrome.tabGroups.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });

    for (const group of groups) {
      // Count tabs currently in this group
      const tabsInGroup = await chrome.tabs.query({ groupId: group.id });
      const newCount = tabsInGroup.length;

      // Extract base name (without count) and update with new count
      const baseName = extractGroupBaseName(group.title);
      const newTitle = `${baseName} (${newCount})`;

      // Only update if the title has changed
      if (group.title !== newTitle) {
        await chrome.tabGroups.update(group.id, { title: newTitle });
        console.log(`Updated group "${group.title}" to "${newTitle}"`);
      }
    }
  }

  return {
    totalTabs: tabs.length,
    duplicatesFound: tabsToClose.length,
    duplicatesClosed: closedCount,
    remainingTabs: tabs.length - closedCount
  };
}

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

async function restoreFromBookmarks(bookmarkFolderId) {
  console.log('Restoring tabs from bookmarks...');

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

  // Process each bookmark folder (which represents a tab group)
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

  console.log(`Restored ${totalRestored} tabs, skipped ${duplicatesSkipped} duplicates`);

  return {
    totalRestored: totalRestored,
    duplicatesSkipped: duplicatesSkipped,
    groupsCreated: groupsCreated,
    groupsMerged: groupsMerged
  };
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'organizeTabs') {
    organizeTabs(request.mode || 'domain', request.allWindows || false)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Keep channel open for async response
  }

  if (request.action === 'removeGroups') {
    removeAllGroups()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'removeDuplicates') {
    removeDuplicateTabs()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'saveToBookmarks') {
    saveTabsToBookmarks()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'getBookmarkFolders') {
    getTabOrganizerBookmarkFolders()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'restoreFromBookmarks') {
    restoreFromBookmarks(request.folderId)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

console.log('Tab Organizer extension loaded');

// Export functions for testing (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isPrivateIPv4,
    extractDomain,
    extractBaseDomain,
    extractGroupBaseName,
    removeDuplicateTabs,
    removeAllGroups,
    saveTabsToBookmarks,
    restoreFromBookmarks
  };
}
