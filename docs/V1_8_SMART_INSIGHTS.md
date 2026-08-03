# OnlyBeats v1.8 — Smart Insights Engine, Phase 1

## Added

- Dedicated Smart Insights page
- Explainable Game to Watch score
- Ranked-team upset signals
- Prediction review-risk scoring
- Availability-impact board
- Current Weather Center context
- Insight Board, Upset Signals, and Availability Impact views
- JSON insight-report export
- Direct actions into Game Hub, Focus Mode, Prediction Center, Weather, and Mission Control

## Methodology

This release is transparent and rules-based. It uses only information already available in OnlyBeats:

- Current game state and scores
- Rankings
- Favorite teams
- Existing game-priority signals
- Saved prediction confidence
- Manual player-availability notes
- Current Weather Center location
- Kickoff timing

It does not invent statistics, injuries, weather locations, probabilities, or guaranteed outcomes.

## Unchanged

- Prediction scoring
- Saved predictions and futures
- Live provider behavior
- Alerts
- Analytics
- Season Archive
- Backup and restore

## Regression checklist

- Smart Insights appears in the sidebar
- Insight Board loads
- Upset Signals loads
- Availability Impact loads
- Refresh Insights works
- Export Insight Report downloads JSON
- Game Hub, Focus Mode, and Prediction Review actions work
- Production checks pass
