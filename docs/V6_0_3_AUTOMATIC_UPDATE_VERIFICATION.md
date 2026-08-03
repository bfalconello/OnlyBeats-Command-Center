# OnlyBeats v6.0.3 — Automatic Update Verification

This is a deliberately small release used to prove the installed
updater from end to end.

## Visible verification

The Updates & Release page now shows:

- ONLYBEATS v6.0.3 · UPDATE PIPELINE TEST
- Updater Verification: v6.0.3
- Automatic Update Verification panel

## Test from installed v6.0.2

1. Publish v6.0.3 as a GitHub Release.
2. Attach:
   - OnlyBeats-Setup-6.0.3.exe
   - OnlyBeats-Setup-6.0.3.exe.blockmap
   - latest.yml
3. Open the installed v6.0.2 application.
4. Open Updates & Release.
5. Click Check for updates.
6. Click Download update.
7. Click Restart and install.
8. After relaunch, confirm the application reports v6.0.3.
9. Confirm Firebase, cloud sync, local data, and settings remain intact.

## Success criteria

The update pipeline is verified when the installed application updates
without manually downloading or running the v6.0.3 installer.
