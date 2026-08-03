# OnlyBeats v2.9.1 — Command Center Hotfix

## Fixed

- Command Mode using only the top portion of the screen
- Fullscreen height and overflow calculations
- Main-content scrolling in fullscreen
- Layout resizing after entering or leaving fullscreen
- Sidebar and mobile navigation remaining in fullscreen
- Layout behavior on 1080p, 1440p, 4K, and ultrawide monitors

## Added

- Dedicated Saturday Mode header
- Live clock
- Sticky command-alert ticker
- Prediction Health meter
- Winning, losing, pending, and correct counts
- Larger fullscreen game wall
- Responsive three-column operations layout
- Cleaner fullscreen exit recovery

## Installer

Expected output:

`dist/OnlyBeats-Setup-2.9.1.exe`

## Regression checklist

- Command Mode fills the entire display
- Fullscreen content scrolls normally
- Exiting fullscreen restores the normal application layout
- Alert ticker remains visible while scrolling
- Prediction Health updates from tracked predictions
- 1080p and ultrawide layouts remain usable
- Live Command Center filters and alerts still work
- Installer workflows remain green
- Production checks pass
