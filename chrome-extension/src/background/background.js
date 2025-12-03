// ABOUTME: Main service worker for Tab Organizer extension.
// ABOUTME: Routes messages from popup to appropriate handler functions.

import { organizeTabs } from './organizeTabs.js';
import { removeDuplicateTabs } from './removeDuplicateTabs.js';
import { removeAllGroups } from './removeAllGroups.js';
import { saveTabsToBookmarks } from './saveTabsToBookmarks.js';
import { restoreFromBookmarks } from './restoreFromBookmarks.js';
import { combineGroups } from './combineGroups.js';
import { getExistingGroups } from './getExistingGroups.js';
import { protectGroups } from './protectGroup.js';
import { getProtectedGroups } from './getProtectedGroups.js';
import { mergeDuplicateGroups } from './mergeDuplicateGroups.js';
import { getTabOrganizerBookmarkFolders } from '../utils/getTabOrganizerBookmarkFolders.js';
import {
  loadCategories,
  saveCategories,
  getCategories,
  resetCategories,
  DEFAULT_CATEGORIES
} from '../utils/categoryManager.js';

// Initialize categories on startup
loadCategories()
  .catch(error => console.error('Failed to load categories:', error));

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

  if (request.action === 'getCategories') {
    loadCategories()
      .then(categories => sendResponse(categories))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'saveCategories') {
    saveCategories(request.categories)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'resetCategories') {
    resetCategories()
      .then(() => sendResponse({ success: true, categories: DEFAULT_CATEGORIES }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'reloadCategories') {
    loadCategories()
      .then(categories => sendResponse({ success: true, categories }))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'getGroups') {
    getExistingGroups()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'combineGroups') {
    combineGroups(request.sourceGroupIds, request.targetGroupId)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'protectGroups') {
    protectGroups(request.groupIds)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'getProtectedGroups') {
    getProtectedGroups()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'mergeDuplicateGroups') {
    mergeDuplicateGroups()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});
