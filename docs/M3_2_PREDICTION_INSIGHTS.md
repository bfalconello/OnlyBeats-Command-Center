# M3.2 — Prediction Insights

Prediction Reports is now a visual analytics workspace.

## Added

- Confidence calibration visualization
- Weekly accuracy trend visualization
- Prediction-type performance
- Team-by-team prediction performance
- Calibration summary
- Expanded chronological prediction timeline
- Existing season reflection and CSV export

## Data model

This release does not change prediction storage, scoring rules, confidence behavior, odds references, futures, or CSV format. It visualizes the same local prediction data already used by the application.

## Regression checklist

- Prediction Center still creates Winner, Spread, and Over/Under entries
- Futures still load and resolve
- Reports opens
- Confidence Calibration renders
- Weekly Accuracy Trend renders
- Prediction Type chart renders
- Team Insights render
- Timeline opens
- Season Reflection persists
- CSV export works
