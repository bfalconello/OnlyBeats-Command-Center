'use strict';

// Defensive local-storage readers shared by the application.

function load(k,d){try{const raw=localStorage.getItem(k);if(!raw)return Array.isArray(d)?[...d]:{...d};const parsed=JSON.parse(raw);return Array.isArray(d)?(Array.isArray(parsed)?parsed:[...d]):{...d,...parsed}}catch{return Array.isArray(d)?[...d]:{...d}}}
function loadSettings(){const current=localStorage.getItem(STORAGE_KEY);if(current)return load(STORAGE_KEY,defaultSettings);const legacy=localStorage.getItem(LEGACY_STORAGE_KEY);if(legacy){try{const migrated={...defaultSettings,...JSON.parse(legacy),startPage:'wall'};localStorage.setItem(STORAGE_KEY,JSON.stringify(migrated));return migrated}catch{}}return {...defaultSettings}}
