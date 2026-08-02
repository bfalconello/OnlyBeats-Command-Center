# OnlyBeats Command Center 0.2.1 — Live Football

## Added
- Native NCAA college-football scoreboard connection
- Live, upcoming, and final game states
- Automatic refresh at 15, 30, or 60 seconds
- Team and matchup search
- Game details window
- Favorite teams saved locally
- Favorite-team matchup view
- TV network and venue display when supplied
- Developer Tools diagnostics
- Provider status, last sync time, cached-game count, runtime, version, and schema information
- Graceful offline and provider-error messages

## Data note
The scoreboard module reads a public ESPN scoreboard endpoint. Availability and fields can change because this is not a contracted licensed feed. The provider layer is isolated so it can be replaced later.

## Database
Schema remains version 1. No migration is required from 0.2.1.

## 0.2.1 hotfix
- Fixed `Cannot set properties of null (setting 'textContent')` after refreshing from the Live Games page.
- Provider status UI now updates only when the relevant status elements are present.
