# OnlyBeats v3.2 — Live NCAA Integration

## Added

- Live NCAA Setup page
- CollegeFootballData-compatible scores adapter
- Current scoreboard mode
- Selected season/week schedule mode
- Rankings adapter
- Flexible response normalization
- Open-Meteo venue weather
- Provider connection test
- Startup feed refresh
- Cache timestamps and venue-coordinate diagnostics
- Clear offline and provider-error handling

## Not included

- Odds or wagering feeds
- Automatic player injury or roster feeds
- Cloud-account synchronization

## Setup

1. Open Live NCAA Setup.
2. Enter a compatible API key.
3. Save settings.
4. Test the connection.
5. Refresh all feeds.

Weather does not require a key, but venue coordinates must first be supplied by the scores feed.

## Installer

Expected output:

`dist/OnlyBeats-Setup-3.2.0.exe`

## Regression checklist

- Live NCAA Setup appears in the sidebar
- Provider settings persist
- Connection testing reports success or an actionable error
- Scores refresh into Schedule and Live Command Center
- Rankings populate the Rankings page and Command Center
- Weather populates when venue coordinates are available
- Startup provider check turns green after configuration
- Offline mode still launches
- No odds or wagering feed appears
- Installer workflows remain green
