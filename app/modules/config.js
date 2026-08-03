'use strict';

// OnlyBeats shared application configuration.
// Loaded before app.js as a classic script so existing global references remain compatible.

const VERSION='3.0.1';
const STORAGE_KEY='onlybeats.settings.v7';
const LEGACY_STORAGE_KEY='onlybeats.settings.v6';
const FAVORITES_KEY='onlybeats.favorites.v1';
const WALL_KEY='onlybeats.wall.v1';
const DASHBOARD_KEY='onlybeats.dashboard.v1';
const NOTES_KEY='onlybeats.notes.v1';
const PREDICTIONS_KEY='onlybeats.predictions.v1';
const FUTURES_KEY='onlybeats.futures.v1';
const FUTURES_LOCK_KEY='onlybeats.futures.lock.v1';
const SCORE_CACHE_KEY='onlybeats.scoreboard.cache.v1';
const WATCH_KEY='onlybeats.watch-center.v1';
const TIMELINE_KEY='onlybeats.timeline.v1';
const SEASON_ARCHIVE_KEY='onlybeats.season-archive.v1';
const REFRESH_HISTORY_KEY='onlybeats.refresh-history.v1';
const LIVE_ALERTS_KEY='onlybeats.live-alerts.v1';
const LIVE_ALERT_PREFS_KEY='onlybeats.live-alert-prefs.v1';
const COMMAND_CENTER_KEY='onlybeats.command-center.v2';
const DESKTOP_STATE_KEY='onlybeats.desktop-state.v1';
const CROSS_DEVICE_KEY='onlybeats.cross-device.v1';
const CLOUD_SYNC_KEY='onlybeats.cloud-sync.v1';
const CLOUD_QUEUE_KEY='onlybeats.cloud-queue.v1';
const CLOUD_ACTIVITY_KEY='onlybeats.cloud-activity.v1';
const LIVE_DATA_PLATFORM_KEY='onlybeats.live-data-platform.v1';
const LIVE_DATA_ACTIVITY_KEY='onlybeats.live-data-activity.v1';
const DESKTOP_RELEASE_KEY='onlybeats.desktop-release.v1';
const WINDOWS_EXPERIENCE_KEY='onlybeats.windows-experience.v1';
const BACKUP_HISTORY_KEY='onlybeats.backup-history.v1';
const CLOUD_PLATFORM_KEY='onlybeats.cloud-platform.v1';
const CLOUD_DEVICE_SESSIONS_KEY='onlybeats.cloud-device-sessions.v1';
const CLOUD_BACKUP_HISTORY_KEY='onlybeats.cloud-backup-history.v1';
const PREDICTION_COMBOS_KEY='onlybeats.prediction-combos.v1';
const PREDICTION_COMBO_DRAFT_KEY='onlybeats.prediction-combo-draft.v1';
const PREDICTION_LAB_KEY='onlybeats.prediction-lab.v1';
const LIVE_COMMAND_CENTER_KEY='onlybeats.live-command-center.v1';
const LIVE_COMMAND_ALERTS_KEY='onlybeats.live-command-alerts.v1';
const PUBLIC_RELEASE_KEY='onlybeats.public-release.v1';
const RELEASE_NOTES_SEEN_KEY='onlybeats.release-notes-seen.v1';
const AVAILABILITY_KEY='onlybeats.availability.v1';
const SCORE_REFRESH_TIMEOUT_MS=12000;
const defaultSettings={theme:'midnight',startPage:'dashboard',compact:false,sounds:false,animations:true,refresh:'30',favoriteTeam:'',scoreAlerts:true,favoriteAlerts:true,kickoffAlerts:true,weatherLocation:'',dashboardDensity:'comfortable',pushScoring:'full',highContrast:false,largeText:false,performanceMode:false};
const defaultWall={status:'all',favoritesOnly:false,top25Only:false,query:''};
const defaultDashboard=['featured','favorites','ranked','predictions','weather','alerts','notes'];

const pages=[['dashboard','⌂','Dashboard'],['launch','⬢','Release Hub'],['briefing','☷','Briefing'],['timeline','≋','Timeline'],['archive','▣','Season Archive'],['analytics','▥','Analytics Center'],['datahealth','⌁','Data Health'],['performance','⚡','Performance'],['alerts','⚠','Live Alerts'],['mission','⌘','Mission Control'],['about','ⓘ','About & Storage'],['quality','◎','UI Quality'],['insights','✦','Smart Insights'],['gameday','◉','GameDay Command'],['livecommand','◈','Live Command Center'],['devices','▱','Devices & Sync'],['cloud','☁','Cloud Sync'],['account','◉','Account & Devices'],['platform','⌁','Live Data Platform'],['release','⬡','Desktop Release'],['windows','◆','Windows Experience'],['wall','▦','Saturday Wall'],['watch','◫','Watch Center'],['gamehub','◇','Game Hub'],['schedule','◷','Schedule'],['favorites','★','Favorites'],['teams','◈','Team Hub'],['rankings','♛','Rankings'],['news','▤','News'],['weather','☁','Weather'],['availability','♙','Player Availability'],['predictions','✓','Prediction Center'],['lab','◇','Prediction Lab'],['reports','▥','Reports'],['developer','⌘','Developer Tools'],['settings','⚙','Settings']];
