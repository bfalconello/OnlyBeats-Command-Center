# OnlyBeats v2.1 — Cloud Sync Foundation, Phase 1

## Added
- Dedicated Cloud Sync page
- Cloud-provider adapter boundary
- Firebase configuration template
- Offline change queue
- Push and pull workflows
- Automatic-sync control
- Conflict policies: newest wins, local wins, or cloud wins
- Cloud activity log and network recovery hook

## Capability boundary
Remote synchronization is not active until a Firebase or compatible backend, authentication, security rules, and `window.ONLYBEATS_CLOUD_ADAPTER` are configured. No credentials or pretend cloud service are included.
