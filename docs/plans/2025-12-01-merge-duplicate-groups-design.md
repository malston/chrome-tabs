# Merge Duplicate Groups Design

## Overview

Add a feature-flagged advanced feature to merge duplicate tab groups. Users with many duplicate groups (e.g., multiple "github.com" groups with different tab counts) can consolidate them automatically.

## Problem

Users accumulate duplicate groups over time:
- Multiple "github.com" groups: (89), (19), (15), (5)
- Multiple "markalston.net" groups: (5), (30), (12), (13), (11)
- Multiple "News & Media" groups with different counts

These clutter the tab bar and defeat the purpose of organization.

## Solution

A merge feature that consolidates groups with the same base name, gated behind an "Advanced Features" toggle.

## Core Algorithm

`mergeDuplicateGroups()` function:

1. Get all tab groups in current window
2. Filter out groups with non-name titles (just numbers, empty, etc.)
3. Group them by base name using `extractGroupBaseName()`
4. For each set of duplicates:
   - Check protected status of each
   - If multiple are protected: skip this set entirely
   - If one is protected: that becomes the target (regardless of size)
   - If none protected: largest becomes target
   - Move all tabs from source groups into target
   - Update target's title with new count

## Settings

Two new storage keys:
- `advancedFeaturesEnabled` (boolean, default: false)
- `autoMergeDuplicates` (boolean, default: false)

## Options Page Changes

Add to options page:

```
[ ] Enable Advanced Features
    [ ] Auto-merge duplicate groups during organize
```

The sub-toggle is visually indented and only visible when the parent is enabled.

## Popup UI Changes

When `advancedFeaturesEnabled` is true, show an "Advanced" section:

```
─────────────────────────
  Advanced
─────────────────────────
[ Merge Duplicate Groups ]
```

Status feedback shows: "Merged X groups into Y groups (Z tabs moved)"

## Organize Integration

When `autoMergeDuplicates` is true, the organize flow becomes:

1. Call `mergeDuplicateGroups()` to consolidate existing duplicates
2. Proceed with normal organize logic (group by domain or category)

Result message optionally mentions merged duplicates: "Organized 45 tabs into 12 groups (merged 3 duplicate groups)"

## Edge Cases

| Case | Behavior |
|------|----------|
| No duplicates found | Show "No duplicate groups to merge" |
| Groups with only numbers/empty names | Skipped |
| Single tab groups that are duplicates | Merged (tab moves to target) |
| All duplicates are protected | Skipped (no error) |
| Mixed protected/unprotected duplicates | Protected one becomes target regardless of size |

## Error Handling

- If Chrome API fails during merge, report which groups failed and continue with others
- If a group disappears mid-operation (user closed it), skip gracefully

## Files to Create/Modify

| File | Change |
|------|--------|
| `src/background/mergeDuplicateGroups.js` | New - core merge logic |
| `src/background/mergeDuplicateGroups.test.js` | New - unit tests |
| `src/background/background.js` | Add message handler |
| `src/background/organizeTabs.js` | Add auto-merge hook when setting enabled |
| `src/options/options.html` | Add advanced features toggles |
| `src/options/options.js` | Add toggle logic and persistence |
| `src/options/options.test.js` | Add tests for new toggles |
| `src/popup/popup.html` | Add advanced section |
| `src/popup/popup.js` | Add conditional display and button handler |
| `src/popup/popup.test.js` | Add tests for advanced section |

## Test Coverage

### Unit Tests for `mergeDuplicateGroups.js`
- Groups with same base name get merged (largest wins)
- Groups with different names stay separate
- Numbered/empty name groups are skipped
- Protected group becomes target even if smaller
- Multiple protected duplicates are skipped entirely
- Tab counts are updated correctly after merge

### Unit Tests for Options
- Advanced features toggle shows/hides sub-toggle
- Settings persist to chrome.storage

### Unit Tests for Popup
- Advanced section hidden when feature disabled
- Advanced section shown when feature enabled
- Button triggers correct message to background

### E2E Tests
- Full flow: enable advanced features, create duplicate groups, merge, verify consolidation
