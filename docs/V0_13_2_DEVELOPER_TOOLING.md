# v0.13.2 — Developer Tooling, Phase 1

## Added

- Runtime health checks
- Required-function validation
- Local-storage availability test
- Structured runtime error log
- Unhandled promise rejection logging
- Page render smoke tests
- Provider-state summary
- Exportable diagnostics JSON
- Clear-log control

## Important

The smoke tests render page functions without changing saved user data. They do not call external providers, submit forms, or alter predictions.

## Regression checklist

- Developer Tools opens
- Run Diagnostics works
- Page Smoke Tests work
- Export Diagnostics downloads JSON
- Clear Log works
- Dashboard, Briefing, Watch Center, Prediction Center, Intelligence, and Reports still open
- Refresh controls remain functional
