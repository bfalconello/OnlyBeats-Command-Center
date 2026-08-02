# v0.10 Architecture Refactor — Phase 3

Phase 3 extracts the two largest stable football-page areas without changing their behavior.

## New modules

### `app/modules/team-intelligence.js`

Owns:

- Team index construction and metadata enrichment
- Team selection and Team Hub navigation
- Record, form, trend, prediction, and availability summaries
- Team directory cards
- Team Overview, Schedule, Stats, and Roster tabs
- Team Intelligence page rendering

### `app/modules/schedule-center.js`

Owns:

- Local-day and date-range calculations
- Schedule status, date, favorites, Top 25, and search filtering
- Date grouping and schedule rows
- Schedule Center page rendering

## Why Prediction Center remains in `app.js`

Prediction Center currently combines forms, scoring, futures, analytics, reports, CSV export, and several event-binding paths. It will be extracted in a dedicated later phase so it can receive a focused regression test rather than being moved alongside unrelated features.

## Script order

1. `modules/config.js`
2. `modules/storage.js`
3. `modules/ui-core.js`
4. `modules/navigation.js`
5. `modules/refresh-ui.js`
6. `modules/team-intelligence.js`
7. `modules/schedule-center.js`
8. `data-platform.js`
9. `app.js`
