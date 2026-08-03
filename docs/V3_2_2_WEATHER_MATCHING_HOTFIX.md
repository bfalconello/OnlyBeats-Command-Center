# OnlyBeats v3.2.2 — Weather Matching Hotfix

## Fixed

- Weather records not reconnecting to game cards
- Provider venue names differing from bundled stadium names
- Weather being limited to the first 20 unique venues
- One failed weather request interrupting the remaining slate

## Added

- Direct game-ID mapping between weather and games
- Full-slate weather fetching in concurrent batches
- Shared-stadium request deduplication
- Weather game-match and record diagnostics
- Temperature, condition, wind, and precipitation on game cards

## Test

1. Open Live NCAA Setup.
2. Refresh all feeds.
3. Confirm Weather game matches is greater than zero.
4. Open Live Command Center.
5. Confirm upcoming game cards display weather.

## Installer

`dist/OnlyBeats-Setup-3.2.2.exe`
