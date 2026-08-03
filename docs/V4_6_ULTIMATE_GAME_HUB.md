# OnlyBeats v4.6 — Ultimate Game Hub

## Added

- Central matchup selector
- Live, upcoming, and final scoreboards
- Kickoff countdown
- Network and venue information
- Watch-game toggle
- Team rankings
- Side-by-side team comparison
- Connected provider statistics when available
- Historical prediction record for both teams
- Matchup weather
- Saved prediction and current status
- Prediction Intelligence score, grade, and warnings
- Player availability when supplied
- Detailed live information when supplied
- Saved combo membership
- Persistent per-game notes
- Automatic and manual refresh
- Adjustable display controls
- Developer QA integration

## Provider boundaries

Ultimate Game Hub never invents missing data.

The following sections display explicit unavailable states when a
connected provider does not supply them:

- Team statistics
- Player availability
- Drives
- Scoring plays
- Possession
- Win probability
- Other detailed live information

## Installer

Expected output:

`dist/OnlyBeats-Setup-4.6.0.exe`

## Regression checklist

- Ultimate Game Hub appears in navigation
- Game selector changes the matchup
- Links from Saturday Dashboard, Team Profiles, and Conference Dashboards open the selected game
- Scoreboard, kickoff, network, and venue populate
- Watch-game toggle persists
- Weather displays or clearly reports the forecast horizon
- Prediction context displays
- Notes save per game and persist after restart
- Combo membership appears when applicable
- Team comparison handles missing provider stats
- Manual and automatic refresh work
- Developer QA reports Game Hub module, route, and asset as passing
