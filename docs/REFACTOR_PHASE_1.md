# v0.10 Architecture Refactor — Phase 1

This release changes organization, not product behavior.

## Extracted modules

- `app/modules/config.js`
  - Version
  - Storage keys
  - Default settings
  - Navigation definition
- `app/modules/storage.js`
  - Defensive local-storage loading
  - Settings migration
- `app/modules/ui-core.js`
  - DOM lookup
  - HTML escaping
  - Shared card, metric, and empty-state templates

## Script order

`index.html` must load the files in this order:

1. `modules/config.js`
2. `modules/storage.js`
3. `modules/ui-core.js`
4. `data-platform.js`
5. `app.js`

## Why Phase 1 is intentionally small

The application is currently stable after M2.4.1. This phase extracts only dependency-light code, avoiding a high-risk rewrite of page state or event handling.

## Regression checklist

- App launches
- Every navigation tab opens
- All refresh buttons work
- Prediction Center supports Winner, Spread, and Over/Under
- Futures load
- Schedule filters work
- Team Intelligence works
- Game drawer cross-links work
- Reports and CSV export work
- Settings and dashboard layout persist
