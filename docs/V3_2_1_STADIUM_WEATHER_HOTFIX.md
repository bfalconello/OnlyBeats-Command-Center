# OnlyBeats v3.2.1 — Stadium Weather Hotfix

## Added

- Bundled FBS stadium coordinate database
- 128 stadium records in the bundled source dataset
- Team, abbreviation, stadium, city, and alias matching
- Provider-coordinate priority
- Built-in stadium-coordinate fallback
- Cached Open-Meteo geocoding fallback for newer or renamed venues
- Resolved-venue and geocoder-cache diagnostics
- Automatic missing-location resolution before weather refresh

## Weather resolution order

1. Coordinates supplied by the live scores provider
2. Built-in stadium database match
3. Cached Open-Meteo geocoder result
4. Weather remains unavailable if none can resolve the venue

## Installer

Expected output:

`dist/OnlyBeats-Setup-3.2.1.exe`
