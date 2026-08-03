# OnlyBeats v6.0.1 — Desktop Bridge Stabilization

## Fixed

- Electron sandbox preload failing on `require('../package.json')`
- Missing updater desktop bridge
- Missing persistent Firebase bridge
- Prediction Intelligence loading twice
- Diagnostics reading `currentPage` before application startup
- Repeated Open-Meteo requests causing HTTP 429 responses

## Added

- Sandboxed preload-safe desktop bridge
- Asynchronous runtime metadata hydration
- Desktop bridge-health IPC endpoint
- QA check for preload bridge health
- QA check for one Prediction Intelligence script
- Weather request cache
- Minimum five-minute weather run interval
- Ten-minute per-venue weather cache
- Exponential backoff after HTTP 429
- Stale cached-weather fallback during provider rate limits

## Test sequence

1. Run `RUN_DESKTOP.bat`.
2. Open Developer Tools and confirm there is no preload error.
3. Confirm `window.onlyBeatsDesktop` returns an object.
4. Run Developer & QA.
5. Confirm Updater desktop bridge passes.
6. Confirm Persistent Firebase bridge passes.
7. Confirm Prediction Intelligence single load passes.
8. Confirm weather refresh does not repeatedly return 429.
9. Build and install the NSIS application.
10. Publish tag `v6.0.1` only after all checks pass.
