# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2025-12-06

### Added

- CI: Claude Code Review workflow - Automated code review for pull requests
- CI: Claude PR Assistant workflow - Automated PR assistance

### Changed

- UI: Improved popup UX with section headers and compact design (#56) - Better organization with Organize, Manage Groups, and Settings sections; shorter, clearer button labels, contributed by @AmberAlston
- UI: Resized options page for better usability

### Fixed

- Protected group folders now included in Restore from Bookmarks (#52) - Protected groups are properly restored from bookmarks, contributed by @AmberAlston
- Error handling and tracking consistency to protected folder restore - Improved reliability when restoring protected groups
- CI workflow now only runs for same-repo PRs (not forks) - Prevents workflow failures on external contributions

### Documentation

- Updated README with new features and screenshots (#49)
- Added merge duplicate groups design documentation

## [1.4.0] - 2025-11-30

### Added

- Multi-select for Protect Groups (#46) - Select multiple tab groups to protect at once using Cmd/Ctrl+click, contributed by @AmberAlston
- New layered tabs icon design (#47) - Fresh icon with three overlapping tabs in Chrome's tab group colors (yellow, green, blue), contributed by @AmberAlston
- Icon generation script - SVG source file and script to regenerate PNG icons at all sizes

## [1.3.0] - 2025-11-29

### Added

- Protect Group feature (#40) - Mark tab groups as protected to prevent accidental closure during cleanup; protected groups are automatically saved to bookmarks for easy recovery
- Multi-select for group combination (#39) - Select multiple groups to combine, contributed by @AmberAlston

### Changed

- CI now enforces 80% code coverage threshold
- Test coverage improved to 91%

### Fixed

- Auto-select first target option in Combine Groups for better UX
- Handle missing "Other Bookmarks" folder in CI environment

## [1.2.0] - 2025-11-29

### Added

- Combine tab groups (#35) - Select two tab groups to merge them into one with visual selection highlighting

### Fixed

- Error state handling in group selection UI

## [1.1.0] - 2025-11-29

### Added

- User-defined categories for tab organization (#30) - Users can now create custom categories in the options page to organize tabs by their own criteria
- Dark mode support - Extension popup now respects system dark mode preferences
- Unit tests for background.js and options.js - Improved test coverage from 61% to 84%

### Changed

- Enhanced README with improved Tab Manager description

### Fixed

- Removed outdated implementation notes from documentation

### Documentation

- Added ISC license file and fixed license references throughout the project

## [1.0.1] - 2025-11-20

### Fixed

- Initial bug fixes and stability improvements

## [1.0.0] - 2025-11-15

### Added

- One-click tab organization by domain
- One-click tab organization by category
- Duplicate tab removal
- Save tabs to bookmarks
- Restore tabs from bookmarks
- Smart tab group coloring
- Tab count display per group
- Options page for extension settings
