# Release Process

## 1. Scope
Create or assign issues to the target milestone. Define acceptance criteria and explicitly exclude deferred work.

## 2. Branch
Create a focused branch such as `feature/saturday-wall` or `fix/live-refresh-status`.

## 3. Implement
Keep changes focused. Update tests and documentation with the code.

## 4. Local checks
- Run `CHECK_MY_PC.bat` when the toolchain changes.
- Run `RUN_DESKTOP.bat` and complete the release checklist.
- Run `BUILD_WINDOWS.bat` for a release candidate.
- Verify settings and data persistence across restart.

## 5. Pull request
Use the repository PR template. Attach screenshots for visible changes and identify known limitations.

## 6. Automated checks
The Windows workflow must complete and upload installer artifacts. A failed check blocks release tagging unless the failure is documented as infrastructure-only and approved.

## 7. Version consistency
Update version in:
- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`
- user-visible version labels
- release notes and changelog

## 8. Release candidate test
Install or run the exact artifact intended for release on Windows. Complete `TEST_CHECKLIST.md` and record discovered issues.

## 9. Tag and release
Create an annotated tag such as `v0.3.0`. Publish GitHub release notes and attach verified installers.

## 10. Retrospective
Document what went well, what failed, and one process improvement for the next sprint.
