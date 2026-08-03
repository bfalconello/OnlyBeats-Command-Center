# OnlyBeats v2.7 — Cloud Platform, Phase 1

## Added

- Dedicated Account & Devices page
- Account-ready local profile
- Trusted-device session registry
- Automatic backup scheduler
- Hourly, daily, and weekly backup cadence
- Manual backup workflow
- Cloud and local-only backup history
- Sync-on-startup preference
- Trusted-device-only preference
- Honest cloud-readiness checks
- Security boundary documentation

## Capability boundary

This release does not embed user passwords, private server credentials, or a shared backend account. Real account authentication and remote synchronization activate only after a compatible cloud adapter, identity provider, database, and access-control rules are configured.

## Installer

Expected output:

`dist/OnlyBeats-Setup-2.7.0.exe`

## Regression checklist

- Account & Devices appears in the sidebar
- Current device registers automatically
- Local account profile persists
- Backup cadence persists
- Manual backup works
- Backup history records local-only or synced state
- Cloud Sync and Devices & Sync remain operational
- Windows installer workflows remain green
- Production checks pass
