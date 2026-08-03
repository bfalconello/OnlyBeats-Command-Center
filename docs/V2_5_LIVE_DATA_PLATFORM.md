# OnlyBeats v2.5 — Live Data Platform, Phase 1

## Added

- Dedicated Live Data Platform page
- Provider registry
- Supported feed adapters:
  - Scores and schedule
  - Rankings
  - Weather
  - Player availability
  - Licensed market data
- Automatic refresh scheduler
- Manual per-feed and all-feed refresh
- Pause and resume controls
- Feed health and error reporting
- Provider activity history
- Record normalization and validation
- Provider configuration template
- Licensed-feed declaration
- Preservation of manual availability notes

## Honest capability boundary

No external feed is connected by default. A feed becomes active only when an authorized provider adapter is configured in `live-data-providers.js`.

The application does not invent missing rankings, injuries, lines, weather, scores, or schedules. Disconnected feeds remain visibly marked as unavailable.

## Regression checklist

- Live Data Platform appears in the sidebar
- All feeds show Not configured before adapters are added
- Refresh controls remain disabled for disconnected feeds
- Automatic refresh setting persists
- Pause and resume work
- Provider activity can be cleared
- Manual availability notes remain intact
- Existing desktop, PWA, cloud, GameDay, predictions, and production checks still work
