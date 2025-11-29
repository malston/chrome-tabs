// ABOUTME: Options page controller for category management.
// ABOUTME: Handles category CRUD, import/export, and UI interactions.

let categories = [];
let editingCategoryId = null;

// DOM Elements
const categoryList = document.getElementById('categoryList');
const statusDiv = document.getElementById('status');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const importBtn = document.getElementById('importBtn');
const exportBtn = document.getElementById('exportBtn');
const resetBtn = document.getElementById('resetBtn');
const importFileInput = document.getElementById('importFileInput');
const categoryModal = document.getElementById('categoryModal');
const modalTitle = document.getElementById('modalTitle');
const categoryNameInput = document.getElementById('categoryName');
const categoryPatternsInput = document.getElementById('categoryPatterns');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const saveModalBtn = document.getElementById('saveModalBtn');

/**
 * Shows a status message that auto-hides after 3 seconds.
 */
function showStatus(message, type = 'success') {
  statusDiv.textContent = message;
  statusDiv.className = `status show ${type}`;

  setTimeout(() => {
    statusDiv.classList.remove('show');
  }, 3000);
}

/**
 * Generates a unique ID for a new category.
 */
function generateId() {
  return 'cat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

/**
 * Loads categories from the background script.
 */
async function loadCategories() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getCategories' });
    if (response.error) {
      showStatus('Error loading categories: ' + response.error, 'error');
      return;
    }
    categories = response;
    renderCategories();
  } catch (error) {
    showStatus('Error loading categories: ' + error.message, 'error');
  }
}

/**
 * Saves categories to the background script.
 */
async function saveCategories() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'saveCategories',
      categories: categories
    });
    if (response.error) {
      showStatus('Error saving categories: ' + response.error, 'error');
      return false;
    }
    showStatus('Categories saved successfully!', 'success');
    return true;
  } catch (error) {
    showStatus('Error saving categories: ' + error.message, 'error');
    return false;
  }
}

/**
 * Renders the category list.
 */
function renderCategories() {
  categoryList.innerHTML = '';

  if (categories.length === 0) {
    categoryList.innerHTML = '<p>No categories defined. Click "Add Category" to create one.</p>';
    return;
  }

  categories.forEach((category) => {
    const card = document.createElement('div');
    card.className = `category-card${category.enabled ? '' : ' disabled'}`;
    card.dataset.id = category.id;

    const patternsPreview = category.patterns.slice(0, 5).map(p => `<code>${escapeHtml(p)}</code>`).join(' ');
    const morePatterns = category.patterns.length > 5 ? ` <code>+${category.patterns.length - 5} more</code>` : '';

    card.innerHTML = `
      <div class="category-header">
        <h3>${escapeHtml(category.name)}</h3>
        <div class="category-controls">
          <label class="toggle-label">
            <input type="checkbox" ${category.enabled ? 'checked' : ''} data-action="toggle" data-id="${category.id}">
            Enabled
          </label>
        </div>
      </div>
      <div class="category-patterns">
        ${patternsPreview}${morePatterns}
      </div>
      <div class="category-actions">
        <button class="secondary" data-action="edit" data-id="${category.id}">Edit</button>
        <button class="danger" data-action="delete" data-id="${category.id}">Delete</button>
      </div>
    `;

    categoryList.appendChild(card);
  });
}

/**
 * Escapes HTML to prevent XSS.
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Opens the modal for adding a new category.
 */
function openAddModal() {
  editingCategoryId = null;
  modalTitle.textContent = 'Add Category';
  categoryNameInput.value = '';
  categoryPatternsInput.value = '';
  categoryModal.classList.add('show');
  categoryNameInput.focus();
}

/**
 * Opens the modal for editing an existing category.
 */
function openEditModal(categoryId) {
  const category = categories.find(c => c.id === categoryId);
  if (!category) return;

  editingCategoryId = categoryId;
  modalTitle.textContent = 'Edit Category';
  categoryNameInput.value = category.name;
  categoryPatternsInput.value = category.patterns.join('\n');
  categoryModal.classList.add('show');
  categoryNameInput.focus();
}

/**
 * Closes the modal.
 */
function closeModal() {
  categoryModal.classList.remove('show');
  editingCategoryId = null;
}

/**
 * Validates and saves the category from the modal.
 */
async function saveFromModal() {
  const name = categoryNameInput.value.trim();
  const patternsText = categoryPatternsInput.value.trim();

  // Validation
  if (!name) {
    showStatus('Category name is required', 'error');
    return;
  }

  if (!patternsText) {
    showStatus('At least one pattern is required', 'error');
    return;
  }

  const patterns = patternsText
    .split('\n')
    .map(p => p.trim())
    .filter(p => p.length > 0);

  if (patterns.length === 0) {
    showStatus('At least one pattern is required', 'error');
    return;
  }

  if (editingCategoryId) {
    // Update existing category
    const index = categories.findIndex(c => c.id === editingCategoryId);
    if (index !== -1) {
      categories[index].name = name;
      categories[index].patterns = patterns;
    }
  } else {
    // Add new category
    categories.push({
      id: generateId(),
      name: name,
      patterns: patterns,
      enabled: true
    });
  }

  const saved = await saveCategories();
  if (saved) {
    closeModal();
    renderCategories();
  }
}

/**
 * Toggles a category's enabled state.
 */
async function toggleCategory(categoryId) {
  const category = categories.find(c => c.id === categoryId);
  if (!category) return;

  category.enabled = !category.enabled;
  const saved = await saveCategories();
  if (saved) {
    renderCategories();
  } else {
    // Revert change on failure
    category.enabled = !category.enabled;
  }
}

/**
 * Deletes a category after confirmation.
 */
async function deleteCategory(categoryId) {
  const category = categories.find(c => c.id === categoryId);
  if (!category) return;

  if (!confirm(`Delete category "${category.name}"? This cannot be undone.`)) {
    return;
  }

  const originalCategories = [...categories];
  categories = categories.filter(c => c.id !== categoryId);
  const saved = await saveCategories();
  if (saved) {
    renderCategories();
  } else {
    // Revert on failure
    categories = originalCategories;
  }
}

/**
 * Exports categories to a JSON file.
 */
function exportCategories() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: categories
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `tab-organizer-categories-${Date.now()}.json`;
  a.click();

  URL.revokeObjectURL(url);
  showStatus('Categories exported successfully!', 'success');
}

/**
 * Imports categories from a JSON file.
 */
async function importCategories(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // Validate format
    if (!data.categories || !Array.isArray(data.categories)) {
      throw new Error('Invalid file format: missing categories array');
    }

    // Validate each category
    for (const cat of data.categories) {
      if (!cat.name || !Array.isArray(cat.patterns) || cat.patterns.length === 0) {
        throw new Error(`Invalid category: ${cat.name || 'unnamed'}`);
      }
    }

    // Confirm replacement
    if (!confirm(`Replace all categories with ${data.categories.length} imported categories?`)) {
      return;
    }

    // Ensure each category has required fields
    categories = data.categories.map(cat => ({
      id: cat.id || generateId(),
      name: cat.name,
      patterns: cat.patterns,
      enabled: cat.enabled !== false
    }));

    const saved = await saveCategories();
    if (saved) {
      renderCategories();
      showStatus(`Imported ${categories.length} categories successfully!`, 'success');
    }
  } catch (error) {
    showStatus('Import failed: ' + error.message, 'error');
  }
}

/**
 * Resets categories to defaults.
 */
async function resetToDefaults() {
  if (!confirm('Reset all categories to defaults? Your custom categories will be lost.')) {
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({ action: 'resetCategories' });
    if (response.error) {
      showStatus('Error resetting categories: ' + response.error, 'error');
      return;
    }
    categories = response.categories;
    renderCategories();
    showStatus('Categories reset to defaults!', 'success');
  } catch (error) {
    showStatus('Error resetting categories: ' + error.message, 'error');
  }
}

// Event Listeners
addCategoryBtn.addEventListener('click', openAddModal);

importBtn.addEventListener('click', () => {
  importFileInput.click();
});

importFileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    importCategories(file);
    importFileInput.value = ''; // Reset for next import
  }
});

exportBtn.addEventListener('click', exportCategories);

resetBtn.addEventListener('click', resetToDefaults);

cancelModalBtn.addEventListener('click', closeModal);

saveModalBtn.addEventListener('click', saveFromModal);

// Close modal on overlay click
categoryModal.addEventListener('click', (e) => {
  if (e.target === categoryModal) {
    closeModal();
  }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && categoryModal.classList.contains('show')) {
    closeModal();
  }
});

// Handle category list actions (event delegation)
categoryList.addEventListener('click', (e) => {
  const action = e.target.dataset.action;
  const id = e.target.dataset.id;

  if (action === 'edit') {
    openEditModal(id);
  } else if (action === 'delete') {
    deleteCategory(id);
  }
});

categoryList.addEventListener('change', (e) => {
  if (e.target.dataset.action === 'toggle') {
    toggleCategory(e.target.dataset.id);
  }
});

// Initialize
loadCategories();
