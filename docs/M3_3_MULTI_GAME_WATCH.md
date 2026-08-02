# M3.3 — Multi-Game Watch Center

## Included

- Dedicated Watch Center navigation page
- Locally saved pinned games
- Live-first automatic sorting
- Favorite-team and Top 25 prioritization
- Close-game indicator for live games within eight points
- Compact prediction status
- Manual availability-note summary
- Fast links to Focus Mode, Prediction Center, and full game details
- Recommended games based on live status, favorites, rankings, and kickoff time
- Clear-all pins control

## Data integrity

The Watch Center uses the existing scoreboard, prediction, favorite-team, and manual availability data. It does not introduce a new provider or change scoring.

## Regression checklist

- Watch Center appears in navigation
- Games can be pinned and removed
- Pins remain after restart
- Live games sort above scheduled and final games
- Focus, Prediction, and Details buttons work
- Refresh Watch Center changes state and restores
- Clear Pins works
- Other pages remain stable
