# OnlyBeats v2.9 — Live Command Center

## Added

- Dedicated Live Command Center page
- Live, upcoming, and final game wall
- Saved-prediction status tracking
- Close-game alerts
- Fourth-quarter alerts
- Upset Watch alerts
- Weather-impact alerts
- Top 25 rankings panel
- Favorite-team-only filter
- Compact card mode
- Full-screen Command Mode
- Configurable refresh interval
- Provider-readiness panel
- Manual and automatic refresh controls

## Data boundary

OnlyBeats displays live provider data only when a feed is configured. Missing rankings, weather, availability, or live game feeds remain clearly marked as unavailable.

## Installer

Expected output:

`dist/OnlyBeats-Setup-2.9.0.exe`

## Regression checklist

- Live Command Center appears in the sidebar
- Live, upcoming, and final filters work
- Prediction statuses display
- Close-game and upset alerts generate
- Weather alerts only use provider data
- Rankings panel shows feed-unavailable state when disconnected
- Full-screen Command Mode works
- Prediction Lab and Combo Maker still load
- Installer workflows remain green
- Production checks pass
