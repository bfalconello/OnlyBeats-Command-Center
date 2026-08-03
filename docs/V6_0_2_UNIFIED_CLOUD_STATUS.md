# OnlyBeats v6.0.2 — Unified Cloud Status Hotfix

## Fixed

- Devices & Sync displayed Cloud Backend: Not connected while Firebase
  was connected elsewhere in the application.
- Devices & Sync used outdated v2-era manual-snapshot language.
- Pending changes showed only local snapshot changes instead of the
  active cloud queue.
- Sync readiness did not show the signed-in account, cloud status, or
  conflict policy.

## Unified status

Devices & Sync now reads directly from:

- `cloudSyncState.connected`
- `cloudSyncState.accountEmail`
- `cloudSyncState.status`
- `cloudSyncState.lastSyncAt`
- `cloudSyncState.autoSync`
- `cloudSyncState.conflictPolicy`
- `cloudQueue`

## Automatic update test

v6.0.2 is intentionally a small visible update suitable for validating
the installed updater:

1. Install published v6.0.1.
2. Publish v6.0.2 with installer, blockmap, and latest.yml.
3. Open Updates & Release in installed v6.0.1.
4. Check for updates.
5. Download and restart.
6. Confirm version 6.0.2 and the corrected Devices & Sync page.
