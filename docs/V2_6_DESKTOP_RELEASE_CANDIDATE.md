# OnlyBeats v2.6 — Desktop Release Candidate

## Added

- Desktop Release Center
- First-run setup checklist
- Installer readiness checks
- Release-report export
- Recovery storage test
- Update-channel preference
- Electron main process and secure preload bridge
- Remembered Windows size and maximized state
- Renderer crash logging
- NSIS installer configuration
- Desktop and Start Menu shortcuts
- Windows GitHub Actions release workflow
- `RUN_DESKTOP.bat`
- `BUILD_WINDOWS_INSTALLER.bat`

## Build the installer

1. Install Node.js 22 or newer.
2. Run `BUILD_WINDOWS_INSTALLER.bat`.
3. The unsigned installer is created in `dist/`.

Expected filename:

`OnlyBeats-Setup-2.6.0.exe`

## Important release boundary

The installer template is functional, but the application is not code-signed by default. Windows SmartScreen may warn about an unsigned publisher. Automatic update publishing also remains disabled until a release provider and signing process are configured.

## Regression checklist

- Desktop Release appears in the sidebar
- First-run setup persists
- Backup export works
- Recovery test works
- Release report downloads
- `npm run start` launches Electron
- `npm run dist:win` creates an NSIS installer on Windows
- GitHub workflow uploads the installer artifact
- Production checks still work
