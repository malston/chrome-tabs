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
    if (domain.includes('facebook') || domain.includes('twitter') || domain.includes('x.com') ||
        domain.includes('instagram') || domain.includes('linkedin') || domain.includes('reddit') ||
        domain.includes('tiktok') || domain.includes('snapchat') || domain.includes('pinterest') ||
        domain.includes('mastodon') || domain.includes('bluesky')) {
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

async function organizeTabs(mode = 'domain') {
  console.log(`Organizing tabs by ${mode}...`);

  // Get all tabs in current window
  const tabs = await chrome.tabs.query({ currentWindow: true });

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

  // Create groups for domains/categories with multiple tabs
  let groupedCount = 0;
  colorIndex = 0; // Reset color index

  // Sort groups by tab count (most tabs first)
  const sortedGroups = Object.entries(groups)
    .filter(([_, tabs]) => tabs.length > 1)  // Only group if 2+ tabs
    .sort((a, b) => b[1].length - a[1].length);

  for (const [groupName, groupTabs] of sortedGroups) {
    if (groupTabs.length <= 1) continue;

    // Sort tabs within group by title (alphabetically)
    const sortedTabs = groupTabs.sort((a, b) => {
      const titleA = a.title.toLowerCase();
      const titleB = b.title.toLowerCase();
      return titleA.localeCompare(titleB);
    });

    // Get tab IDs in sorted order
    const tabIds = sortedTabs.map(t => t.id);

    try {
      // Create a group with these tabs
      const groupId = await chrome.tabs.group({ tabIds });

      // Update the group with a title and color
      await chrome.tabGroups.update(groupId, {
        title: `${groupName} (${groupTabs.length})`,
        color: getNextColor(),
        collapsed: false
      });

      groupedCount += groupTabs.length;
      console.log(`Grouped ${groupTabs.length} tabs for ${groupName} (sorted alphabetically)`);
    } catch (e) {
      console.error(`Error grouping tabs for ${groupName}:`, e);
    }
  }

  return {
    totalTabs: tabs.length,
    groupedTabs: groupedCount,
    groups: sortedGroups.length,
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
