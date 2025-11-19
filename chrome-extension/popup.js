// Popup script for Tab Organizer extension

const organizeBtn = document.getElementById('organizeBtn');
const organizeCategoryBtn = document.getElementById('organizeCategoryBtn');
const organizeAllWindowsBtn = document.getElementById('organizeAllWindowsBtn');
const organizeAllWindowsCategoryBtn = document.getElementById('organizeAllWindowsCategoryBtn');
const dedupeBtn = document.getElementById('dedupeBtn');
const saveBookmarksBtn = document.getElementById('saveBookmarksBtn');
const restoreBookmarksBtn = document.getElementById('restoreBookmarksBtn');
const removeGroupsBtn = document.getElementById('removeGroupsBtn');
const statusDiv = document.getElementById('status');
const bookmarkSelector = document.getElementById('bookmarkSelector');
const folderSelect = document.getElementById('folderSelect');
const restoreSelectedBtn = document.getElementById('restoreSelectedBtn');
const cancelSelectBtn = document.getElementById('cancelSelectBtn');

function showStatus(message, type = 'success') {
  statusDiv.textContent = message;
  statusDiv.className = `status show ${type}`;

  setTimeout(() => {
    statusDiv.classList.remove('show');
  }, 3000);
}

organizeBtn.addEventListener('click', async () => {
  organizeBtn.disabled = true;
  organizeBtn.textContent = 'Organizing...';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'organizeTabs',
      mode: 'domain'
    });

    if (response.error) {
      showStatus(`Error: ${response.error}`, 'error');
    } else {
      let message = `✓ Organized ${response.groupedTabs} tabs into ${response.groups} groups!`;
      if (response.ungroupedDuplicates > 0) {
        message += ` Warning: ${response.ungroupedDuplicates} ungrouped duplicate(s) found.`;
      }
      showStatus(message, 'success');
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    organizeBtn.disabled = false;
    organizeBtn.textContent = 'Organize by Domain';
  }
});

organizeCategoryBtn.addEventListener('click', async () => {
  organizeCategoryBtn.disabled = true;
  organizeCategoryBtn.textContent = 'Organizing...';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'organizeTabs',
      mode: 'category'
    });

    if (response.error) {
      showStatus(`Error: ${response.error}`, 'error');
    } else {
      let message = `✓ Organized ${response.groupedTabs} tabs into ${response.groups} categories!`;
      if (response.ungroupedDuplicates > 0) {
        message += ` Warning: ${response.ungroupedDuplicates} ungrouped duplicate(s) found.`;
      }
      showStatus(message, 'success');
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    organizeCategoryBtn.disabled = false;
    organizeCategoryBtn.textContent = 'Organize by Category';
  }
});

organizeAllWindowsBtn.addEventListener('click', async () => {
  organizeAllWindowsBtn.disabled = true;
  organizeAllWindowsBtn.textContent = 'Organizing...';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'organizeTabs',
      mode: 'domain',
      allWindows: true
    });

    if (response.error) {
      showStatus(`Error: ${response.error}`, 'error');
    } else {
      let message = `✓ Organized ${response.groupedTabs} tabs into ${response.groups} groups!`;
      if (response.duplicatesClosed > 0) {
        message += ` Removed ${response.duplicatesClosed} duplicates.`;
      }
      if (response.tabsMoved > 0) {
        message += ` Moved ${response.tabsMoved} tabs.`;
      }
      if (response.ungroupedDuplicates > 0) {
        message += ` Warning: ${response.ungroupedDuplicates} ungrouped duplicate(s) found.`;
      }
      showStatus(message, 'success');
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    organizeAllWindowsBtn.disabled = false;
    organizeAllWindowsBtn.textContent = 'Organize All Windows by Domain';
  }
});

organizeAllWindowsCategoryBtn.addEventListener('click', async () => {
  organizeAllWindowsCategoryBtn.disabled = true;
  organizeAllWindowsCategoryBtn.textContent = 'Organizing...';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'organizeTabs',
      mode: 'category',
      allWindows: true
    });

    if (response.error) {
      showStatus(`Error: ${response.error}`, 'error');
    } else {
      let message = `✓ Organized ${response.groupedTabs} tabs into ${response.groups} categories!`;
      if (response.duplicatesClosed > 0) {
        message += ` Removed ${response.duplicatesClosed} duplicates.`;
      }
      if (response.tabsMoved > 0) {
        message += ` Moved ${response.tabsMoved} tabs.`;
      }
      if (response.ungroupedDuplicates > 0) {
        message += ` Warning: ${response.ungroupedDuplicates} ungrouped duplicate(s) found.`;
      }
      showStatus(message, 'success');
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    organizeAllWindowsCategoryBtn.disabled = false;
    organizeAllWindowsCategoryBtn.textContent = 'Organize All Windows by Category';
  }
});

dedupeBtn.addEventListener('click', async () => {
  dedupeBtn.disabled = true;
  dedupeBtn.textContent = 'Finding duplicates...';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'removeDuplicates'
    });

    if (response.error) {
      showStatus(`Error: ${response.error}`, 'error');
    } else if (response.duplicatesClosed === 0) {
      showStatus('✓ No duplicates found!', 'success');
    } else {
      showStatus(
        `✓ Removed ${response.duplicatesClosed} duplicate tabs!`,
        'success'
      );
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    dedupeBtn.disabled = false;
    dedupeBtn.textContent = 'Remove Duplicates';
  }
});

saveBookmarksBtn.addEventListener('click', async () => {
  saveBookmarksBtn.disabled = true;
  saveBookmarksBtn.textContent = 'Saving...';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'saveToBookmarks'
    });

    if (response.error) {
      showStatus(`Error: ${response.error}`, 'error');
    } else {
      showStatus(
        `✓ Saved ${response.savedBookmarks} bookmarks in ${response.folders} folders!`,
        'success'
      );
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    saveBookmarksBtn.disabled = false;
    saveBookmarksBtn.textContent = 'Save to Bookmarks';
  }
});

restoreBookmarksBtn.addEventListener('click', async () => {
  restoreBookmarksBtn.disabled = true;
  restoreBookmarksBtn.textContent = 'Loading...';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getBookmarkFolders'
    });

    if (response.error) {
      showStatus(`Error: ${response.error}`, 'error');
    } else if (response.length === 0) {
      showStatus('No saved bookmark folders found', 'error');
    } else {
      // Hide main buttons, show selector
      document.querySelectorAll('#organizeBtn, #organizeCategoryBtn, #organizeAllWindowsBtn, #organizeAllWindowsCategoryBtn, #dedupeBtn, #saveBookmarksBtn, #restoreBookmarksBtn, #removeGroupsBtn').forEach(btn => btn.style.display = 'none');
      bookmarkSelector.style.display = 'block';

      // Populate folder select
      folderSelect.innerHTML = '';
      response.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder.id;
        option.textContent = folder.title;
        folderSelect.appendChild(option);
      });
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    restoreBookmarksBtn.disabled = false;
    restoreBookmarksBtn.textContent = 'Restore from Bookmarks';
  }
});

restoreSelectedBtn.addEventListener('click', async () => {
  const selectedFolderId = folderSelect.value;
  if (!selectedFolderId) {
    showStatus('Please select a folder', 'error');
    return;
  }

  restoreSelectedBtn.disabled = true;
  restoreSelectedBtn.textContent = 'Restoring...';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'restoreFromBookmarks',
      folderId: selectedFolderId
    });

    if (response.error) {
      showStatus(`Error: ${response.error}`, 'error');
    } else {
      let message = `✓ Restored ${response.totalRestored} tabs!`;
      if (response.groupsCreated > 0) {
        message += ` Created ${response.groupsCreated} new groups.`;
      }
      if (response.groupsMerged > 0) {
        message += ` Merged into ${response.groupsMerged} existing groups.`;
      }
      if (response.duplicatesSkipped > 0) {
        message += ` Skipped ${response.duplicatesSkipped} duplicates.`;
      }
      showStatus(message, 'success');

      // Hide selector, show main buttons
      bookmarkSelector.style.display = 'none';
      document.querySelectorAll('#organizeBtn, #organizeCategoryBtn, #organizeAllWindowsBtn, #organizeAllWindowsCategoryBtn, #dedupeBtn, #saveBookmarksBtn, #restoreBookmarksBtn, #removeGroupsBtn').forEach(btn => btn.style.display = 'block');
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    restoreSelectedBtn.disabled = false;
    restoreSelectedBtn.textContent = 'Restore';
  }
});

cancelSelectBtn.addEventListener('click', () => {
  bookmarkSelector.style.display = 'none';
  document.querySelectorAll('#organizeBtn, #organizeCategoryBtn, #organizeAllWindowsBtn, #organizeAllWindowsCategoryBtn, #dedupeBtn, #saveBookmarksBtn, #restoreBookmarksBtn, #removeGroupsBtn').forEach(btn => btn.style.display = 'block');
});

removeGroupsBtn.addEventListener('click', async () => {
  removeGroupsBtn.disabled = true;
  removeGroupsBtn.textContent = 'Removing...';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'removeGroups'
    });

    if (response.error) {
      showStatus(`Error: ${response.error}`, 'error');
    } else {
      showStatus('✓ All groups removed!', 'success');
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    removeGroupsBtn.disabled = false;
    removeGroupsBtn.textContent = 'Remove All Groups';
  }
});
