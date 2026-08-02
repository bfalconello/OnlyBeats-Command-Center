# OnlyBeats Command Center — Project Bible

> **North Star:** OnlyBeats Command Center should be the first application a college football fan opens on Saturday morning and the last one they close after the final whistle.

## 1. Mission
Build a beautiful, reliable, desktop-first college football command center that combines live games, schedules, teams, rankings, weather, news, favorites, and personal winner predictions in one focused experience.

## 2. The Hawk Standard
Every release must be:

1. **Reliable** — expected workflows work consistently and failures are handled safely.
2. **Fast** — navigation and refreshes never block the interface unnecessarily.
3. **Beautiful** — spacing, typography, states, and interactions feel intentional.
4. **Documented** — users and future contributors can understand installation, operation, and architecture.

A feature that misses one of these standards is not ready to ship.

## 3. Product Principles
- Game-day usefulness comes first.
- Desktop and second-monitor use are primary.
- Live information must show its source state and last successful update.
- No fake data may be presented as live data.
- Provider failures must degrade gracefully.
- Personalization should remain local-first unless cloud sync is explicitly introduced.
- Existing user data must be preserved across compatible upgrades.

## 4. Scope
### Version 1.0 core
- Branded Windows desktop application
- Live games and weekly schedule
- Saturday Wall
- Favorites
- Team Hub
- Rankings and standings
- Weather
- News
- Search
- Reports and exports
- Stable installer, documentation, and upgrade path

### Outside current scope
- Real-money wagering workflows
- Odds-shopping or wager recommendations
- Unlicensed redistribution of restricted data
- Hidden or undocumented telemetry

## 5. Technology Baseline
- Desktop shell: Tauri 2
- Backend: Rust
- Frontend: HTML/CSS/JavaScript today, with migration paths documented before framework changes
- Local data: SQLite
- Live scores: provider adapter through Rust commands
- Weather: provider adapter with caching and attribution
- Packaging: Windows MSI and NSIS bundles
- Automation: GitHub Actions on Windows

## 6. Design Direction
- Dark-first sports operations aesthetic
- Gold OnlyBeats accent
- High information density without clutter
- Consistent reusable cards, badges, buttons, drawers, and empty states
- Team colors support content; they do not replace accessible contrast

## 7. Performance Targets
- Warm launch target: under 3 seconds on supported hardware
- Navigation response target: under 200 ms for local views
- Search feedback: immediate while typing
- Refresh operations: asynchronous and non-blocking
- Last successful data remains visible during temporary provider failures

## 8. Data and Privacy
- Settings and favorites are local-first.
- Secrets are never committed to Git.
- API keys must use environment variables or an approved secure storage path.
- External responses are treated as untrusted input and validated.
- Logs must not expose secrets or unnecessary personal information.

## 9. Release Quality Gate
A release may be tagged only when:
- The Windows build completes.
- The app launches on Windows.
- Core regression checks pass.
- No known crash exists in normal use.
- Versions match across package, Rust, and Tauri configuration.
- Changelog, release notes, upgrade notes, and test checklist are updated.
- Database compatibility is documented.

## 10. Versioning
Semantic Versioning is used:
- Patch: bug fix with no intended feature change
- Minor: backward-compatible feature release
- Major: breaking product or data compatibility change

## 11. Branching
- `main`: always intended to be stable
- `develop`: integration branch when needed
- `feature/<name>`: focused feature work
- `fix/<name>`: focused bug fixes
- `docs/<name>`: documentation-only work

Small projects may merge directly through a pull request when checks pass.

## 12. Definition of Done
A task is done only when implementation, error states, testing notes, documentation, and release impact have all been addressed.

## 13. Roadmap
See [ROADMAP.md](ROADMAP.md).

## 14. Architecture
See [ARCHITECTURE.md](ARCHITECTURE.md).

## 15. Design System
See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## 16. Decision Log
See [DECISIONS.md](DECISIONS.md).

## 17. Project History
- 2026-08-02: product name, branding, North Star, and Hawk Standard established.
- 2026-08-02: first working native desktop launch verified.
- 2026-08-02: live-score refresh and favorites verified in v0.2.1.
- 2026-08-02: GitHub repository established as the source of truth.
