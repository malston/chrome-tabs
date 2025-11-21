# GitHub Workflows

This directory contains GitHub Actions workflows for automating releases and other tasks.

## Release Workflow

**File:** `release.yml`

### What It Does

Automatically creates a draft GitHub release with:

- Extension zip file ready for download
- Comprehensive release notes
- Version information
- Installation instructions
- Links to documentation

### How to Use

1. **Update the version** in `chrome-extension/manifest.json`:

   ```json
   "version": "1.1.0"
   ```

2. **Commit your changes**:

   ```bash
   git add .
   git commit -m "Release v1.1.0"
   ```

3. **Create and push a version tag**:

   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```

4. **Wait for the workflow** to complete (check the Actions tab on GitHub)

5. **Review and publish** the draft release:
   - Go to: <https://github.com/malston/chrome-tabs/releases>
   - Find your draft release
   - Review the release notes
   - Click "Publish release" when ready

### Tag Format

Tags must follow semantic versioning: `vMAJOR.MINOR.PATCH`

Examples:

- `v1.0.0` - Initial release
- `v1.1.0` - Minor update (new features)
- `v1.0.1` - Patch (bug fixes)
- `v2.0.0` - Major update (breaking changes)

### Manual Release (Alternative)

You can also create releases manually using the GitHub CLI:

```bash
# Create a tag
git tag v1.1.0
git push origin v1.1.0

# Or use the workflow, which will automatically:
# 1. Create the extension zip
# 2. Generate release notes
# 3. Create a draft release
# 4. Upload the zip file
```

### Troubleshooting

**Workflow doesn't trigger:**

- Ensure you pushed the tag: `git push origin v1.1.0`
- Check that the tag matches the pattern `v*.*.*`
- Verify in the Actions tab on GitHub

**Release fails:**

- Check the Actions tab for error logs
- Ensure `manifest.json` has a valid version
- Verify repository permissions allow release creation

**Want to delete a tag:**

```bash
git tag -d v1.1.0                    # Delete locally
git push origin --delete v1.1.0      # Delete remotely
```

## CI Workflow

**File:** `ci.yml`

### What It Does

Automatically runs tests and validation on every pull request and push to `main` or `develop`:

1. **Chrome Extension Tests**
   - Runs Jest unit tests
   - Generates code coverage reports
   - Uploads coverage to Codecov (optional)

2. **Python Tests and Linting**
   - Runs Pylint on Python code
   - Checks Python formatting with black

3. **Manifest Validation**
   - Validates manifest.json syntax
   - Ensures Manifest V3 compliance
   - Checks required fields

4. **Extension Package Build**
   - Creates extension zip file
   - Verifies package integrity
   - Uploads artifact for download

### Viewing CI Results

1. **On Pull Requests:**
   - CI checks appear at the bottom of the PR
   - All checks must pass before merging
   - Click "Details" to see logs

2. **On the Actions Tab:**
   - Go to: <https://github.com/malston/chrome-tabs/actions>
   - Click on a workflow run to see details
   - Download build artifacts from successful runs

### Running Locally

Before pushing, you can run the same checks locally:

```bash
# Run extension tests
cd chrome-extension && npm test

# Run Python linting
make lint

# Validate manifest
python3 -m json.tool chrome-extension/manifest.json

# Build extension package
cd chrome-extension && zip -r ../chrome-tab-manager.zip . -x "*.test.js" -x "node_modules/*"
```

### Troubleshooting CI Failures

**Extension tests fail:**

- Run `make test` locally to reproduce
- Check test output for specific failures
- Ensure all dependencies are installed

**Python linting fails:**

- Run `make lint` locally
- Fix pylint warnings and errors
- Consider adding `# pylint: disable=<rule>` for false positives

**Manifest validation fails:**

- Ensure manifest.json is valid JSON
- Check that manifest_version is 3
- Verify required fields are present

**Build fails:**

- Check that all required files exist
- Ensure no syntax errors in source files
- Verify package.json has correct dependencies

---

## Adding More Workflows

To add additional workflows, create new `.yml` files in this directory.

Common workflow ideas:

- `deploy.yml` - Deploy to Chrome Web Store
- `security.yml` - Run security scanning (Dependabot, CodeQL)
