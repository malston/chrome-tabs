// Background service worker for Tab Organizer extension

// Import utility functions
const path = require('path');
const { shouldSkipUrl } = require(path.join(__dirname, './src/utils/shouldSkipUrl.js'));
const { extractGroupBaseName } = require(path.join(__dirname, './src/utils/extractGroupBaseName.js'));
const { getOtherBookmarksId } = require(path.join(__dirname, './src/utils/getOtherBookmarksId.js'));
const { getTabOrganizerBookmarkFolders } = require(path.join(__dirname, './src/utils/getTabOrganizerBookmarkFolders.js'));
const { organizeTabs } = require(path.join(__dirname, './src/background/organizeTabs.js'));
const { removeDuplicateTabs } = require(path.join(__dirname, './src/background/removeDuplicateTabs.js'));
const { removeAllGroups } = require(path.join(__dirname, './src/background/removeAllGroups.js'));
const { saveTabsToBookmarks } = require(path.join(__dirname, './src/background/saveTabsToBookmarks.js'));
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
    removeAllGroups,
    saveTabsToBookmarks,
    restoreFromBookmarks
  };
}
