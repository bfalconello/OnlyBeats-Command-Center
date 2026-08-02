# Architecture

## Overview
OnlyBeats Command Center is a Tauri 2 desktop application. Static frontend assets run inside the native WebView, while Rust handles operating-system access, SQLite initialization, and external provider requests.

```text
WebView UI
  -> frontend state and rendering
  -> Tauri invoke bridge
Rust commands
  -> provider clients / validation / timeout handling
  -> SQLite and local filesystem
External providers
```

## Current repository layout
```text
app/                 Frontend HTML, CSS, and JavaScript
src-tauri/           Rust application and Tauri configuration
database/            Reference SQL schema
docs/                Product and engineering documentation
design/              Logos, concepts, screenshots, and design references
.github/              Automation and contribution templates
scripts/              Repeatable maintenance scripts
tests/                Automated and manual test assets
releases/             Release-specific notes when needed
```

## Frontend responsibilities
- Navigation and page rendering
- User settings and favorites
- Search and filtering
- Live-game presentation and details
- Loading, empty, offline, and error states
- Calling registered Tauri commands

The frontend must not assume that a page-specific DOM element exists. Shared update functions must guard optional elements before writing to them.

## Rust responsibilities
- Initialize application directories and SQLite
- Register Tauri commands
- Fetch provider data with explicit timeout and user agent
- Convert network or parse failures into readable errors
- Keep secrets outside frontend source
- Expose only the minimum command surface required by the UI

## Live-score refresh flow
1. User action or timer requests a sync.
2. Frontend marks the refresh as pending without clearing last-known data.
3. Tauri invokes the Rust score command.
4. Rust calls the provider with a timeout.
5. Rust returns normalized data or a readable error.
6. Frontend updates cache, cards, timestamp, and provider status.
7. On failure, last-known data remains visible and a non-blocking warning appears.

## State
Current settings and favorites use browser local storage. Live game data is held in memory for the session. SQLite is initialized as the durable application data layer and should receive versioned migrations before durable feature tables are expanded.

## Provider adapters
Provider-specific parsing must stay behind a stable internal shape. UI code should consume normalized game objects rather than raw provider responses.

## Error handling
- Expected network failures become visible status messages, not crashes.
- Optional DOM targets are null-checked.
- Parsing errors identify the affected provider.
- Logs include operation and timestamp but no secrets.
- A failed refresh never destroys the last successful result.

## Future modularization target
```text
app/
  core/          routing, shared state, shell
  features/      live-games, saturday-wall, teams, rankings
  services/      provider adapters, cache, settings
  shared/        reusable components and utilities
```

Migration to a framework or module bundler requires an architecture decision record before implementation.
