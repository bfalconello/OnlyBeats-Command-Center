# OnlyBeats v2.0 — Cross-Device Foundation, Phase 1

## Added

- Installable Progressive Web App manifest
- Service-worker offline application shell for hosted HTTPS editions
- Phone-width responsive layout
- Mobile bottom navigation
- Dedicated Devices & Sync page
- Persistent device identity and device name
- Validated device snapshot export/import
- Conflict summary before snapshot replacement
- Install status and offline-shell status
- Sync-readiness dashboard

## Honest capability boundary

This release does not include automatic cloud sync, user accounts, remote push notifications, or background conflict resolution. The current cross-device transfer method is a validated manual snapshot. A real cloud backend can be connected in a later phase without redesigning the local data format.

## Installation requirements

PWA installation and service workers require HTTPS or localhost. The Windows desktop edition continues to run normally in file mode, where service workers are intentionally not registered.

## Regression checklist

- Devices & Sync appears in the sidebar
- Mobile bottom navigation appears at phone width
- PWA manifest loads when hosted
- Service worker registers over HTTPS or localhost
- Desktop file mode remains functional
- Device snapshot export works
- Snapshot import shows a conflict summary
- Device name persists
- Existing desktop pages and production checks still work
