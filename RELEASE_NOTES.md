# OnlyBeats Command Center 0.2.2 — Project Infrastructure

## Purpose
This release prepares the working application for long-term development. It intentionally adds no major user-facing football feature.

## Added
- Project Bible
- Architecture and design-system guides
- Roadmap and architecture decision log
- API provider and database documentation
- Contribution and release-process guides
- GitHub Actions Windows build
- Bug, feature, and documentation issue forms
- Pull request template and CODEOWNERS
- Design, release, script, and test directory scaffolding
- Repository changelog

## Compatibility
- No database migration
- Same local-storage keys as v0.2.1
- Live Games and favorites behavior is intended to remain unchanged

## Verification status
Static configuration and JavaScript syntax are checked in the release package. Native Windows compilation must be verified by running `RUN_DESKTOP.bat` or the included GitHub Actions workflow.

## Next release
v0.3.0 — Saturday Wall
