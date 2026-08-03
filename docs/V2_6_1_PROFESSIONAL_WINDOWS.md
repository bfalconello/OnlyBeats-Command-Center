# OnlyBeats v2.6.1 — Professional Windows Edition

## Added

- Custom OnlyBeats Windows icon
- Branded installer header and sidebar artwork
- Branded startup/welcome experience
- Windows Experience page
- Backup Manager history
- Release Notes panel
- Native Windows notification-settings shortcut
- Windows system information
- Stable v2.6.1 executable metadata
- `desktop:build` compatibility script
- Upgrade-safe installer configuration

## Installer output

Run:

`BUILD_WINDOWS_INSTALLER.bat`

Expected output:

`dist/OnlyBeats-Setup-2.6.1.exe`

## Important publishing boundary

The installer remains unsigned until a Windows code-signing certificate is configured. Windows SmartScreen can therefore display an unknown-publisher warning. Automatic update downloads also remain disabled until a release publishing provider is configured.

## Regression checklist

- Windows Experience appears in the sidebar
- Welcome overlay opens on first launch
- Welcome choice persists
- Branded icon appears in Electron and installer output
- Backup Manager records exports
- Release Notes load
- Native notification settings opens in Electron
- Desktop Release checks still work
- Both Windows workflows remain green
- Production checks pass
