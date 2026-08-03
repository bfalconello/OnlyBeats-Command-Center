# OnlyBeats v1.6.1 — Professional Desktop Experience

## Added

- About & Storage page
- Notification Manager with:
  - Enabled
  - Permission required
  - Blocked
  - Unsupported
- In-app alert fallback when desktop notifications are unavailable
- Test notification control
- Unified `.onlybeats` export bundle
- Validated `.onlybeats` restore
- Local storage usage report
- Application and provider status summary
- Startup-time display
- Remembered last page
- Remembered sidebar and main-content scroll positions
- Stronger production-status workflow

## Unchanged

- Predictions and scoring
- Futures
- Live provider endpoints
- Analytics
- Archives
- Alerts
- Mission Control layouts

## Regression checklist

- About & Storage appears in the sidebar
- Notification status is accurate
- Test Notification works
- In-app fallback works when notifications are blocked
- `.onlybeats` export downloads
- `.onlybeats` restore reloads saved data
- Storage usage appears
- Last page and scroll positions persist
- Production checks still pass
