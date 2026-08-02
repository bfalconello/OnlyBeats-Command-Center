# OnlyBeats Command Center

**Your Complete College Football Command Center**

OnlyBeats Command Center is a Windows desktop application for following college football through one focused interface. The current stable foundation includes a branded dashboard, live games, search, favorites, automatic refresh, game details, settings, SQLite initialization, and developer diagnostics.

## Current version
**0.4.0 — Project Infrastructure**

This release keeps the working 0.2.1 live-game behavior and adds the documentation, automation, contribution standards, and release process required for the Saturday Wall sprint.

## Quick start
1. Install the prerequisites described in `INSTALL_WINDOWS.md`.
2. Run `CHECK_MY_PC.bat`.
3. Run `RUN_DESKTOP.bat` for native development.
4. Open **Saturday Wall** and select **Refresh now**.
5. Use `BUILD_WINDOWS.bat` to create MSI and NSIS installers.

A browser preview is available through `PREVIEW_APP.bat`, but native provider features may require the desktop runtime.

## Documentation
- [Project Bible](docs/PROJECT_BIBLE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Design System](docs/DESIGN_SYSTEM.md)
- [Roadmap](docs/ROADMAP.md)
- [Decisions](docs/DECISIONS.md)
- [API Providers](docs/API_PROVIDERS.md)
- [Database](docs/DATABASE.md)
- [Release Process](docs/RELEASE_PROCESS.md)
- [Contributing](docs/CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

## Repository structure
```text
app/          Frontend application
src-tauri/    Rust backend and desktop configuration
database/     SQLite reference schema
docs/         Product and engineering documentation
design/       Visual assets and concepts
.github/      CI workflows and contribution templates
```

## Automated Windows build
Every push or pull request to `main` or `develop` runs a Windows workflow that validates JavaScript, checks Rust, builds Tauri installers, and uploads the MSI/EXE as workflow artifacts.

## Roadmap
The next feature release is **v0.4.0 — Saturday Wall**, followed by Team Hub, rankings, weather/game intel, news/reports, and the first stable v1.0 release.

## Project standard
> Precision over speed. One honest release at a time.
