# v0.10 Architecture Refactor — Phase 2

This phase preserves behavior and extracts navigation and refresh-interface responsibilities.

## New modules

- `app/modules/navigation.js`
  - Sidebar rendering
  - Navigation
  - Page headings
  - Drawer, Focus Mode, notifications, and command-palette cleanup

- `app/modules/refresh-ui.js`
  - Request timeout wrapper
  - Visible refresh-button states
  - Refresh action routing
  - Automatic refresh scheduling
  - Permanent delegated refresh click listener

The provider-specific `syncScores()` implementation remains in `app.js` to avoid changing the proven data flow.

## Script order

1. `modules/config.js`
2. `modules/storage.js`
3. `modules/ui-core.js`
4. `modules/navigation.js`
5. `modules/refresh-ui.js`
6. `data-platform.js`
7. `app.js`
