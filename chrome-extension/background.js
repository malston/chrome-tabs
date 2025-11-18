// Background service worker for Tab Organizer extension

// Color palette for tab groups
const COLORS = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
let colorIndex = 0;

function getNextColor() {
  const color = COLORS[colorIndex % COLORS.length];
  colorIndex++;
  return color;
}

/**
 * Extracts the base name from a group title by removing the tab count suffix.
 * This allows matching existing groups with new grouping operations.
 *
 * Examples:
 * - "github.com (15)" → "github.com"
 * - "markalston.net (5)" → "markalston.net"
 * - "Development (10)" → "Development"
 *
 * @param {string} groupTitle - The full group title with count
 * @returns {string} The base name without the count suffix
 */
function extractGroupBaseName(groupTitle) {
  if (!groupTitle) return '';
  // Remove the " (count)" suffix using regex
  // Matches: space, opening paren, one or more digits, closing paren, end of string
  return groupTitle.replace(/\s*\(\d+\)$/, '');
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
      if (domain.startsWith('192.168.') || domain.startsWith('172.') || domain.startsWith('10.')) {
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

function categorizeUrl(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase().replace(/^www\./, '');
    const path = urlObj.pathname.toLowerCase();

    // Development & Tech
    if (domain.includes('github') || domain.includes('gitlab') || domain.includes('bitbucket') ||
        domain.includes('stackoverflow') || domain.includes('stackexchange') ||
        domain.includes('npmjs') || domain.includes('pypi') || domain.includes('maven') ||
        domain.includes('docker') || domain.includes('kubernetes') ||
        domain === 'localhost' || /^[\d.:]+$/.test(domain)) {
      return 'Development';
    }

    // Documentation & Learning
    if (domain.includes('docs.') || domain.includes('documentation') ||
        domain.includes('readthedocs') || domain.includes('developer.') ||
        domain.includes('api.') && path.includes('doc') ||
        domain.includes('tutorial') || domain.includes('learn') ||
        domain.includes('coursera') || domain.includes('udemy') || domain.includes('edx') ||
        domain.includes('pluralsight') || domain.includes('codecademy')) {
      return 'Documentation';
    }

    // Social Media
    if (domain.includes('facebook') || domain.includes('threads') || domain.includes('x.com') ||
        domain.includes('twitter') || domain.includes('instagram') || domain.includes('linkedin') ||
        domain.includes('reddit') || domain.includes('tiktok') || domain.includes('snapchat') ||
        domain.includes('pinterest') || domain.includes('mastodon') || domain.includes('bluesky')) {
      return 'Social Media';
    }

    // Communication
    if (domain.includes('slack') || domain.includes('discord') || domain.includes('teams') ||
        domain.includes('zoom') || domain.includes('meet') || domain.includes('webex') ||
        domain.includes('mail') || domain.includes('gmail') || domain.includes('outlook') ||
        domain.includes('protonmail') || domain.includes('telegram')) {
      return 'Communication';
    }

    // Shopping & Commerce
    if (domain.includes('amazon') || domain.includes('ebay') || domain.includes('etsy') ||
        domain.includes('shop') || domain.includes('store') || domain.includes('cart') ||
        domain.includes('checkout') || domain.includes('buy') ||
        domain.includes('walmart') || domain.includes('target') || domain.includes('bestbuy')) {
      return 'Shopping';
    }

    // Cloud & Productivity
    if (domain.includes('google') && (path.includes('drive') || path.includes('docs') || path.includes('sheets')) ||
        domain.includes('dropbox') || domain.includes('onedrive') || domain.includes('icloud') ||
        domain.includes('notion') || domain.includes('evernote') || domain.includes('trello') ||
        domain.includes('asana') || domain.includes('monday') || domain.includes('airtable') ||
        domain.includes('sharepoint') || domain.includes('confluence')) {
      return 'Productivity';
    }

    // News & Media
    if (domain.includes('news') || domain.includes('cnn') || domain.includes('bbc') ||
        domain.includes('nytimes') || domain.includes('wsj') || domain.includes('reuters') ||
        domain.includes('medium') || domain.includes('substack') || domain.includes('blog') ||
        domain.includes('article') || domain.includes('post')) {
      return 'News & Media';
    }

    // Entertainment
    if (domain.includes('youtube') || domain.includes('netflix') || domain.includes('hulu') ||
        domain.includes('spotify') || domain.includes('twitch') || domain.includes('vimeo') ||
        domain.includes('soundcloud') || domain.includes('disneyplus') || domain.includes('hbomax') ||
        domain.includes('gaming') || domain.includes('game')) {
      return 'Entertainment';
    }

    // Finance & Banking
    if (domain.includes('bank') || domain.includes('paypal') || domain.includes('venmo') ||
        domain.includes('stripe') || domain.includes('mint') || domain.includes('finance') ||
        domain.includes('investing') || domain.includes('trading') || domain.includes('crypto') ||
        domain.includes('coinbase') || domain.includes('robinhood')) {
      return 'Finance';
    }

    // Cloud Platforms & DevOps
    if (domain.includes('aws') || domain.includes('azure') || domain.includes('cloud.google') ||
        domain.includes('heroku') || domain.includes('vercel') || domain.includes('netlify') ||
        domain.includes('digitalocean') || domain.includes('linode') || domain.includes('vultr')) {
      return 'Cloud Services';
    }

    // Default category
    return 'Other';
  } catch (e) {
    return 'Other';
  }
}

async function organizeTabs(mode = 'domain', allWindows = false) {
  console.log(`Organizing tabs by ${mode}${allWindows ? ' across all windows' : ''}...`);

  // Get current window for reference
  const currentWindow = await chrome.windows.getCurrent();

  // Get all tabs - either from current window or all windows
  let tabs = await chrome.tabs.query(allWindows ? {} : { currentWindow: true });
  let duplicatesClosed = 0;
  let tabsMoved = 0;

  // If organizing across all windows, first remove duplicates and move all tabs to current window
  if (allWindows) {
    // Track unique URLs and their first occurrence
    const seenUrls = new Map(); // url -> tab
    const tabsToClose = [];
    const tabsToMove = [];

    for (const tab of tabs) {
      // Skip chrome internal pages
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url === 'about:blank') {
        continue;
      }

      if (seenUrls.has(tab.url)) {
        // This is a duplicate - mark for closure
        tabsToClose.push(tab.id);
        console.log(`Found duplicate: ${tab.title} (${tab.url})`);
      } else {
        // First occurrence - keep it
        seenUrls.set(tab.url, tab);

        // If tab is in a different window, mark for moving
        if (tab.windowId !== currentWindow.id) {
          tabsToMove.push(tab);
        }
      }
    }

    // Close duplicate tabs
    if (tabsToClose.length > 0) {
      console.log(`Closing ${tabsToClose.length} duplicate tabs...`);
      await chrome.tabs.remove(tabsToClose);
      duplicatesClosed = tabsToClose.length;
    }

    // Move tabs from other windows to current window
    if (tabsToMove.length > 0) {
      console.log(`Moving ${tabsToMove.length} tabs to current window...`);
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
  }

  // Group tabs by domain or category
  const groups = {};
  const skipDomains = new Set(['chrome://', 'chrome-extension://', 'about:']);

  for (const tab of tabs) {
    // Skip chrome internal pages
    if (skipDomains.has(tab.url.substring(0, tab.url.indexOf('/')))) {
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
  colorIndex = 0; // Reset color index for new groups

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

        // Update group title with new count (preserve color and collapsed state)
        await chrome.tabGroups.update(existingGroup.id, {
          title: `${groupName} (${newTabIds.length})`
        });

        groupsUpdated++;
        console.log(`Updated group: ${groupName} (+${toAdd.length} -${toRemove.length} tabs, total: ${newTabIds.length})`);
      } else {
        // Group doesn't exist - create it (same as before)
        const groupId = await chrome.tabs.group({ tabIds: newTabIds });

        await chrome.tabGroups.update(groupId, {
          title: `${groupName} (${newTabIds.length})`,
          color: getNextColor(),
          collapsed: false
        });

        // Add to map for potential future updates in this session
        existingGroupsByName.set(groupName, await chrome.tabGroups.get(groupId));

        groupsCreated++;
        console.log(`Created new group: ${groupName} (${newTabIds.length} tabs)`);
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

  return {
    totalTabs: tabs.length,
    groupedTabs: groupedCount,
    groups: sortedGroups.length,
    groupsCreated: groupsCreated,
    groupsUpdated: groupsUpdated,
    ungroupedTabs: tabs.length - groupedCount,
    duplicatesClosed: duplicatesClosed,
    tabsMoved: tabsMoved
  };
}

async function removeAllGroups() {
  console.log('Removing all tab groups...');

  const tabs = await chrome.tabs.query({ currentWindow: true });

  for (const tab of tabs) {
    if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      try {
        await chrome.tabs.ungroup(tab.id);
      } catch (e) {
        console.error('Error ungrouping tab:', e);
      }
    }
  }

  return { ungrouped: tabs.filter(t => t.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE).length };
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
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url === 'about:blank') {
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

  // Close duplicate tabs
  let closedCount = 0;
  for (const tabId of tabsToClose) {
    try {
      await chrome.tabs.remove(tabId);
      closedCount++;
    } catch (e) {
      console.error('Error closing tab:', e);
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
  const rootFolder = await chrome.bookmarks.create({
    parentId: '2', // "2" is the ID for "Other Bookmarks" in Chrome
    title: rootFolderName
  });

  // Group tabs by their group ID
  const tabsByGroup = new Map();
  const ungroupedTabs = [];

  for (const tab of tabs) {
    // Skip chrome internal pages
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url === 'about:blank') {
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

    // Add bookmarks for each tab in the group
    for (const tab of groupTabs) {
      try {
        await chrome.bookmarks.create({
          parentId: groupFolder.id,
          title: tab.title || tab.url,
          url: tab.url
        });
        savedCount++;
      } catch (e) {
        console.error(`Error saving bookmark for ${tab.url}:`, e);
      }
    }
  }

  // Save ungrouped tabs if any exist
  if (ungroupedTabs.length > 0) {
    const ungroupedFolder = await chrome.bookmarks.create({
      parentId: rootFolder.id,
      title: 'Ungrouped Tabs'
    });
    folderCount++;

    for (const tab of ungroupedTabs) {
      try {
        await chrome.bookmarks.create({
          parentId: ungroupedFolder.id,
          title: tab.title || tab.url,
          url: tab.url
        });
        savedCount++;
      } catch (e) {
        console.error(`Error saving bookmark for ${tab.url}:`, e);
      }
    }
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
        if (bookmark.url &&
            !bookmark.url.startsWith('chrome://') &&
            !bookmark.url.startsWith('chrome-extension://')) {

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

      // Create tabs for these URLs
      const newTabIds = [];
      for (const url of urlsToRestore) {
        try {
          const tab = await chrome.tabs.create({
            url: url,
            active: false
          });
          newTabIds.push(tab.id);
          totalRestored++;
        } catch (e) {
          console.error(`Error creating tab for ${url}:`, e);
        }
      }

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

async function getTabOrganizerBookmarkFolders() {
  console.log('Getting Tab Organizer bookmark folders...');

  // Get "Other Bookmarks" (ID: "2")
  const children = await chrome.bookmarks.getChildren('2');

  // Find all folders that start with "Tab Organizer -"
  const tabOrganizerFolders = children.filter(child =>
    !child.url && child.title && child.title.startsWith('Tab Organizer -')
  );

  // Sort by title (which includes timestamp) in reverse order (newest first)
  tabOrganizerFolders.sort((a, b) => b.title.localeCompare(a.title));

  return tabOrganizerFolders.map(folder => ({
    id: folder.id,
    title: folder.title
  }));
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
    extractDomain,
    extractBaseDomain,
    extractGroupBaseName,
    categorizeUrl,
    organizeTabs,
    removeDuplicateTabs,
    removeAllGroups,
    saveTabsToBookmarks,
    restoreFromBookmarks,
    getTabOrganizerBookmarkFolders,
    getNextColor,
    COLORS
  };
}
