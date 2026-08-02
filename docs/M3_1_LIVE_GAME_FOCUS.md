# M3.1 — Live Game Focus

Focus Mode is now a connected game workspace instead of a minimal score modal.

## Included

- Live or scheduled score context
- Rankings and favorite-matchup status
- Broadcast, venue, local kickoff, and location
- Total points and current leader
- Team records, conference, and recent-form trend
- Saved game predictions with confidence, odds reference, result, and score
- Manual player-availability notes
- One-click links to full game details, Schedule, Weather, Team Intelligence, Prediction Center, and Player Availability
- In-focus score refresh

## Data integrity

The workspace only summarizes information already present in the application:

- Scoreboard provider data
- Cached game data
- Local predictions
- Local availability notes
- Shared team metadata
- Open-Meteo weather access

It does not invent play-by-play, injury reporting, or win probabilities.

## Regression checklist

- Focus Mode opens from Saturday Wall and game details
- Refresh Game visibly changes state and restores
- Full details opens
- Schedule link filters to the matchup
- Weather link loads the venue location when available
- Team Intelligence links work
- Prediction creation works
- Availability link works
- Escape and close button dismiss Focus Mode
