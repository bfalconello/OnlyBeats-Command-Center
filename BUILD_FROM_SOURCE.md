# Build from Source

1. Install Node.js LTS, Rust stable, Visual Studio Build Tools with C++, and the Windows SDK.
2. Open PowerShell in the release folder.
3. Run `npm install`.
4. Run `npm run desktop:dev` for development.
5. Run `npm run desktop:build` for installable bundles.

The frontend is dependency-free HTML/CSS/JavaScript in `app/`. Tauri v2 embeds it as the desktop WebView. Rust source is under `src-tauri/src/`. SQLite schema 1 is under `database/schema.sql`.
