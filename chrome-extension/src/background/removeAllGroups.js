// ABOUTME: Ungroups all grouped tabs in the current window.
// ABOUTME: Tabs remain open but are removed from their groups.

async function removeAllGroups() {
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

export { removeAllGroups };
