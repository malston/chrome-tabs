// Background service worker for Tab Organizer extension

// Color palette for tab groups
const COLORS = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
let colorIndex = 0;

function getNextColor() {
  const color = COLORS[colorIndex % COLORS.length];
  colorIndex++;
  return color;
}

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

    return domain;
  } catch (e) {
    return 'unknown';
  }
}

async function organizeTabs(mode = 'domain') {
  console.log(`Organizing tabs by ${mode}...`);

  // Get all tabs in current window
  const tabs = await chrome.tabs.query({ currentWindow: true });

  // Group tabs by domain
  const domainGroups = {};
  const skipDomains = new Set(['chrome://', 'chrome-extension://', 'about:']);

  for (const tab of tabs) {
    // Skip chrome internal pages
    if (skipDomains.has(tab.url.substring(0, tab.url.indexOf('/')))) {
      continue;
    }

    const domain = extractDomain(tab.url);

    if (!domainGroups[domain]) {
      domainGroups[domain] = [];
    }

    domainGroups[domain].push(tab);
  }

  // Ungroup all tabs first
  for (const tab of tabs) {
    if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      try {
        await chrome.tabs.ungroup(tab.id);
      } catch (e) {
        // Tab might already be ungrouped
      }
    }
  }

  // Create groups for domains with multiple tabs
  let groupedCount = 0;
  colorIndex = 0; // Reset color index

  // Sort domains by tab count (most tabs first)
  const sortedDomains = Object.entries(domainGroups)
    .filter(([_, tabs]) => tabs.length > 1)  // Only group if 2+ tabs
    .sort((a, b) => b[1].length - a[1].length);

  for (const [domain, domainTabs] of sortedDomains) {
    if (domainTabs.length <= 1) continue;

    // Get tab IDs
    const tabIds = domainTabs.map(t => t.id);

    try {
      // Create a group with these tabs
      const groupId = await chrome.tabs.group({ tabIds });

      // Update the group with a title and color
      await chrome.tabGroups.update(groupId, {
        title: `${domain} (${domainTabs.length})`,
        color: getNextColor(),
        collapsed: false
      });

      groupedCount += domainTabs.length;
      console.log(`Grouped ${domainTabs.length} tabs for ${domain}`);
    } catch (e) {
      console.error(`Error grouping tabs for ${domain}:`, e);
    }
  }

  return {
    totalTabs: tabs.length,
    groupedTabs: groupedCount,
    domains: sortedDomains.length,
    ungroupedTabs: tabs.length - groupedCount
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

  return {
    totalTabs: tabs.length,
    duplicatesFound: tabsToClose.length,
    duplicatesClosed: closedCount,
    remainingTabs: tabs.length - closedCount
  };
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'organizeTabs') {
    organizeTabs(request.mode || 'domain')
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
});

console.log('Tab Organizer extension loaded');
