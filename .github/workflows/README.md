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
   - Go to: https://github.com/malston/chrome-tabs/releases
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

## Adding More Workflows

To add additional workflows (like CI/CD, linting, etc.), create new `.yml` files in this directory.

Common workflow ideas:
- `ci.yml` - Run tests on pull requests
- `lint.yml` - Run linting on pushes
- `deploy.yml` - Deploy to Chrome Web Store
