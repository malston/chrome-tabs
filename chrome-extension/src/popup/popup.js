// ABOUTME: Popup UI for Tab Organizer extension.
// ABOUTME: Handles button interactions and communicates with background service worker.

const organizeBtn = document.getElementById('organizeBtn');
const organizeCategoryBtn = document.getElementById('organizeCategoryBtn');
const organizeAllWindowsBtn = document.getElementById('organizeAllWindowsBtn');
const organizeAllWindowsCategoryBtn = document.getElementById('organizeAllWindowsCategoryBtn');
const dedupeBtn = document.getElementById('dedupeBtn');
const saveBookmarksBtn = document.getElementById('saveBookmarksBtn');
const restoreBookmarksBtn = document.getElementById('restoreBookmarksBtn');
const removeGroupsBtn = document.getElementById('removeGroupsBtn');
const combineGroupsBtn = document.getElementById('combineGroupsBtn');
const statusDiv = document.getElementById('status');
const bookmarkSelector = document.getElementById('bookmarkSelector');
const folderSelect = document.getElementById('folderSelect');
const restoreSelectedBtn = document.getElementById('restoreSelectedBtn');
const cancelSelectBtn = document.getElementById('cancelSelectBtn');
const combineGroupsSelector = document.getElementById('combineGroupsSelector');
const sourceGroupSelect = document.getElementById('sourceGroupSelect');
const targetGroupSelect = document.getElementById('targetGroupSelect');
const combineSelectedBtn = document.getElementById('combineSelectedBtn');
const cancelCombineBtn = document.getElementById('cancelCombineBtn');
const protectGroupBtn = document.getElementById('protectGroupBtn');
const protectGroupSelector = document.getElementById('protectGroupSelector');
const protectGroupSelect = document.getElementById('protectGroupSelect');
const protectSelectedBtn = document.getElementById('protectSelectedBtn');
const cancelProtectBtn = document.getElementById('cancelProtectBtn');
const protectedGroupsList = document.getElementById('protectedGroupsList');
const protectedGroupsContainer = document.getElementById('protectedGroupsContainer');
const closeProtectedListBtn = document.getElementById('closeProtectedListBtn');

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
      if (response.ungroupedTabsMoved > 0) {
        message += ` Moved ${response.ungroupedTabsMoved} ungrouped tab(s) to end.`;
      }
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
      if (response.ungroupedTabsMoved > 0) {
        message += ` Moved ${response.ungroupedTabsMoved} ungrouped tab(s) to end.`;
      }
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
      if (response.ungroupedTabsMoved > 0) {
        message += ` Moved ${response.ungroupedTabsMoved} ungrouped tab(s) to end.`;
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
      if (response.ungroupedTabsMoved > 0) {
        message += ` Moved ${response.ungroupedTabsMoved} ungrouped tab(s) to end.`;
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
      hideMainButtons();
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
      showMainButtons();
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
  showMainButtons();
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

// Combine Groups functionality
const mainButtonsSelector = '#organizeBtn, #organizeCategoryBtn, #organizeAllWindowsBtn, #organizeAllWindowsCategoryBtn, #dedupeBtn, #saveBookmarksBtn, #restoreBookmarksBtn, #combineGroupsBtn, #protectGroupBtn, #removeGroupsBtn';

function hideMainButtons() {
  document.querySelectorAll(mainButtonsSelector).forEach(btn => btn.style.display = 'none');
}

function showMainButtons() {
  document.querySelectorAll(mainButtonsSelector).forEach(btn => btn.style.display = 'block');
}

function getSelectedSourceIds() {
  return Array.from(sourceGroupSelect.selectedOptions).map(opt => parseInt(opt.value));
}

function populateTargetGroupSelect(groups, excludeIds) {
  targetGroupSelect.innerHTML = '';
  const filteredGroups = groups.filter(group => !excludeIds.includes(group.id));
  filteredGroups.forEach((group, index) => {
    const option = document.createElement('option');
    option.value = group.id;
    option.textContent = `${group.baseName} (${group.tabCount})`;
    // Select first option by default since size > 1 listboxes don't auto-select
    if (index === 0) {
      option.selected = true;
    }
    targetGroupSelect.appendChild(option);
  });
}

combineGroupsBtn.addEventListener('click', async () => {
  combineGroupsBtn.disabled = true;
  combineGroupsBtn.textContent = 'Loading...';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getGroups'
    });

    if (response.error) {
      showStatus(`Error: ${response.error}`, 'error');
    } else if (response.length < 2) {
      showStatus('Need at least 2 groups to combine', 'error');
    } else {
      // Hide main buttons, show combine selector
      hideMainButtons();
      combineGroupsSelector.style.display = 'block';

      // Store groups for later use
      combineGroupsSelector.dataset.groups = JSON.stringify(response);

      // Populate source group select
      sourceGroupSelect.innerHTML = '';
      response.forEach(group => {
        const option = document.createElement('option');
        option.value = group.id;
        option.textContent = `${group.baseName} (${group.tabCount})`;
        sourceGroupSelect.appendChild(option);
      });

      // Select first item by default and populate target (excluding selected sources)
      if (sourceGroupSelect.options.length > 0) {
        sourceGroupSelect.options[0].selected = true;
      }
      populateTargetGroupSelect(response, getSelectedSourceIds());
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    combineGroupsBtn.disabled = false;
    combineGroupsBtn.textContent = 'Combine Groups';
  }
});

// Update target dropdown when source selection changes
sourceGroupSelect.addEventListener('change', () => {
  const groups = JSON.parse(combineGroupsSelector.dataset.groups || '[]');
  populateTargetGroupSelect(groups, getSelectedSourceIds());
});

combineSelectedBtn.addEventListener('click', async () => {
  const sourceGroupIds = getSelectedSourceIds();
  const targetGroupId = parseInt(targetGroupSelect.value);

  if (sourceGroupIds.length === 0 || !targetGroupId) {
    showStatus('Please select source group(s) and a target group', 'error');
    return;
  }

  combineSelectedBtn.disabled = true;
  combineSelectedBtn.textContent = 'Combining...';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'combineGroups',
      sourceGroupIds,
      targetGroupId
    });

    if (response.error) {
      showStatus(`Error: ${response.error}`, 'error');
    } else {
      showStatus(
        `✓ Merged ${response.sourceGroupNames.length} group(s) (${response.tabsMoved} tabs) into "${response.targetGroupName}" (now ${response.newTargetTabCount} tabs)`,
        'success'
      );

      // Hide selector, show main buttons
      combineGroupsSelector.style.display = 'none';
      showMainButtons();
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    combineSelectedBtn.disabled = false;
    combineSelectedBtn.textContent = 'Combine';
  }
});

cancelCombineBtn.addEventListener('click', () => {
  combineGroupsSelector.style.display = 'none';
  showMainButtons();
});

// Protect Group functionality
protectGroupBtn.addEventListener('click', async () => {
  protectGroupBtn.disabled = true;
  protectGroupBtn.textContent = 'Loading...';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getGroups'
    });

    if (response.error) {
      showStatus(`Error: ${response.error}`, 'error');
    } else if (response.length === 0) {
      showStatus('No groups to protect', 'error');
    } else {
      // Hide main buttons, show protect selector
      hideMainButtons();
      protectGroupSelector.style.display = 'block';

      // Populate group select
      protectGroupSelect.innerHTML = '';
      response.forEach(group => {
        const option = document.createElement('option');
        option.value = group.id;
        option.textContent = `${group.baseName} (${group.tabCount})`;
        protectGroupSelect.appendChild(option);
      });
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    protectGroupBtn.disabled = false;
    protectGroupBtn.textContent = 'Protect Groups';
  }
});

protectSelectedBtn.addEventListener('click', async () => {
  const selectedOptions = Array.from(protectGroupSelect.selectedOptions);
  const groupIds = selectedOptions.map(opt => parseInt(opt.value));

  if (groupIds.length === 0) {
    showStatus('Please select at least one group', 'error');
    return;
  }

  protectSelectedBtn.disabled = true;
  protectSelectedBtn.textContent = 'Protecting...';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'protectGroups',
      groupIds
    });

    if (response.error) {
      showStatus(`Error: ${response.error}`, 'error');
    } else {
      showStatus(
        `✓ Protected ${response.protectedCount} group(s) (${response.totalTabs} tabs) - saved to bookmarks!`,
        'success'
      );

      // Hide selector, show main buttons
      protectGroupSelector.style.display = 'none';
      showMainButtons();
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    protectSelectedBtn.disabled = false;
    protectSelectedBtn.textContent = 'Protect';
  }
});

cancelProtectBtn.addEventListener('click', () => {
  protectGroupSelector.style.display = 'none';
  showMainButtons();
});

closeProtectedListBtn.addEventListener('click', () => {
  protectedGroupsList.style.display = 'none';
  showMainButtons();
});

// Settings link - open options page
const settingsLink = document.getElementById('settingsLink');
if (settingsLink) {
  settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}
