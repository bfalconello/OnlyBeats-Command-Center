'use strict';

// OnlyBeats shared application configuration.
// Loaded before app.js as a classic script so existing global references remain compatible.

const VERSION='0.13.1-dashboard-hotfix';
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
const AVAILABILITY_KEY='onlybeats.availability.v1';
const SCORE_REFRESH_TIMEOUT_MS=12000;
const defaultSettings={theme:'midnight',startPage:'dashboard',compact:false,sounds:false,animations:true,refresh:'30',favoriteTeam:'',scoreAlerts:true,favoriteAlerts:true,kickoffAlerts:true,weatherLocation:'',dashboardDensity:'comfortable',pushScoring:'full'};
const defaultWall={status:'all',favoritesOnly:false,top25Only:false,query:''};
const defaultDashboard=['featured','favorites','ranked','predictions','weather','alerts','notes'];

const pages=[['dashboard','⌂','Dashboard'],['briefing','☷','Briefing'],['wall','▦','Saturday Wall'],['watch','◫','Watch Center'],['schedule','◷','Schedule'],['favorites','★','Favorites'],['teams','◈','Team Hub'],['rankings','♛','Rankings'],['news','▤','News'],['weather','☁','Weather'],['availability','♙','Player Availability'],['predictions','✓','Prediction Center'],['reports','▥','Reports'],['developer','⌘','Developer Tools'],['settings','⚙','Settings']];
