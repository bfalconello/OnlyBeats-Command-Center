'use strict';

// OnlyBeats v2.7 Cloud Platform — Phase 1.
// Account-ready orchestration without storing passwords or embedding private credentials.

let cloudPlatformState={
  profileName:'',
  profileEmail:'',
  accountId:'',
  accountStatus:'Local profile',
  preferredBackupCadence:'daily',
  automaticBackup:true,
  backupOnExit:false,
  syncOnStartup:true,
  trustedDeviceOnly:true,
  lastAutomaticBackupAt:null,
  lastSessionRefreshAt:null
};

let cloudDeviceSessions=[];
let cloudBackupHistory=[];
let cloudPlatformTimer=null;

function loadCloudPlatformState(){
  try{
    cloudPlatformState={
      ...cloudPlatformState,
      ...JSON.parse(localStorage.getItem(CLOUD_PLATFORM_KEY)||'{}')
    };
  }catch{}

  try{
    const rows=JSON.parse(localStorage.getItem(CLOUD_DEVICE_SESSIONS_KEY)||'[]');
    cloudDeviceSessions=Array.isArray(rows)?rows:[];
  }catch{
    cloudDeviceSessions=[];
  }

  try{
    const rows=JSON.parse(localStorage.getItem(CLOUD_BACKUP_HISTORY_KEY)||'[]');
    cloudBackupHistory=Array.isArray(rows)?rows:[];
  }catch{
    cloudBackupHistory=[];
  }
}

function saveCloudPlatformState(){
  localStorage.setItem(CLOUD_PLATFORM_KEY,JSON.stringify(cloudPlatformState));
  localStorage.setItem(CLOUD_DEVICE_SESSIONS_KEY,JSON.stringify(cloudDeviceSessions.slice(-100)));
  localStorage.setItem(CLOUD_BACKUP_HISTORY_KEY,JSON.stringify(cloudBackupHistory.slice(-200)));
}

function cloudPlatformAdapter(){
  return typeof createCloudAdapter==='function'?createCloudAdapter():null;
}

function cloudAccountConnected(){
  return Boolean(cloudSyncState?.connected&&cloudSyncState?.accountId);
}

function cloudPlatformCurrentDevice(){
  return {
    id:crossDeviceState?.deviceId||'unknown-device',
    name:crossDeviceState?.deviceName||'OnlyBeats Device',
    platform:navigator.platform||'Unknown',
    userAgent:navigator.userAgent,
    lastSeenAt:new Date().toISOString(),
    trusted:true,
    current:true
  };
}

function refreshCloudDeviceSession(){
  const current=cloudPlatformCurrentDevice();
  const index=cloudDeviceSessions.findIndex(session=>session.id===current.id);

  if(index>=0){
    cloudDeviceSessions.splice(index,1,{...cloudDeviceSessions[index],...current});
  }else{
    cloudDeviceSessions.push(current);
  }

  cloudPlatformState.lastSessionRefreshAt=new Date().toISOString();
  saveCloudPlatformState();
}

function recordCloudBackup(type='automatic',status='created'){
  const snapshot=typeof cloudLocalSnapshot==='function'?cloudLocalSnapshot():{records:{}};
  const record={
    id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    time:new Date().toISOString(),
    type,
    status,
    version:VERSION,
    deviceId:crossDeviceState?.deviceId||'unknown-device',
    deviceName:crossDeviceState?.deviceName||'OnlyBeats Device',
    keys:Object.keys(snapshot.records||{}).length,
    predictions:predictions.length,
    favorites:favorites.length,
    archives:seasonArchives.length
  };
  cloudBackupHistory.push(record);
  saveCloudPlatformState();
  return record;
}

async function createCloudPlatformBackup(type='manual'){
  const record=recordCloudBackup(type,'queued');

  if(cloudAccountConnected()&&typeof cloudPushNow==='function'){
    const success=await cloudPushNow();
    record.status=success?'synced':'local-only';
    if(success)cloudPlatformState.lastAutomaticBackupAt=new Date().toISOString();
  }else{
    record.status='local-only';
    if(typeof downloadDeviceSnapshot==='function'){
      downloadDeviceSnapshot();
    }
  }

  saveCloudPlatformState();
  return record;
}

function cloudBackupDue(){
  if(!cloudPlatformState.automaticBackup)return false;
  if(!cloudPlatformState.lastAutomaticBackupAt)return true;

  const previous=new Date(cloudPlatformState.lastAutomaticBackupAt).getTime();
  const elapsed=Date.now()-previous;
  const intervals={
    hourly:60*60*1000,
    daily:24*60*60*1000,
    weekly:7*24*60*60*1000
  };
  return elapsed>=(intervals[cloudPlatformState.preferredBackupCadence]||intervals.daily);
}

async function runAutomaticCloudBackup(){
  if(!cloudBackupDue()||!navigator.onLine)return false;
  const record=await createCloudPlatformBackup('automatic');
  cloudPlatformState.lastAutomaticBackupAt=new Date().toISOString();
  saveCloudPlatformState();

  if(currentPage==='account')renderPage();
  return record;
}

function cloudPlatformReadiness(){
  const adapter=cloudPlatformAdapter();
  return [
    {name:'Cloud adapter available',ok:Boolean(adapter?.configured),detail:adapter?.name||'No backend adapter'},
    {name:'Account connected',ok:cloudAccountConnected(),detail:cloudSyncState?.accountEmail||'Not signed in'},
    {name:'Offline queue available',ok:Array.isArray(cloudQueue),detail:`${cloudQueue?.length||0} pending changes`},
    {name:'Conflict policy configured',ok:Boolean(cloudSyncState?.conflictPolicy),detail:cloudSyncState?.conflictPolicy||'Not set'},
    {name:'Current device registered',ok:cloudDeviceSessions.some(session=>session.current),detail:crossDeviceState?.deviceName||'Unknown device'},
    {name:'Automatic backup enabled',ok:cloudPlatformState.automaticBackup,detail:cloudPlatformState.preferredBackupCadence},
    {name:'Private credentials embedded',ok:false,detail:'No private credentials included'},
    {name:'Remote notifications active',ok:false,detail:'Requires backend messaging configuration'}
  ];
}

function cloudPlatformBackupRows(){
  if(!cloudBackupHistory.length){
    return empty('No cloud backup history','Create a backup to begin recording history.');
  }

  return `<div class="intel-list">${cloudBackupHistory.slice().reverse().slice(0,100).map(item=>`
    <div class="intel-row">
      <span class="intel-icon">${item.status==='synced'?'✓':item.status==='local-only'?'•':'↻'}</span>
      <div>
        <strong>${esc(item.type==='automatic'?'Automatic backup':'Manual backup')}</strong>
        <small>${new Date(item.time).toLocaleString()} · ${esc(item.status)} · ${item.keys} data keys · ${item.predictions} predictions</small>
      </div>
      <span class="provider-badge">${esc(item.status.toUpperCase())}</span>
    </div>`).join('')}</div>`;
}

function cloudPlatformDeviceRows(){
  if(!cloudDeviceSessions.length){
    return empty('No device sessions','The current installation will register automatically.');
  }

  return `<div class="intel-list">${cloudDeviceSessions.slice().reverse().map(session=>`
    <div class="intel-row">
      <span class="intel-icon">${session.current?'●':'○'}</span>
      <div>
        <strong>${esc(session.name)}</strong>
        <small>${esc(session.platform)} · Last seen ${new Date(session.lastSeenAt).toLocaleString()} · ${session.trusted?'Trusted':'Untrusted'}</small>
      </div>
      <div class="button-row">
        <span class="provider-badge">${session.current?'CURRENT':session.trusted?'TRUSTED':'REVIEW'}</span>
        ${session.current?'':`<button class="button" data-revoke-device="${session.id}">Remove</button>`}
      </div>
    </div>`).join('')}</div>`;
}

function accountDevicesPage(){
  setHeading('Account & Devices','PROFILE · SESSIONS · AUTOMATIC BACKUP');
  const checks=cloudPlatformReadiness();
  const passed=checks.filter(check=>check.ok).length;
  const current=cloudPlatformCurrentDevice();

  return `<section class="intel-hero">
    <div>
      <p class="eyebrow">ONLYBEATS CLOUD PLATFORM</p>
      <h2>${cloudAccountConnected()?'Your cloud account is connected.':'Your local account profile is ready for a backend.'}</h2>
      <p>Manage the account-ready profile, trusted devices, automatic backups, sync preferences, and cloud readiness from one place.</p>
    </div>
    <div class="button-row">
      <button class="button primary" id="cloudPlatformBackupNow">Back up now</button>
      <button class="button" data-page-jump="cloud">Open Cloud Sync</button>
      <button class="button" data-page-jump="devices">Open Devices & Sync</button>
    </div>
  </section>

  <div class="metric-grid">
    ${metric('Account Status',cloudAccountConnected()?'Connected':'Local profile',cloudSyncState?.accountEmail||cloudPlatformState.profileEmail||'No email connected')}
    ${metric('Trusted Devices',cloudDeviceSessions.filter(session=>session.trusted).length,`${cloudDeviceSessions.length} known sessions`)}
    ${metric('Backup Cadence',cloudPlatformState.automaticBackup?cloudPlatformState.preferredBackupCadence:'Off','Automatic backup')}
    ${metric('Pending Sync',cloudQueue?.length||0,'Offline queue')}
    ${metric('Readiness',`${passed}/${checks.length}`,'Honest capability checks')}
    ${metric('Current Device',current.name,current.platform)}
  </div>

  <div class="reports-grid">
    ${card('Account Profile',`<div class="detail-list">
      <label><span>Profile name</span><input id="cloudProfileName" value="${esc(cloudPlatformState.profileName)}" placeholder="Your name"></label>
      <label><span>Profile email</span><input id="cloudProfileEmail" type="email" value="${esc(cloudPlatformState.profileEmail)}" placeholder="you@example.com"></label>
      <div><span>Connected account</span><strong>${esc(cloudSyncState?.accountEmail||'Not connected')}</strong></div>
      <div><span>Account ID</span><strong class="device-code">${esc(cloudSyncState?.accountId||'Not assigned')}</strong></div>
      <div><span>Authentication</span><strong>${cloudAccountConnected()?'Provider managed':'Not active'}</strong></div>
    </div>
    <button class="button primary" id="saveCloudProfile">Save local profile</button>`)}

    ${card('Automatic Backup',`<div class="detail-list">
      <label class="toggle-row"><span>Enable automatic backup</span><input type="checkbox" id="cloudAutomaticBackup" ${cloudPlatformState.automaticBackup?'checked':''}></label>
      <label><span>Backup cadence</span>
        <select id="cloudBackupCadence">
          <option value="hourly" ${cloudPlatformState.preferredBackupCadence==='hourly'?'selected':''}>Hourly</option>
          <option value="daily" ${cloudPlatformState.preferredBackupCadence==='daily'?'selected':''}>Daily</option>
          <option value="weekly" ${cloudPlatformState.preferredBackupCadence==='weekly'?'selected':''}>Weekly</option>
        </select>
      </label>
      <label class="toggle-row"><span>Sync on application startup</span><input type="checkbox" id="cloudSyncStartup" ${cloudPlatformState.syncOnStartup?'checked':''}></label>
      <label class="toggle-row"><span>Require trusted device</span><input type="checkbox" id="cloudTrustedOnly" ${cloudPlatformState.trustedDeviceOnly?'checked':''}></label>
      <div><span>Last automatic backup</span><strong>${cloudPlatformState.lastAutomaticBackupAt?new Date(cloudPlatformState.lastAutomaticBackupAt).toLocaleString():'Never'}</strong></div>
    </div>`)}

    ${card('Cloud Readiness',`<div class="release-status-list">${checks.map(check=>`
      <div class="release-status-row ${check.ok?'quality-pass':'quality-warn'}">
        <span>${check.ok?'✓':'△'} ${esc(check.name)}<small>${esc(check.detail)}</small></span>
        <strong>${check.ok?'READY':'PENDING'}</strong>
      </div>`).join('')}</div>`,'wide')}

    ${card('Trusted Devices',cloudPlatformDeviceRows(),'wide')}
    ${card('Backup History',cloudPlatformBackupRows(),'wide')}

    ${card('Security Boundary',`<div class="intel-list">
      <div class="intel-row"><span class="intel-icon">✓</span><div><strong>No passwords stored by OnlyBeats</strong><small>Authentication must be handled by the connected identity provider.</small></div></div>
      <div class="intel-row"><span class="intel-icon">✓</span><div><strong>No private server credentials included</strong><small>Browser configuration remains separate from protected server secrets.</small></div></div>
      <div class="intel-row"><span class="intel-icon">△</span><div><strong>Cloud database rules required</strong><small>Remote data must remain unavailable until account isolation rules are configured and tested.</small></div></div>
      <div class="intel-row"><span class="intel-icon">△</span><div><strong>Remote push requires backend messaging</strong><small>Desktop notifications remain local until messaging is configured.</small></div></div>
    </div>`,'wide')}
  </div>`;
}

function bindAccountDevices(){
  if($('saveCloudProfile'))$('saveCloudProfile').onclick=()=>{
    cloudPlatformState.profileName=$('cloudProfileName')?.value.trim().slice(0,80)||'';
    cloudPlatformState.profileEmail=$('cloudProfileEmail')?.value.trim().slice(0,160)||'';
    saveCloudPlatformState();
    toast('Local account profile saved','success');
    renderPage();
  };

  if($('cloudPlatformBackupNow'))$('cloudPlatformBackupNow').onclick=async()=>{
    const button=$('cloudPlatformBackupNow');
    button.disabled=true;
    button.textContent='Creating backup…';
    const record=await createCloudPlatformBackup('manual');
    toast(record.status==='synced'?'Cloud backup completed':'Local device backup completed','success');
    renderPage();
  };

  if($('cloudAutomaticBackup'))$('cloudAutomaticBackup').onchange=event=>{
    cloudPlatformState.automaticBackup=event.target.checked;
    saveCloudPlatformState();
    startCloudPlatformScheduler();
  };

  if($('cloudBackupCadence'))$('cloudBackupCadence').onchange=event=>{
    cloudPlatformState.preferredBackupCadence=event.target.value;
    saveCloudPlatformState();
    startCloudPlatformScheduler();
    toast('Backup cadence updated');
  };

  if($('cloudSyncStartup'))$('cloudSyncStartup').onchange=event=>{
    cloudPlatformState.syncOnStartup=event.target.checked;
    saveCloudPlatformState();
  };

  if($('cloudTrustedOnly'))$('cloudTrustedOnly').onchange=event=>{
    cloudPlatformState.trustedDeviceOnly=event.target.checked;
    saveCloudPlatformState();
  };

  document.querySelectorAll('[data-revoke-device]').forEach(button=>{
    button.onclick=()=>{
      cloudDeviceSessions=cloudDeviceSessions.filter(session=>session.id!==button.dataset.revokeDevice);
      saveCloudPlatformState();
      renderPage();
      toast('Device session removed');
    };
  });
}

function startCloudPlatformScheduler(){
  clearInterval(cloudPlatformTimer);
  if(!cloudPlatformState.automaticBackup)return;

  cloudPlatformTimer=setInterval(()=>{
    if(!document.hidden&&navigator.onLine){
      runAutomaticCloudBackup();
    }
  },15*60*1000);
}

function initializeCloudPlatform(){
  loadCloudPlatformState();
  refreshCloudDeviceSession();
  startCloudPlatformScheduler();

  window.addEventListener('online',()=>{
    refreshCloudDeviceSession();
    if(cloudPlatformState.automaticBackup)runAutomaticCloudBackup();
  });

  if(cloudPlatformState.syncOnStartup&&cloudAccountConnected()&&typeof cloudPullNow==='function'){
    setTimeout(()=>cloudPullNow(),2500);
  }
}
