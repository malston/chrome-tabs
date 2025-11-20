// ABOUTME: Main service worker for Tab Organizer extension.
// ABOUTME: Routes messages from popup to appropriate handler functions.

import { organizeTabs } from './src/background/organizeTabs.js';
import { removeDuplicateTabs } from './src/background/removeDuplicateTabs.js';
import { removeAllGroups } from './src/background/removeAllGroups.js';
import { saveTabsToBookmarks } from './src/background/saveTabsToBookmarks.js';
import { restoreFromBookmarks } from './src/background/restoreFromBookmarks.js';
import { getTabOrganizerBookmarkFolders } from './src/utils/getTabOrganizerBookmarkFolders.js';

console.log('Tab Organizer extension loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'organizeTabs') {
    organizeTabs(request.mode || 'domain', request.allWindows || false)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true; // Keep channel open for async response
  }

  if (request.action === 'removeDuplicates') {
    removeDuplicateTabs()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'removeGroups') {
    removeAllGroups()
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
