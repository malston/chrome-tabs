# Manual Testing Guide: Smart Group Merging

This document provides step-by-step instructions for manually testing the smart group merging feature (Issue #11) as if presenting to a Product Manager for acceptance.

## Feature Overview

**What Changed:** The "Organize by Domain" feature now intelligently updates existing tab groups instead of destroying and recreating them.

**Benefits:**
- ✅ No duplicate group entries in Chrome's Recently Closed menu
- ✅ Group collapse states are preserved
- ✅ Better performance (only changes what's needed)
- ✅ Cleaner user experience

## Prerequisites

1. Chrome browser with the Tab Organizer extension loaded in developer mode
2. The extension reloaded with latest code (`chrome://extensions/` → Reload)
3. Multiple tabs open across different domains

## Test Scenarios

### Scenario 1: First-Time Organization (Create New Groups)

**Acceptance Criteria:** When organizing tabs for the first time, groups should be created normally.

**Steps:**
1. Open 10-15 tabs across 3-4 different domains (e.g., 5 GitHub tabs, 4 Google tabs, 3 example.com tabs)
2. Ensure no tab groups exist (if they do, click "Remove All Groups" first)
3. Click the Tab Organizer extension icon
4. Click "Organize by Domain"

**Expected Results:**
- ✓ Tabs are grouped by domain (e.g., "github.com (5)", "google.com (4)", "example.com (3)")
- ✓ Tabs within each group are sorted alphabetically
- ✓ Single tabs remain ungrouped
- ✓ Console log shows: "Created new group: [domain] ([count] tabs)"

**Verification:**
- Open Chrome DevTools → Console tab for the extension's service worker
- Check logs confirm groups were created (not updated)

---

### Scenario 2: Re-Organization (Update Existing Groups)

**Acceptance Criteria:** When organizing tabs again, existing groups should be updated (not recreated).

**Steps:**
1. Starting from Scenario 1 (with groups already created)
2. Open 2-3 new GitHub tabs
3. Close 1 Google tab
4. Click "Organize by Domain" again

**Expected Results:**
- ✓ GitHub group updates to show new count: "github.com (7)" or (8)
- ✓ Google group updates to show new count: "google.com (3)"
- ✓ Groups are NOT destroyed and recreated
- ✓ Console log shows: "Updated group: github.com (+2 -0 tabs, total: 7)"
- ✓ **CRITICAL:** Chrome's groups menu (click groups icon in toolbar) does NOT show duplicate entries

**Verification:**
1. Click the Chrome tab groups icon in the toolbar (looks like a folder/chip)
2. Check "Recently closed" section
3. **PASS:** You should NOT see old "github.com (5)" entries
4. **FAIL:** If you see multiple entries for the same domain, the feature is not working

---

### Scenario 3: Group State Preservation (Collapsed Groups)

**Acceptance Criteria:** Collapsed groups should remain collapsed after re-organization.

**Steps:**
1. Starting from Scenario 2 (with groups already existing)
2. Collapse the GitHub group (click the group name/color bar to collapse it)
3. Open 2 new GitHub tabs
4. Click "Organize by Domain"

**Expected Results:**
- ✓ GitHub group remains collapsed
- ✓ New tabs are added to the collapsed group
- ✓ Tab count updates: "github.com (9)" or similar
- ✓ Group color is preserved

**Verification:**
- The collapsed state should be maintained
- Only the tab count in the title should change

---

### Scenario 4: Tab Movement Between Groups (Add/Remove)

**Acceptance Criteria:** Tabs should move between groups intelligently.

**Steps:**
1. Starting with a GitHub group (3+ tabs) and a Google group (2+ tabs)
2. Navigate one GitHub tab to google.com (change the URL)
3. Click "Organize by Domain"

**Expected Results:**
- ✓ The tab moves from GitHub group to Google group
- ✓ GitHub count decreases by 1
- ✓ Google count increases by 1
- ✓ Console shows: "Updated group: github.com (+0 -1 tabs, total: X)"
- ✓ Console shows: "Updated group: google.com (+1 -0 tabs, total: Y)"

**Verification:**
- Check both groups reflect the correct tab counts
- No duplicates in Recently Closed menu

---

### Scenario 5: Single Tabs (Ungrouping)

**Acceptance Criteria:** If a domain drops to 1 tab, it should be ungrouped.

**Steps:**
1. Starting with a grouped domain that has 2 tabs (e.g., "example.com (2)")
2. Close one of those tabs
3. Click "Organize by Domain"

**Expected Results:**
- ✓ The remaining tab is ungrouped (groups require 2+ tabs)
- ✓ The "example.com" group disappears
- ✓ No empty groups remain

**Verification:**
- The single tab should appear ungrouped in the tab bar

---

### Scenario 6: Mixed Create and Update

**Acceptance Criteria:** Can create new groups and update existing groups in the same operation.

**Steps:**
1. Starting with GitHub and Google groups already created
2. Open 3-4 new stackoverflow.com tabs (new domain)
3. Open 2 more GitHub tabs
4. Click "Organize by Domain"

**Expected Results:**
- ✓ GitHub group updated: "github.com (X)" with increased count
- ✓ New stackoverflow group created: "stackoverflow.com (3)"
- ✓ Console shows both: "Updated group: github.com..." and "Created new group: stackoverflow.com..."

---

### Scenario 7: The Original Issue (No Duplicate History)

**Acceptance Criteria:** Multiple "Organize" operations should not create duplicate closed group entries.

**Steps:**
1. Clear Chrome's Recently Closed groups menu first:
   - Settings → Privacy and Security → Clear browsing data → Browsing history
2. Open tabs across multiple domains
3. Click "Organize by Domain"
4. Add/remove a few tabs
5. Click "Organize by Domain" again
6. Add/remove more tabs
7. Click "Organize by Domain" a third time

**Expected Results:**
- ✓ Click Chrome's tab groups icon (toolbar)
- ✓ Look at "Recently closed" section
- ✓ **PASS:** Should see NO duplicate group entries (or at most, groups from manual closures)
- ✓ **FAIL:** If you see multiple "github.com (X)" entries with different counts, this is the old buggy behavior

**This is the PRIMARY acceptance criterion for this feature!**

---

### Scenario 8: Base Domain Grouping (Bonus Test)

**Acceptance Criteria:** Subdomains should group together by base domain.

**Steps:**
1. Open tabs for:
   - vcsa.markalston.net
   - opsman.lab.markalston.net
   - minio.lab.markalston.net
   - concourse.lab.markalston.net
2. Click "Organize by Domain"

**Expected Results:**
- ✓ All tabs grouped under "markalston.net (4)"
- ✓ Not separate groups for each subdomain

---

## Edge Cases to Test

### Edge Case 1: Empty Tab Set
- Start with no tabs, click "Organize by Domain"
- Should complete without errors

### Edge Case 2: All Single Tabs
- Open 5 tabs, all from different domains
- Should create no groups (all remain ungrouped)

### Edge Case 3: Chrome Internal Pages
- Mix chrome:// pages with regular pages
- chrome:// pages should be skipped

---

## Performance Verification

**For large tab sets (50+ tabs):**
1. Open 50+ tabs across 10+ domains
2. Time the "Organize by Domain" operation
3. Add a few tabs
4. Time the second "Organize by Domain"

**Expected:**
- Second operation should be FASTER than first (only updating, not recreating all groups)

---

## Console Log Verification

**Good logs (smart merge working):**
```
Organizing tabs by domain...
Updated group: github.com (+2 -0 tabs, total: 10)
Updated group: google.com (+0 -1 tabs, total: 5)
Created new group: stackoverflow.com (4 tabs)
```

**Bad logs (old behavior):**
```
Organizing tabs by domain...
Grouped 10 tabs for github.com (sorted alphabetically)
Grouped 5 tabs for google.com (sorted alphabetically)
```

---

## Acceptance Checklist

For Product Manager sign-off, verify:

- [ ] **Primary Goal:** No duplicate group entries in Chrome's Recently Closed menu after multiple "Organize" operations
- [ ] Collapsed groups remain collapsed
- [ ] Group colors are preserved
- [ ] Tabs move between groups correctly
- [ ] New groups are still created when needed
- [ ] Single tabs are correctly ungrouped
- [ ] Performance is equal or better than before
- [ ] All 285 automated tests pass
- [ ] No browser console errors
- [ ] Feature works across Chrome restart

---

## Known Limitations

1. **Manually created groups:** If a user manually creates a group named "github.com", the extension may merge with it
2. **Partial grouping:** If organization is interrupted (browser crash), groups may be in partial state
3. **Group names:** Relies on the " (count)" suffix pattern to identify groups

---

## Rollback Plan

If issues are found:
1. Revert to `main` branch
2. Reload extension
3. Old behavior (destroy and recreate) will resume

---

## Success Metrics

**Before this feature:**
- Chrome Groups menu accumulates 10+ duplicate entries after 5 "Organize" operations
- Users complain about clutter

**After this feature:**
- Chrome Groups menu shows current state only (0-1 closed entries per domain)
- Groups preserve state across reorganizations
- Cleaner, more professional user experience

---

*Generated as part of Issue #11 implementation*
