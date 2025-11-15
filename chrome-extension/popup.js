// Popup script for Tab Organizer extension

const organizeBtn = document.getElementById('organizeBtn');
const organizeCategoryBtn = document.getElementById('organizeCategoryBtn');
const dedupeBtn = document.getElementById('dedupeBtn');
const removeGroupsBtn = document.getElementById('removeGroupsBtn');
const statusDiv = document.getElementById('status');

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
      showStatus(
        `✓ Organized ${response.groupedTabs} tabs into ${response.groups} groups!`,
        'success'
      );
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
      showStatus(
        `✓ Organized ${response.groupedTabs} tabs into ${response.groups} categories!`,
        'success'
      );
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  } finally {
    organizeCategoryBtn.disabled = false;
    organizeCategoryBtn.textContent = 'Organize by Category';
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
