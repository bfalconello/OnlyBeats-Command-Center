'use strict';

// OnlyBeats v5.5 Cross-Platform Experience.
// Adds device visibility, sync feedback, snapshots, mobile polish,
// in-app notifications, and coordinated live refresh controls.

let crossPlatformState={
  deviceName:'',
  syncIndicator:true,
  notifySyncSuccess:false,
  notifySyncFailure:true,
  liveRefreshEnabled:true,
  liveRefreshSeconds:30,
  refreshScores:true,
  refreshWeather:true,
  refreshRankings:true,
  refreshAvailability:true,
  mobileBottomNavigation:true,
  compactMobileCards:true,
  reduceMotion:false,
  lastLiveRefreshAt:null,
  lastOpenedAt:null
};

let deviceRegistry=[];
let syncSnapshotHistory=[];
let inAppNotifications=[];
let crossPlatformLiveTimer=null;
let crossPlatformLastQueueCount=0;

function crossPlatformDeviceId(){
  return String(
    crossDeviceState?.deviceId ||
    localStorage.getItem('onlybeats.device-id') ||
    'unknown-device'
  );
}

function defaultDeviceName(){
  const platform=window.onlyBeatsDesktop?'Windows PC':/iphone|ipad|ipod/i.test(navigator.userAgent)?'iPhone or iPad':/android/i.test(navigator.userAgent)?'Android device':'Web device';
  return `${platform} ${crossPlatformDeviceId().slice(-4)}`;
}

function loadCrossPlatformState(){
  try{
    crossPlatformState={
      ...crossPlatformState,
      ...JSON.parse(localStorage.getItem(CROSS_PLATFORM_EXPERIENCE_KEY)||'{}')
    };
  }catch{}

  try{
    const value=JSON.parse(localStorage.getItem(DEVICE_REGISTRY_KEY)||'[]');
    deviceRegistry=Array.isArray(value)?value:[];
  }catch{deviceRegistry=[]}

  try{
    const value=JSON.parse(localStorage.getItem(SYNC_SNAPSHOT_HISTORY_KEY)||'[]');
    syncSnapshotHistory=Array.isArray(value)?value:[];
  }catch{syncSnapshotHistory=[]}

  try{
    const value=JSON.parse(localStorage.getItem(IN_APP_NOTIFICATION_KEY)||'[]');
    inAppNotifications=Array.isArray(value)?value:[];
  }catch{inAppNotifications=[]}

  if(!crossPlatformState.deviceName)crossPlatformState.deviceName=defaultDeviceName();
}

function saveCrossPlatformState(){
  localStorage.setItem(CROSS_PLATFORM_EXPERIENCE_KEY,JSON.stringify(crossPlatformState));
  localStorage.setItem(DEVICE_REGISTRY_KEY,JSON.stringify(deviceRegistry.slice(-50)));
  localStorage.setItem(SYNC_SNAPSHOT_HISTORY_KEY,JSON.stringify(syncSnapshotHistory.slice(-30)));
  localStorage.setItem(IN_APP_NOTIFICATION_KEY,JSON.stringify(inAppNotifications.slice(-200)));
}

function registerCurrentDevice(){
  const id=crossPlatformDeviceId();
  const entry={
    id,
    name:crossPlatformState.deviceName||defaultDeviceName(),
    platform:window.onlyBeatsDesktop?'Windows Desktop':navigator.platform||'Web',
    userAgent:navigator.userAgent,
    appVersion:VERSION,
    online:navigator.onLine,
    lastSeenAt:new Date().toISOString(),
    lastSyncAt:cloudSyncState?.lastSyncAt||null,
    accountId:cloudSyncState?.accountId||''
  };

  deviceRegistry=deviceRegistry.filter(device=>device.id!==id);
  deviceRegistry.push(entry);
  saveCrossPlatformState();
  return entry;
}

function addInAppNotification(type,title,detail='',page=''){
  inAppNotifications.push({
    id:`notice-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    type,
    title,
    detail,
    page,
    createdAt:new Date().toISOString(),
    read:false
  });
  saveCrossPlatformState();
  renderCrossPlatformIndicator();
}

function unreadInAppNotifications(){
  return inAppNotifications.filter(item=>!item.read);
}

function captureSyncSnapshot(label='Automatic snapshot'){
  const snapshot=typeof cloudLocalSnapshot==='function'
    ?cloudLocalSnapshot()
    :{schemaVersion:1,generatedAt:new Date().toISOString(),records:{}};

  syncSnapshotHistory.push({
    id:`snapshot-${Date.now()}`,
    label,
    createdAt:new Date().toISOString(),
    deviceId:crossPlatformDeviceId(),
    accountId:cloudSyncState?.accountId||'',
    recordCount:Object.keys(snapshot.records||{}).length,
    snapshot
  });

  saveCrossPlatformState();
  return syncSnapshotHistory[syncSnapshotHistory.length-1];
}

function restoreSyncSnapshot(snapshotId){
  const entry=syncSnapshotHistory.find(item=>item.id===snapshotId);
  if(!entry?.snapshot)return false;

  cloudObserverSuppressed=true;
  try{
    for(const [key,record] of Object.entries(entry.snapshot.records||{})){
      if(record?.value==null)localStorage.removeItem(key);
      else localStorage.setItem(key,String(record.value));
    }
  }finally{
    cloudObserverSuppressed=false;
  }

  addInAppNotification('restore','Local snapshot restored',entry.label);
  return true;
}

function crossPlatformSyncStatus(){
  if(!navigator.onLine)return{label:'Offline',detail:`${cloudQueue?.length||0} changes queued`,tone:'warn'};
  if(cloudSyncInFlight)return{label:'Syncing',detail:'Cloud operation in progress',tone:'active'};
  if(cloudSyncState?.error)return{label:'Sync issue',detail:cloudSyncState.error,tone:'fail'};
  if(cloudSyncState?.connected)return{
    label:'Synced',
    detail:cloudSyncState.lastSyncAt?`Last sync ${new Date(cloudSyncState.lastSyncAt).toLocaleTimeString()}`:'Connected',
    tone:'pass'
  };
  return{label:'Local only',detail:'Cloud account not connected',tone:'neutral'};
}

function renderCrossPlatformIndicator(){
  if(!crossPlatformState.syncIndicator)return;

  let indicator=document.getElementById('crossPlatformSyncIndicator');
  if(!indicator){
    indicator=document.createElement('button');
    indicator.id='crossPlatformSyncIndicator';
    indicator.className='cross-platform-sync-indicator';
    indicator.onclick=()=>navigate('experience');
    document.body.appendChild(indicator);
  }

  const status=crossPlatformSyncStatus();
  const unread=unreadInAppNotifications().length;
  indicator.className=`cross-platform-sync-indicator ${status.tone}`;
  indicator.innerHTML=`<span class="cross-platform-dot"></span><strong>${esc(status.label)}</strong><small>${esc(status.detail)}</small>${unread?`<b>${unread}</b>`:''}`;
}

function removeCrossPlatformIndicator(){
  document.getElementById('crossPlatformSyncIndicator')?.remove();
}

async function runCrossPlatformLiveRefresh(manual=false){
  if(!navigator.onLine){
    if(manual)addInAppNotification('warning','Live refresh unavailable','The device is offline.');
    return false;
  }

  const feeds=[];
  if(crossPlatformState.refreshScores)feeds.push('scores');
  if(crossPlatformState.refreshWeather)feeds.push('weather');
  if(crossPlatformState.refreshRankings)feeds.push('rankings');
  if(crossPlatformState.refreshAvailability)feeds.push('availability');

  if(!feeds.length)return false;

  try{
    if(typeof runLiveDataCycle==='function'){
      await runLiveDataCycle(feeds);
    }else if(typeof refreshLiveDataPlatform==='function'){
      await refreshLiveDataPlatform();
    }else{
      throw new Error('No live refresh function is available.');
    }

    crossPlatformState.lastLiveRefreshAt=new Date().toISOString();
    saveCrossPlatformState();

    if(manual)addInAppNotification('success','Live data refreshed',feeds.join(', '));
    if(['dashboard','saturday','gamehub','livecommand','experience'].includes(currentPage))renderPage();
    return true;
  }catch(error){
    addInAppNotification('error','Live refresh failed',error?.message||String(error),'platform');
    return false;
  }
}

function startCrossPlatformLiveTimer(){
  clearInterval(crossPlatformLiveTimer);
  if(!crossPlatformState.liveRefreshEnabled)return;

  crossPlatformLiveTimer=setInterval(()=>{
    if(document.hidden||!navigator.onLine)return;
    runCrossPlatformLiveRefresh(false);
  },Math.max(15,Number(crossPlatformState.liveRefreshSeconds)||30)*1000);
}

function monitorCrossPlatformSync(){
  crossPlatformLastQueueCount=cloudQueue?.length||0;

  setInterval(()=>{
    registerCurrentDevice();
    renderCrossPlatformIndicator();

    const queueCount=cloudQueue?.length||0;
    if(crossPlatformLastQueueCount>0&&queueCount===0&&cloudSyncState?.connected){
      captureSyncSnapshot('Post-sync snapshot');
      if(crossPlatformState.notifySyncSuccess){
        addInAppNotification('success','Cloud sync completed','All queued changes were uploaded.');
      }
    }

    if(cloudSyncState?.error&&crossPlatformState.notifySyncFailure){
      const latest=inAppNotifications[inAppNotifications.length-1];
      if(latest?.detail!==cloudSyncState.error){
        addInAppNotification('error','Cloud sync needs attention',cloudSyncState.error,'cloud');
      }
    }

    crossPlatformLastQueueCount=queueCount;
  },3000);
}

function crossPlatformDevicesPanel(){
  if(!deviceRegistry.length)return empty('No registered devices','This device will appear after initialization.');

  return `<div class="intel-list">${deviceRegistry.slice().reverse().map(device=>`
    <div class="intel-row">
      <span class="intel-icon">${device.id===crossPlatformDeviceId()?'●':'○'}</span>
      <div>
        <strong>${esc(device.name)}</strong>
        <small>${esc(device.platform)} · v${esc(device.appVersion)} · last seen ${new Date(device.lastSeenAt).toLocaleString()}</small>
      </div>
      <span class="provider-badge">${device.id===crossPlatformDeviceId()?'THIS DEVICE':'REGISTERED'}</span>
    </div>`).join('')}</div>`;
}

function crossPlatformSnapshotPanel(){
  if(!syncSnapshotHistory.length)return empty('No local sync snapshots','Create a snapshot before testing conflicts or restoration.');

  return `<div class="intel-list">${syncSnapshotHistory.slice().reverse().map(snapshot=>`
    <div class="intel-row">
      <span class="intel-icon">▣</span>
      <div>
        <strong>${esc(snapshot.label)}</strong>
        <small>${new Date(snapshot.createdAt).toLocaleString()} · ${snapshot.recordCount} records</small>
      </div>
      <button class="button" data-restore-cross-snapshot="${snapshot.id}">Restore</button>
    </div>`).join('')}</div>`;
}

function crossPlatformNotificationPanel(){
  if(!inAppNotifications.length)return empty('No notifications','Sync, live refresh, and restore messages will appear here.');

  return `<div class="intel-list">${inAppNotifications.slice().reverse().slice(0,100).map(item=>`
    <div class="intel-row">
      <span class="intel-icon">${item.type==='success'?'✓':item.type==='error'?'×':item.type==='warning'?'△':'•'}</span>
      <div>
        <strong>${esc(item.title)}</strong>
        <small>${new Date(item.createdAt).toLocaleString()}${item.detail?` · ${esc(item.detail)}`:''}</small>
      </div>
      ${item.page?`<button class="button" data-notification-page="${esc(item.page)}">Open</button>`:''}
    </div>`).join('')}</div>`;
}

function crossPlatformExperiencePage(){
  setHeading('Cross-Platform Experience','SMART SYNC · DEVICES · MOBILE · LIVE');

  crossPlatformState.lastOpenedAt=new Date().toISOString();
  registerCurrentDevice();

  const status=crossPlatformSyncStatus();

  return `<section class="cross-platform-hero">
    <div>
      <p class="eyebrow">ONLYBEATS v5.5</p>
      <h1>${esc(status.label)} across your devices.</h1>
      <p>Manage device identity, cloud feedback, local recovery snapshots, mobile behavior, and coordinated live refresh from one place.</p>
    </div>
    <div class="button-row">
      <button class="button primary" id="crossPlatformSyncNow" ${cloudSyncState?.connected?'':'disabled'}>Sync now</button>
      <button class="button" id="crossPlatformRefreshNow">Refresh live data</button>
      <button class="button" id="crossPlatformSnapshot">Create snapshot</button>
    </div>
  </section>

  <div class="metric-grid">
    ${metric('Sync Status',status.label,status.detail)}
    ${metric('This Device',crossPlatformState.deviceName,crossPlatformDeviceId())}
    ${metric('Registered Devices',deviceRegistry.length,'Local registry')}
    ${metric('Pending Queue',cloudQueue?.length||0,'Offline changes')}
    ${metric('Snapshots',syncSnapshotHistory.length,'Local recovery')}
    ${metric('Unread Notices',unreadInAppNotifications().length,'In-app notifications')}
  </div>

  <div class="reports-grid">
    ${card('Device Identity',`<div class="detail-list">
      <label><span>Device name</span><input id="crossPlatformDeviceName" value="${esc(crossPlatformState.deviceName)}"></label>
      <div><span>Device ID</span><strong>${esc(crossPlatformDeviceId())}</strong></div>
      <div><span>Runtime</span><strong>${window.onlyBeatsDesktop?'Windows Desktop':'Web / Mobile'}</strong></div>
      <div><span>Cloud account</span><strong>${esc(cloudSyncState?.accountEmail||'Not connected')}</strong></div>
    </div>`)}

    ${card('Sync Feedback',`<div class="detail-list">
      <label class="toggle-row"><span>Show global sync indicator</span><input id="crossPlatformSyncIndicatorToggle" type="checkbox" ${crossPlatformState.syncIndicator?'checked':''}></label>
      <label class="toggle-row"><span>Notify successful syncs</span><input id="crossPlatformNotifySuccess" type="checkbox" ${crossPlatformState.notifySyncSuccess?'checked':''}></label>
      <label class="toggle-row"><span>Notify sync failures</span><input id="crossPlatformNotifyFailure" type="checkbox" ${crossPlatformState.notifySyncFailure?'checked':''}></label>
      <div><span>Last cloud sync</span><strong>${cloudSyncState?.lastSyncAt?new Date(cloudSyncState.lastSyncAt).toLocaleString():'Never'}</strong></div>
      <div><span>Conflict policy</span><strong>${esc(cloudSyncState?.conflictPolicy||'newest-wins')}</strong></div>
    </div>`)}

    ${card('Live Refresh',`<div class="detail-list">
      <label class="toggle-row"><span>Automatic live refresh</span><input id="crossPlatformLiveEnabled" type="checkbox" ${crossPlatformState.liveRefreshEnabled?'checked':''}></label>
      <label><span>Refresh interval</span><select id="crossPlatformLiveSeconds">${[15,30,60,120,300].map(value=>`<option value="${value}" ${Number(crossPlatformState.liveRefreshSeconds)===value?'selected':''}>${value} seconds</option>`).join('')}</select></label>
      <label class="toggle-row"><span>Scores</span><input id="crossPlatformScores" type="checkbox" ${crossPlatformState.refreshScores?'checked':''}></label>
      <label class="toggle-row"><span>Weather</span><input id="crossPlatformWeather" type="checkbox" ${crossPlatformState.refreshWeather?'checked':''}></label>
      <label class="toggle-row"><span>Rankings</span><input id="crossPlatformRankings" type="checkbox" ${crossPlatformState.refreshRankings?'checked':''}></label>
      <label class="toggle-row"><span>Player availability</span><input id="crossPlatformAvailability" type="checkbox" ${crossPlatformState.refreshAvailability?'checked':''}></label>
      <div><span>Last live refresh</span><strong>${crossPlatformState.lastLiveRefreshAt?new Date(crossPlatformState.lastLiveRefreshAt).toLocaleString():'Never'}</strong></div>
    </div>`)}

    ${card('Mobile Experience',`<div class="detail-list">
      <label class="toggle-row"><span>Mobile bottom navigation</span><input id="crossPlatformBottomNav" type="checkbox" ${crossPlatformState.mobileBottomNavigation?'checked':''}></label>
      <label class="toggle-row"><span>Compact mobile cards</span><input id="crossPlatformCompactCards" type="checkbox" ${crossPlatformState.compactMobileCards?'checked':''}></label>
      <label class="toggle-row"><span>Reduce motion</span><input id="crossPlatformReduceMotion" type="checkbox" ${crossPlatformState.reduceMotion?'checked':''}></label>
      <button class="button" data-page-jump="mobile">Open Mobile Companion</button>
    </div>`)}

    ${card('Registered Devices',crossPlatformDevicesPanel(),'wide')}
    ${card('Local Recovery Snapshots',crossPlatformSnapshotPanel(),'wide')}
    ${card('In-App Notifications',crossPlatformNotificationPanel(),'wide')}

    ${card('Cross-Device Beta Checklist',`<div class="intel-list">
      <div class="intel-row"><span class="intel-icon">1</span><div><strong>Name every device</strong><small>Use names such as Home PC, Laptop, and iPhone.</small></div></div>
      <div class="intel-row"><span class="intel-icon">2</span><div><strong>Create a recovery snapshot</strong><small>Capture local data before deliberate conflict testing.</small></div></div>
      <div class="intel-row"><span class="intel-icon">3</span><div><strong>Test both sync directions</strong><small>Create and edit predictions, favorites, and notes on separate devices.</small></div></div>
      <div class="intel-row"><span class="intel-icon">4</span><div><strong>Test offline recovery</strong><small>Edit while disconnected, reconnect, and inspect the queue and notifications.</small></div></div>
      <div class="intel-row"><span class="intel-icon">5</span><div><strong>Verify live refresh</strong><small>Confirm scores and weather update without manual reload during active games.</small></div></div>
    </div>`,'wide')}
  </div>`;
}

function bindCrossPlatformExperience(){
  const toggle=(id,key,after)=>{
    if($(id))$(id).onchange=event=>{
      crossPlatformState[key]=event.target.checked;
      saveCrossPlatformState();
      after?.();
      renderPage();
    };
  };

  if($('crossPlatformDeviceName'))$('crossPlatformDeviceName').onchange=event=>{
    crossPlatformState.deviceName=event.target.value.trim()||defaultDeviceName();
    registerCurrentDevice();
    renderPage();
  };

  if($('crossPlatformSyncNow'))$('crossPlatformSyncNow').onclick=async()=>{
    captureSyncSnapshot('Before manual sync');
    const pulled=await cloudPullNow();
    const pushed=await cloudPushNow();
    addInAppNotification(
      pulled!==false&&pushed?'success':'error',
      pulled!==false&&pushed?'Manual sync completed':'Manual sync failed',
      cloudSyncState?.error||''
    );
    renderPage();
  };

  if($('crossPlatformRefreshNow'))$('crossPlatformRefreshNow').onclick=async()=>{
    await runCrossPlatformLiveRefresh(true);
    renderPage();
  };

  if($('crossPlatformSnapshot'))$('crossPlatformSnapshot').onclick=()=>{
    captureSyncSnapshot('Manual recovery snapshot');
    addInAppNotification('success','Recovery snapshot created','A local copy is available for restoration.');
    renderPage();
  };

  toggle('crossPlatformSyncIndicatorToggle','syncIndicator',()=>{
    crossPlatformState.syncIndicator?renderCrossPlatformIndicator():removeCrossPlatformIndicator();
  });
  toggle('crossPlatformNotifySuccess','notifySyncSuccess');
  toggle('crossPlatformNotifyFailure','notifySyncFailure');
  toggle('crossPlatformLiveEnabled','liveRefreshEnabled',startCrossPlatformLiveTimer);
  toggle('crossPlatformScores','refreshScores');
  toggle('crossPlatformWeather','refreshWeather');
  toggle('crossPlatformRankings','refreshRankings');
  toggle('crossPlatformAvailability','refreshAvailability');
  toggle('crossPlatformBottomNav','mobileBottomNavigation',applyCrossPlatformClasses);
  toggle('crossPlatformCompactCards','compactMobileCards',applyCrossPlatformClasses);
  toggle('crossPlatformReduceMotion','reduceMotion',applyCrossPlatformClasses);

  if($('crossPlatformLiveSeconds'))$('crossPlatformLiveSeconds').onchange=event=>{
    crossPlatformState.liveRefreshSeconds=Number(event.target.value)||30;
    saveCrossPlatformState();
    startCrossPlatformLiveTimer();
  };

  document.querySelectorAll('[data-restore-cross-snapshot]').forEach(button=>{
    button.onclick=()=>{
      if(!confirm('Restore this local snapshot? Current local values will be replaced.'))return;
      if(restoreSyncSnapshot(button.dataset.restoreCrossSnapshot)){
        setTimeout(()=>location.reload(),200);
      }
    };
  });

  document.querySelectorAll('[data-notification-page]').forEach(button=>{
    button.onclick=()=>{
      inAppNotifications=inAppNotifications.map(item=>({...item,read:true}));
      saveCrossPlatformState();
      navigate(button.dataset.notificationPage);
    };
  });
}

function applyCrossPlatformClasses(){
  document.documentElement.classList.toggle('cross-mobile-bottom-nav',crossPlatformState.mobileBottomNavigation);
  document.documentElement.classList.toggle('cross-mobile-compact-cards',crossPlatformState.compactMobileCards);
  document.documentElement.classList.toggle('cross-reduce-motion',crossPlatformState.reduceMotion);
}

function installCrossPlatformStyles(){
  if(document.getElementById('onlybeatsCrossPlatformStyles'))return;

  const style=document.createElement('style');
  style.id='onlybeatsCrossPlatformStyles';
  style.textContent=`
    .cross-platform-hero{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:30px;margin-bottom:18px;border:1px solid rgba(244,189,69,.28);border-radius:24px;background:radial-gradient(circle at 84% 10%,rgba(244,189,69,.13),transparent 38%),#101822}
    .cross-platform-hero h1{font-size:clamp(2.2rem,5vw,4rem);line-height:1;margin:5px 0 12px}
    .cross-platform-sync-indicator{position:fixed;right:18px;bottom:18px;z-index:5000;display:grid;grid-template-columns:auto auto;column-gap:8px;align-items:center;min-width:220px;padding:11px 14px;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(12,18,27,.96);box-shadow:0 18px 50px rgba(0,0,0,.35);text-align:left}
    .cross-platform-sync-indicator small{grid-column:2;color:#9aabbd}.cross-platform-sync-indicator b{position:absolute;right:-7px;top:-7px;display:grid;place-items:center;min-width:23px;height:23px;padding:0 5px;border-radius:99px;background:#ef5b5b}
    .cross-platform-dot{width:10px;height:10px;border-radius:50%;background:#8b98a8}.cross-platform-sync-indicator.pass .cross-platform-dot{background:#4de191}.cross-platform-sync-indicator.active .cross-platform-dot{background:#f4bd45;animation:crossPulse 1s infinite}.cross-platform-sync-indicator.warn .cross-platform-dot{background:#f4bd45}.cross-platform-sync-indicator.fail .cross-platform-dot{background:#ef5b5b}
    @keyframes crossPulse{50%{opacity:.35;transform:scale(.75)}}
    .cross-reduce-motion *, .cross-reduce-motion *::before, .cross-reduce-motion *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}
    @media(max-width:760px){
      .cross-platform-hero{align-items:flex-start;flex-direction:column;padding:22px}
      .cross-platform-sync-indicator{left:12px;right:12px;bottom:12px;min-width:0}
      .cross-mobile-compact-cards .card{padding:14px;border-radius:14px}
      .cross-mobile-compact-cards .metric-grid .metric{padding:14px}
      .cross-mobile-bottom-nav #nav{position:fixed;left:0;right:0;bottom:0;z-index:4500;display:flex!important;overflow-x:auto;padding:8px 10px calc(8px + env(safe-area-inset-bottom));background:rgba(7,11,17,.97);border-top:1px solid rgba(255,255,255,.09)}
      .cross-mobile-bottom-nav #nav>*{flex:0 0 auto}
      .cross-mobile-bottom-nav .content{padding-bottom:110px}
      .cross-mobile-bottom-nav .cross-platform-sync-indicator{bottom:80px}
    }
  `;
  document.head.appendChild(style);
}

function initializeCrossPlatformExperience(){
  loadCrossPlatformState();
  installCrossPlatformStyles();
  applyCrossPlatformClasses();
  registerCurrentDevice();
  renderCrossPlatformIndicator();
  startCrossPlatformLiveTimer();
  monitorCrossPlatformSync();
}
