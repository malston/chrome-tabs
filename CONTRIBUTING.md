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

2. **Install development dependencies**:

   ```bash
   make setup
   ```

3. **Install Git hooks** (recommended):

   ```bash
   ./scripts/install-hooks.sh
   ```

   This installs a pre-commit hook that automatically:
   - Runs Jest tests for changed JavaScript files
   - Validates manifest.json if changed

4. **Make changes** to the extension code:
   - `manifest.json` - Extension configuration
   - `background.js` - Core business logic (service worker)
   - `popup.html/js` - Extension UI and event handlers

5. **Reload the extension** after changes:
   - Go to `chrome://extensions/`
   - Click the refresh icon on the Tab Organizer extension

## Project Structure

```
chrome-tabs/
├── chrome-extension/          # Chrome Extension
│   ├── manifest.json         # Extension configuration
│   ├── background.js         # Service worker (message router)
│   ├── src/
│   │   ├── background/       # Feature modules
│   │   ├── popup/            # Extension UI
│   │   └── utils/            # Shared utilities
│   ├── icon*.png             # Extension icons
│   └── README.md             # Extension documentation
├── screenshots/              # Screenshots for documentation
├── Makefile                  # Development commands
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

### Automated Testing (CI)

All pull requests automatically run through our CI pipeline which includes:

1. **Jest unit tests** for the Chrome Extension
2. **Puppeteer E2E tests** for end-to-end testing
3. **Manifest validation** to ensure extension compliance
4. **Build verification** to ensure the extension packages correctly

**Running tests locally before pushing:**

```bash
# Install dependencies
make setup

# Run extension unit tests
make test

# Run E2E tests
make test-e2e-headless

# Validate manifest
python3 -m json.tool chrome-extension/manifest.json
```

**View CI results:**
- CI checks appear automatically on your PR
- All checks must pass before merging
- Click "Details" on any check to see logs
- See [.github/workflows/README.md](.github/workflows/README.md) for details

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

### Writing Unit Tests

When adding new functionality, include unit tests:

```javascript
// In chrome-extension/background.test.js
describe('Your Feature', () => {
  test('should do something specific', () => {
    const result = yourFunction(input);
    expect(result).toBe(expectedOutput);
  });
});
```

Run your tests:
```bash
cd chrome-extension
npm test
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
   - Ensure all tests pass (CI will check automatically)
   - Respond to review feedback

### Automated Code Review Workflow

This repository uses [Claude Code](https://claude.com/claude-code) for automated code reviews on pull requests.

**Important Note for External Contributors:**

Due to GitHub's security model, automated workflows cannot access secrets or authentication tokens for pull requests from forked repositories. This means:

- ✅ **PRs from branches in `malston/chrome-tabs`** will receive automated Claude code reviews
- ❌ **PRs from forked repositories** will not trigger the automated review workflow

**If you're contributing from a fork:**

Your PR will still be reviewed manually by maintainers. The automated Claude review is a convenience feature but not required for contributions to be accepted.

If you'd like automated review on your PR, a maintainer can:
1. Fetch your branch from your fork
2. Push it to the main repository
3. Create a new PR from the main repository branch

This limitation exists to protect repository secrets and is a standard security practice for GitHub Actions workflows.

### Skipping Pre-commit Hooks

If you need to commit without running hooks (not recommended):

```bash
git commit --no-verify -m "your message"
```

Use this sparingly - the hooks exist to catch issues early!

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

By contributing, you agree that your contributions will be licensed under the ISC License.

---

Thank you for contributing to Chrome Tab Manager! 🎉
