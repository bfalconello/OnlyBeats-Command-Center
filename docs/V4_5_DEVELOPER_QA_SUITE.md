# OnlyBeats v4.5 — Developer Mode & QA Suite

## Added

- Developer & QA sidebar page
- Full in-app QA suite
- Route coverage checks
- Module availability checks
- Required asset checks
- Local-storage read/write test
- Storage inspector
- Core data-integrity checks
- Backup-tool validation
- Provider health diagnostics
- Production-check integration
- Runtime error capture
- Unhandled-promise capture
- Clearable error log
- Exportable QA report
- Optional startup QA run
- Manual Windows verification checklist

## Important boundary

In-app QA can verify code paths, modules, data, assets, storage, and
provider status. It cannot fully replace a person visually testing
the Electron window, fullscreen behavior, operating-system dialogs,
installer flow, or physical display layouts.

## Installer

Expected output:

`dist/OnlyBeats-Setup-4.5.0.exe`

## Recommended release workflow

1. Run `RUN_DESKTOP.bat`.
2. Open Developer & QA.
3. Run the full QA suite.
4. Export the report.
5. Manually open each page.
6. Test prediction, favorite, combo, and backup writes.
7. Test Command Mode twice.
8. Build the installer.
9. Install and repeat the smoke test in the packaged build.
10. Commit and push only after both modes pass.
