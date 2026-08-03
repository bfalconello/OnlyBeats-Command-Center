# OnlyBeats v3.0.1 — Release Hub Runtime Hotfix

## Fixed

- `bridge is not defined` on Desktop Release
- Release Hub failing when Electron bridge APIs are absent
- Browser-preview runtime detection
- Production checks taking down the full page
- Provider-readiness checks failing when provider globals are unavailable
- Support-report export failing when optional data modules are unavailable

## Added

- Defensive desktop bridge normalization
- Release Hub safe-mode renderer
- Runtime error isolation
- Desktop bridge safety production check
- v3.0.1 installer metadata

## Installer

Expected output:

`dist/OnlyBeats-Setup-3.0.1.exe`

## Regression checklist

- Desktop Release loads without `bridge is not defined`
- Release Hub loads in Electron
- Release Hub loads in browser preview
- Missing provider modules do not crash Release Hub
- Support-report export works
- Production checks pass
- Installer workflows remain green
