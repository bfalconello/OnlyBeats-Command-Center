# OnlyBeats v2.8 — Prediction Lab

## Added

- Dedicated Prediction Lab page
- Transparent local prediction ranking
- Confidence calibration buckets
- Historical graded accuracy
- Upset Watch
- Configurable confidence and upset thresholds
- Pending-only filter
- Suggested-combo size control
- One-click Combo Maker draft from top saved predictions
- Documented scoring rules
- No hidden or external AI claims

## Data boundary

Prediction Lab uses only saved predictions, confidence values, local game state, rankings, favorites, and graded historical results. It does not use external public percentages or hidden AI models.

## Installer

Expected output:

`dist/OnlyBeats-Setup-2.8.0.exe`

## Regression checklist

- Prediction Lab appears in the sidebar
- Prediction Center and Combo Maker still load
- Confidence thresholds persist
- Calibration displays graded history
- Upset Watch displays only qualifying games
- Suggested combo opens in Combo Maker
- Windows installer workflows remain green
- Production checks pass
