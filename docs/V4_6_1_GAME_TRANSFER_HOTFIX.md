# OnlyBeats v4.6.1 — Game Transfer Hotfix

## Fixed

- Open Game Hub buttons navigating without transferring the selected matchup
- Legacy `gameHubGameId` paths not synchronizing with Ultimate Game Hub state
- Selected games reverting to the first live or upcoming matchup
- Inconsistent navigation from:
  - Game details drawer
  - Saturday Dashboard
  - Live Command Center
  - Team Profiles
  - Conference Dashboards
  - Unified Command Dashboard
  - GameDay Command
  - Smart Insights
  - Command Center

## Added

- Shared `openUltimateGameHub(gameId)` navigation helper
- Synchronization across:
  - `ultimateGameHubState.selectedGameId`
  - legacy `gameHubGameId`
  - `sessionStorage`
- Developer QA check for the transfer helper
- Production readiness check for selected-game transfer

## Installer

`dist/OnlyBeats-Setup-4.6.1.exe`
