# M3 — Saturday Command Center

The Dashboard is now a live college-football mission-control screen.

## Connected information

- Live games
- Today's loaded schedule
- Favorite-team games
- Ranked matchups
- Upset signals
- Today's prediction accuracy and score
- Season prediction accuracy
- Manual availability notes
- Score, weather, and local-data readiness
- Quick navigation across the entire application

## Design principle

The Command Center summarizes existing trusted app data. It does not invent editorial headlines, injuries, rankings, or weather information.

## Regression checklist

- Dashboard loads with and without live games
- Refresh Command Center changes state and returns normally
- Featured game opens
- Live, Favorite, and Ranked game rows open
- Prediction Center link works
- Every Quick Navigation link works
- Quick Notes persist after restart
- Legacy dashboard customization still works
- Navigation and refresh remain responsive
