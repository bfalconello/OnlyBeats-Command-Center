# OnlyBeats v1.0 Release Candidate 4

## Fixed

- Replaced the RC3 smoke test that referenced the nonexistent `renderCurrentPage()` function.
- Removed the resulting false-positive report that every page needed attention.
- Added corrected validation for every registered route and its actual renderer.
- Made the left sidebar independently scrollable.
- Kept the brand and footer fixed while navigation tabs scroll.
- Added a thin themed scrollbar.
- Automatically keeps the active tab visible.
- Improved navigation spacing for shorter windows.

## Regression checklist

- App launches.
- The left navigation scrolls with the mouse wheel or touchpad.
- The main page can scroll separately from the sidebar.
- The active tab remains visible after navigation.
- Corrected RC4 checks pass in Settings.
- Prediction Center still supports Winner, Spread, and Over/Under.
- Backup, recovery, diagnostics, and refresh controls remain available.
