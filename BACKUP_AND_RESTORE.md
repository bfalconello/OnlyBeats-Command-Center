# Backup and Restore

## Browser preview

Open Settings and select **Export settings**. Store the JSON file somewhere outside the release folder.

## Native application

The native database is designed to live in the Windows application-data directory under the app identifier `com.onlybeats.commandcenter`. Before later upgrades, close the app and copy `onlybeats.db` to a safe location.

Release 0.2.1 contains no live football history. The database currently scaffolds migrations, preferences, favorites, and application events.
