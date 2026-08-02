# API Providers

## Provider rules
- Confirm terms, licensing, and rate limits before production use.
- Never commit private API keys.
- Normalize responses behind internal adapters.
- Cache responsibly and expose the last successful update.
- Preserve last-known data during temporary outages.
- Display unavailable states instead of invented information.

## Current live-score integration
The Rust backend currently requests a public college-football scoreboard endpoint and returns the response to the frontend. This integration is considered provisional and must be reviewed for long-term permitted usage before public distribution.

## Planned categories
| Category | Status | Requirements |
|---|---|---|
| Scores and schedules | Provisional integration | Reliability, permitted usage, normalized game shape |
| Weather | Planned | Stadium coordinates, kickoff-hour forecast, caching, attribution |
| Rankings | Planned | Poll source, publication timing, attribution |
| News | Planned | Licensed feed or permitted RSS/API usage |
| Player availability | Optional | Licensed provider and user-supplied credentials |
| Maps | Planned | Attribution and offline-safe fallback |

## Secrets
Use GitHub Actions secrets for CI credentials and an approved OS-level or encrypted local mechanism for desktop credentials. Never place keys in JavaScript, committed JSON, screenshots, or logs.
