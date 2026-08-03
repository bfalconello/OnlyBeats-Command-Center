# OnlyBeats v3.3 — Prediction Analytics

## Added

- Dedicated Prediction Analytics page
- Overall record and accuracy
- Correct, incorrect, push, pending, and graded totals
- Best winning streak and longest losing streak
- Team performance table
- Conference performance table
- Prediction-type performance
- Home versus away splits
- Confidence calibration buckets
- Season/date performance trend
- Combo accuracy and average leg count
- Season, status, sample-size, and row-count filters
- Exportable JSON analytics report

## Data boundary

Analytics use only locally saved and graded prediction history.
OnlyBeats reports record and accuracy trends. It does not calculate
or claim financial returns.

## Installer

Expected output:

`dist/OnlyBeats-Setup-3.3.0.exe`

## Regression checklist

- Prediction Analytics appears in the sidebar
- Overall record matches graded predictions
- Season filter updates the page
- Minimum sample hides undersized groups
- Confidence calibration uses graded predictions
- Team and conference tables populate
- Combo analytics populate
- Export downloads a JSON report
- Prediction Lab, Live NCAA, and Command Center still work
- Installer workflows remain green
