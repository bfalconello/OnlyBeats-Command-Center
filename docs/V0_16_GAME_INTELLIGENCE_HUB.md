# v0.16 — Game Intelligence Hub, Phase 1

## Added

- Dedicated Game Hub sidebar page
- Matchup selector
- Live score and game-state context
- Rankings, favorites, network, venue, and kickoff
- Priority score
- Team records and recent-form summaries
- Saved prediction summary
- Manual player-availability notes
- Game-specific timeline events
- Venue-weather shortcut
- Direct links to Focus Mode, Schedule, Game Details, Team Intelligence, Prediction Center, and Watch Center
- Open Game Hub action in the existing game-details drawer

## Data integrity

The Hub combines only data already present in OnlyBeats. It does not invent play-by-play, injury reporting, rankings, or win probabilities.

## Regression checklist

- Game Hub appears in navigation
- Matchup selector works
- Refresh Hub works
- Team Intelligence links work
- Focus Mode opens
- Prediction creation opens the selected game
- Venue Weather works when location is available
- Schedule filter opens
- Full Game Details opens
- Pin to Watch Center works
- Prediction Center helper remains present
