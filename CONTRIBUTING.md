# Contributing to Chrome Tab Manager

Thank you for your interest in contributing to Chrome Tab Manager! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Coding Standards](#coding-standards)
- [Adding Features](#adding-features)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/chrome-tabs.git
   cd chrome-tabs
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/ORIGINAL-OWNER/chrome-tabs.git
   ```

## Development Setup

### Chrome Extension Development

1. **Install the extension** in Chrome:
   ```bash
   # Open Chrome and navigate to:
   chrome://extensions/

   # Enable "Developer mode" (toggle in top-right)
   # Click "Load unpacked"
   # Select: chrome-tabs/chrome-extension
   ```

2. **Make changes** to the extension code:
   - `manifest.json` - Extension configuration
   - `background.js` - Core business logic (service worker)
   - `popup.html/js` - Extension UI and event handlers

3. **Reload the extension** after changes:
   - Go to `chrome://extensions/`
   - Click the refresh icon on the Tab Organizer extension

### Python Tools Development

1. **Install dependencies**:
   ```bash
   make install
   ```

2. **Run linting**:
   ```bash
   make lint
   ```

## Project Structure

```
chrome-tabs/
├── chrome-extension/          # Chrome Extension (main tool)
│   ├── manifest.json         # Extension configuration
│   ├── background.js         # Service worker (core logic)
│   ├── popup.html            # Extension UI
│   ├── popup.js              # UI event handlers
│   ├── icon*.png             # Extension icons
│   └── README.md             # Extension documentation
├── restore_from_history.py   # History recovery tool
├── screenshots/              # Screenshots for documentation
├── Makefile                  # Build and development commands
├── pyproject.toml           # Python project configuration
├── README.md                # Main documentation
└── CONTRIBUTING.md          # This file
```

## Making Changes

### Branch Naming Convention

Use descriptive branch names:
- `feature/your-feature-name` - New features
- `fix/bug-description` - Bug fixes
- `docs/documentation-update` - Documentation changes
- `refactor/component-name` - Code refactoring

Example:
```bash
git checkout -b feature/add-dark-mode
```

### Commit Messages

Follow the conventional commit format:

```
<type>: <short description>

<longer description if needed>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Your Name <your.email@example.com>
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

**Examples:**
```bash
git commit -m "feat: Add dark mode toggle to popup UI"
git commit -m "fix: Resolve duplicate detection bug in restore feature"
git commit -m "docs: Update installation instructions"
```

## Testing

### Manual Testing for Chrome Extension

1. **Test all features**:
   - Organize by Domain
   - Organize by Category
   - Remove Duplicates
   - Save to Bookmarks
   - Restore from Bookmarks
   - Remove All Groups

2. **Test edge cases**:
   - Empty tab sets
   - Single tab
   - Chrome internal pages (chrome://)
   - Duplicate URLs
   - Existing tab groups

3. **Check console for errors**:
   - Service worker console: `chrome://extensions/` → "service worker"
   - Popup console: Right-click popup → Inspect

### Testing Python Code

```bash
# Run pylint
make lint

# Test history recovery (requires Chrome with remote debugging)
make restore-history
```

## Submitting Changes

1. **Update your fork**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Push your changes**:
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create a Pull Request**:
   - Go to your fork on GitHub
   - Click "Pull Request"
   - Select your branch
   - Fill in the PR template (if available)
   - Describe your changes clearly

4. **PR Guidelines**:
   - Link related issues
   - Include screenshots for UI changes
   - Update documentation if needed
   - Ensure all tests pass
   - Respond to review feedback

## Coding Standards

### JavaScript (Chrome Extension)

- Use **ES6+ syntax** (async/await, arrow functions, etc.)
- Use **const/let** instead of var
- **2-space indentation**
- **Descriptive variable names**
- **JSDoc comments** for functions
- **Error handling** with try/catch

Example:
```javascript
/**
 * Organizes tabs by domain or category
 * @param {string} mode - 'domain' or 'category'
 * @returns {Object} Result with tab counts
 */
async function organizeTabs(mode = 'domain') {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    // ... implementation
  } catch (error) {
    console.error('Error organizing tabs:', error);
    throw error;
  }
}
```

### Python

- Follow **PEP 8** style guide
- Use **type hints** where applicable
- **Docstrings** for all functions and classes
- **4-space indentation**
- Run **pylint** before committing (`make lint`)

Example:
```python
def create_tab(self, url: str) -> Dict:
    """Create a new tab and navigate it to the given URL"""
    try:
        response = requests.put(create_url, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error creating tab: {e}")
        raise
```

## Adding Features

### Adding a New Extension Feature

1. **Update `background.js`**:
   - Add your function
   - Add message handler in `chrome.runtime.onMessage.addListener()`

2. **Update `popup.html`**:
   - Add UI button or control

3. **Update `popup.js`**:
   - Add event handler
   - Send message to background script

4. **Update documentation**:
   - Add to `chrome-extension/README.md`
   - Add to main `README.md`
   - Update feature list

### Adding a New Category (for Organize by Category)

Edit `background.js`, function `categorizeUrl()`:

```javascript
// Add your category
if (domain.includes('your-pattern') || domain.includes('another-pattern')) {
  return 'Your Category Name';
}
```

### Adding Screenshots

1. Take screenshots showing your feature
2. Save to `screenshots/` directory
3. Add to README with:
   ```markdown
   <img src="screenshots/your-feature.png" alt="Feature Name" width="300">
   ```

## Questions or Issues?

- **Bug reports**: Open an issue with detailed steps to reproduce
- **Feature requests**: Open an issue describing the feature and use case
- **Questions**: Open a discussion or issue

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Chrome Tab Manager! 🎉
