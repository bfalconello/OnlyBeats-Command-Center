# Update from 0.2.1 to 0.2.2

Version 0.2.2 is an infrastructure update with no database migration.

## Recommended GitHub workflow
1. Keep the working 0.2.1 folder until testing is complete.
2. Extract this release into a temporary folder.
3. Copy the release contents into the local cloned GitHub repository.
4. Do not remove the repository's hidden `.git` folder.
5. Do not copy `node_modules` or `src-tauri/target`.
6. Review changes in GitHub Desktop.
7. Commit with: `Sprint 1A: establish project infrastructure`.
8. Push to GitHub.
9. Open the **Actions** tab and verify the Windows Build workflow.
10. Run `RUN_DESKTOP.bat` locally and complete `TEST_CHECKLIST.md`.

Settings and favorites continue using the same local application storage.
