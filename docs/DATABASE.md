# Database

## Engine
SQLite is the durable local database. The reference schema is stored in `database/schema.sql`.

## Rules
- Every schema change increments the schema version.
- Migrations must be forward-only and repeat-safe where practical.
- Backups occur before destructive migration work.
- Existing user data is preserved unless release notes explicitly document a breaking migration.
- SQL statements use parameters for user or provider values.

## Current state
Schema version 1 initializes the application database foundation. Settings and favorites currently remain in local storage while the durable model is expanded.

## Planned tables
- `schema_migrations`
- `app_settings`
- `favorite_teams`
- `games_cache`
- `teams`
- `sync_runs`
- `user_predictions`

The exact design must be reviewed before implementation; this list is directional, not a committed schema.
