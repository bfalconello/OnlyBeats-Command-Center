# OnlyBeats v6.0 — Installed App & Automatic Updates

## Added

- Installed Windows application update service
- GitHub Releases stable update channel
- Automatic update check after startup
- Six-hour background update checks
- Manual Check for Updates
- Download progress
- Release notes
- Restart and Install
- Updater event history
- Updater diagnostic log
- Open GitHub Releases fallback
- Published-release validation workflow
- Tag/package version validation
- Installer, blockmap, and latest.yml release assets
- Persistent Firebase configuration in Electron userData
- Firebase configuration migration from the packaged app
- Developer QA coverage
- Production readiness checks

## Important release rule

The package.json version and Git tag must match.

Example:

- package.json: 6.0.1
- Git tag: v6.0.1

GitHub Actions publishes:

- OnlyBeats-Setup-6.0.1.exe
- OnlyBeats-Setup-6.0.1.exe.blockmap
- latest.yml

The GitHub Release must be published and cannot remain a draft.

## Installed update flow

1. The installed app checks the stable GitHub release channel.
2. A newer version appears in Updates & Release.
3. The user downloads it.
4. OnlyBeats displays download progress.
5. Restart and Install closes the app.
6. The NSIS installer applies the update and relaunches OnlyBeats.

## Firebase preservation

On launch, the packaged Firebase configuration is copied into the
Electron user-data directory. Future installed updates reuse that
persistent configuration, preventing a release package from blanking
the working Firebase connection.

## Current limitation

The updater is designed for the installed Windows NSIS application.
RUN_DESKTOP.bat runs in development mode and cannot perform a real
installed-app update.
