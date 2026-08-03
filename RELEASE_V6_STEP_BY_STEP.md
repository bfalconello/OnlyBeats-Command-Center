# Publish OnlyBeats v6.0.0

## 1. Apply and test

- Copy v6.0 over the repository.
- Run RUN_DESKTOP.bat.
- Run Developer & QA.
- Confirm Firebase remains connected.
- Build the installer locally.

## 2. Commit

Suggested commit:

`v6.0.0: add installed app and automatic updates`

## 3. Push the release tag

Create and push:

`v6.0.0`

The tag must exactly match package.json version 6.0.0.

## 4. Wait for GitHub Actions

The workflow verifies and publishes:

- Installer
- Blockmap
- latest.yml

## 5. Install v6.0.0

Download and run OnlyBeats-Setup-6.0.0.exe from the published GitHub
Release. This establishes the installed application that can receive
future automatic updates.

## 6. Test automatic updates with v6.0.1

A real updater test requires a newer published version.

- Change package.json and app version to 6.0.1.
- Commit the small update.
- Push tag v6.0.1.
- Open installed v6.0.0.
- Open Updates & Release.
- Check, download, restart, and verify v6.0.1.
