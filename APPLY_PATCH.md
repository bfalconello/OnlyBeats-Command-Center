# Apply OnlyBeats v5.5

1. Back up `app/firebase-config.js`.
2. Keep v5.0 as a rollback copy.
3. Copy the entire extracted v5.5 package over the repository.
4. Restore the backed-up `app/firebase-config.js`.
5. Run `RUN_DESKTOP.bat`.
6. Open Developer & QA and run the full suite.
7. Test cloud sync before building the installer.

Suggested commit:

`v5.5.0: add cross-platform experience, smart sync, and live refresh`
