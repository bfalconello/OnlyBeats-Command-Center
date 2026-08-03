'use strict';

// OnlyBeats v1.6.1 Professional Desktop Experience.

let desktopState={
  lastPage:'dashboard',
  sidebarScrollTop:0,
  mainScrollTop:0,
  notificationFallback:true,
  lastOpenedAt:null
};

function loadDesktopState(){
  try{
    const saved=JSON.parse(localStorage.getItem(DESKTOP_STATE_KEY)||'{}');
    desktopState={...desktopState,...saved};
  }catch{}
}

function saveDesktopState(){
  try{
    localStorage.setItem(DESKTOP_STATE_KEY,JSON.stringify(desktopState));
  }catch{}
}

function desktopStorageEntries(){
  const rows=[];
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(!key)continue;
    const value=localStorage.getItem(key)||'';
    rows.push({key,size:new Blob([value]).size,value});
  }
  return rows.sort((a,b)=>b.size-a.size);
}

function desktopStorageSummary(){
  const rows=desktopStorageEntries();
  const total=rows.reduce((sum,row)=>sum+row.size,0);
  return {rows,total,count:rows.length};
}

function formatDesktopBytes(bytes){
  if(bytes<1024)return `${bytes} B`;
  if(bytes<1024*1024)return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/(1024*1024)).toFixed(2)} MB`;
}

function notificationStatus(){
  if(!('Notification' in window)){
    return {
      state:'unsupported',
      label:'Unsupported',
      detail:'This environment does not expose the desktop Notification API.',
      canRequest:false
    };
  }

  if(Notification.permission==='granted'){
    return {
      state:'enabled',
      label:'Enabled',
      detail:'OnlyBeats can send desktop notifications.',
      canRequest:false
    };
  }

  if(Notification.permission==='denied'){
    return {
      state:'blocked',
      label:'Blocked',
      detail:'Notifications are blocked by the browser, desktop shell, or Windows settings.',
      canRequest:false
    };
  }

  return {
    state:'permission',
    label:'Permission required',
    detail:'Enable notifications to receive Mission Control alerts outside the app.',
    canRequest:true
  };
}

function showInAppNotification(title,body){
  toast(`${title}: ${body}`,'info');
  addLiveAlert({
    type:'system',
    severity:'info',
    title,
    detail:body,
    sourceKey:`desktop-fallback|${title}|${new Date().toISOString().slice(0,16)}`
  });
}

async function sendDesktopOrFallbackNotification(title,body){
  const status=notificationStatus();

  if(status.state==='enabled'){
    try{
      new Notification(title,{body,icon:'assets/onlybeats-icon.png'});
      return 'desktop';
    }catch{}
  }

  if(desktopState.notificationFallback){
    showInAppNotification(title,body);
    return 'in-app';
  }

  return 'none';
}

async function requestDesktopNotificationPermission(){
  const status=notificationStatus();

  if(status.state==='unsupported'){
    showInAppNotification('Notifications unavailable','OnlyBeats will use in-app alerts instead.');
    return false;
  }

  if(status.state==='blocked'){
    showInAppNotification(
      'Desktop notifications blocked',
      'Enable notifications for OnlyBeats in Windows or browser settings. In-app alerts remain active.'
    );
    return false;
  }

  if(status.state==='enabled')return true;

  try{
    const permission=await Notification.requestPermission();
    if(permission==='granted'){
      await sendDesktopOrFallbackNotification('OnlyBeats','Desktop notifications are enabled.');
      return true;
    }
  }catch{}

  showInAppNotification('Notification permission not granted','OnlyBeats will continue using in-app alerts.');
  return false;
}

function desktopBundlePayload(){
  const storage={};
  for(const row of desktopStorageEntries()){
    storage[row.key]=row.value;
  }

  return {
    format:'OnlyBeats Unified Bundle',
    bundleVersion:1,
    generatedAt:new Date().toISOString(),
    appVersion:VERSION,
    channel:onlyBeatsVersionChannel(VERSION),
    counts:{
      games:games.length,
      predictions:predictions.length,
      futures:futures.length,
      favorites:favorites.length,
      availability:availabilityEntries.length,
      archives:seasonArchives.length,
      alerts:liveAlerts.length,
      timeline:timelineEvents.length
    },
    storage
  };
}

function exportOnlyBeatsBundle(){
  const payload=desktopBundlePayload();
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/x-onlybeats+json'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=`onlybeats-${VERSION}-${new Date().toISOString().slice(0,10)}.onlybeats`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function validateOnlyBeatsBundle(payload){
  if(!payload||payload.format!=='OnlyBeats Unified Bundle'){
    throw new Error('This is not an OnlyBeats unified bundle.');
  }
  if(payload.bundleVersion!==1){
    throw new Error(`Unsupported bundle version: ${payload.bundleVersion}`);
  }
  if(!payload.storage||typeof payload.storage!=='object'||Array.isArray(payload.storage)){
    throw new Error('Bundle storage data is missing.');
  }
  return true;
}

function importOnlyBeatsBundle(){
  const input=document.createElement('input');
  input.type='file';
  input.accept='.onlybeats,application/json';
  input.onchange=async()=>{
    const file=input.files?.[0];
    if(!file)return;

    try{
      const payload=JSON.parse(await file.text());
      validateOnlyBeatsBundle(payload);

      if(!confirm(`Restore ${Object.keys(payload.storage).length} saved entries from this bundle? Matching local data will be replaced.`)){
        return;
      }

      for(const [key,value] of Object.entries(payload.storage)){
        if(value===null||value===undefined)continue;
        localStorage.setItem(key,String(value));
      }

      sessionStorage.clear();
      alert('OnlyBeats bundle restored successfully. The app will reload now.');
      location.reload();
    }catch(error){
      toast(error?.message||'Bundle restore failed','error');
    }
  };
  input.click();
}

function installDesktopExperienceStyles(){
  if(document.getElementById('onlybeatsDesktopStyles'))return;

  const style=document.createElement('style');
  style.id='onlybeatsDesktopStyles';
  style.textContent=`
    .desktop-status-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .desktop-status-item{padding:14px;border:1px solid rgba(255,255,255,.09);border-radius:12px}
    .desktop-status-item span{display:block;color:#9aabbd;font-size:.86rem;margin-bottom:5px}
    .desktop-storage-list{display:grid;gap:8px;max-height:420px;overflow:auto}
    .desktop-storage-row{display:flex;justify-content:space-between;gap:16px;padding:10px 12px;border:1px solid rgba(255,255,255,.08);border-radius:10px}
    .notification-state-enabled{border-color:rgba(84,190,120,.45)!important}
    .notification-state-permission{border-color:rgba(244,189,69,.45)!important}
    .notification-state-blocked{border-color:rgba(220,80,80,.45)!important}
    .notification-state-unsupported{border-color:rgba(150,160,175,.4)!important}
    @media(max-width:760px){.desktop-status-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function installDesktopNavigationPersistence(){
  if(typeof navigate==='function'&&!navigate.__desktopWrapped){
    const original=navigate;
    const wrapped=function(page){
      desktopState.lastPage=page;
      saveDesktopState();
      return original(page);
    };
    wrapped.__desktopWrapped=true;
    navigate=wrapped;
  }

  const nav=document.getElementById('nav');
  if(nav){
    nav.scrollTop=desktopState.sidebarScrollTop||0;
    nav.addEventListener('scroll',()=>{
      desktopState.sidebarScrollTop=nav.scrollTop;
      saveDesktopState();
    },{passive:true});
  }

  const main=document.querySelector('main');
  if(main){
    main.scrollTop=desktopState.mainScrollTop||0;
    main.addEventListener('scroll',()=>{
      desktopState.mainScrollTop=main.scrollTop;
      saveDesktopState();
    },{passive:true});
  }

  window.addEventListener('beforeunload',()=>{
    desktopState.lastPage=currentPage;
    desktopState.lastOpenedAt=new Date().toISOString();
    saveDesktopState();
  });
}

function aboutStoragePage(){
  setHeading('About & Storage','VERSION · NOTIFICATIONS · EXPORT');
  const notification=notificationStatus();
  const storage=desktopStorageSummary();
  const startup=typeof getRc2StartupMetric==='function'?getRc2StartupMetric():null;
  const health=typeof providerHealthSummary==='function'?providerHealthSummary():null;

  return `<section class="intel-hero">
    <div>
      <p class="eyebrow">ONLYBEATS COMMAND CENTER</p>
      <h2>Version ${esc(VERSION)} · ${esc(onlyBeatsVersionChannel(VERSION))}</h2>
      <p>Review application status, notification permissions, local storage usage, startup metrics, and unified backup tools.</p>
    </div>
    <div class="button-row">
      <button class="button primary" id="exportOnlyBeatsBundle">Export .onlybeats bundle</button>
      <button class="button" id="importOnlyBeatsBundle">Restore bundle</button>
      <button class="button" id="runAboutProductionChecks">Run production checks</button>
    </div>
  </section>

  <div class="metric-grid">
    ${metric('Version',VERSION,onlyBeatsVersionChannel(VERSION))}
    ${metric('Storage Used',formatDesktopBytes(storage.total),`${storage.count} local entries`)}
    ${metric('Predictions',predictions.length,`${futures.length} futures`)}
    ${metric('Archives',seasonArchives.length,`${timelineEvents.length} timeline events`)}
    ${metric('Startup Time',startup?`${startup.duration.toFixed(0)} ms`:'Pending','Current session')}
    ${metric('Provider',health?.overall||'Unknown',health?.freshness?.label||'No health data')}
  </div>

  <div class="reports-grid">
    ${card('Notification Manager',`<div class="desktop-status-item notification-state-${notification.state}">
      <span>Current status</span>
      <strong>${esc(notification.label)}</strong>
      <p class="muted">${esc(notification.detail)}</p>
      <div class="button-row">
        <button class="button primary" id="requestDesktopNotifications" ${notification.canRequest?'':'disabled'}>Request permission</button>
        <button class="button" id="testDesktopNotification">Test notification</button>
        <label class="toggle-row"><span>Use in-app fallback</span><input type="checkbox" id="desktopFallbackToggle" ${desktopState.notificationFallback?'checked':''}></label>
      </div>
    </div>`)}

    ${card('Application Status',`<div class="desktop-status-grid">
      <div class="desktop-status-item"><span>Database schema</span><strong>1</strong></div>
      <div class="desktop-status-item"><span>Current page</span><strong>${esc(currentPage)}</strong></div>
      <div class="desktop-status-item"><span>Games loaded</span><strong>${games.length}</strong></div>
      <div class="desktop-status-item"><span>Favorites</span><strong>${favorites.length}</strong></div>
      <div class="desktop-status-item"><span>Alerts</span><strong>${liveAlerts.length}</strong></div>
      <div class="desktop-status-item"><span>Last opened</span><strong>${desktopState.lastOpenedAt?new Date(desktopState.lastOpenedAt).toLocaleString():'This session'}</strong></div>
    </div>`)}

    ${card('Local Storage Usage',`<div class="desktop-storage-list">
      ${storage.rows.length?storage.rows.map(row=>`<div class="desktop-storage-row"><span>${esc(row.key)}</span><strong>${formatDesktopBytes(row.size)}</strong></div>`).join(''):empty('No local data','No OnlyBeats local storage entries were found.')}
    </div>`,'wide')}

    ${card('Unified Export Bundle',`<div class="intel-list">
      <div class="intel-row"><span class="intel-icon">✓</span><div><strong>One file</strong><small>Exports settings, predictions, favorites, archives, alerts, availability notes, and other saved local data.</small></div></div>
      <div class="intel-row"><span class="intel-icon">✓</span><div><strong>Validated restore</strong><small>Only recognized OnlyBeats bundle files are accepted.</small></div></div>
      <div class="intel-row"><span class="intel-icon">✓</span><div><strong>Portable</strong><small>Use the bundle to move local data between OnlyBeats installations.</small></div></div>
    </div>`,'wide')}
  </div>`;
}

function bindAboutStorage(){
  if($('requestDesktopNotifications'))$('requestDesktopNotifications').onclick=async()=>{
    await requestDesktopNotificationPermission();
    renderPage();
  };

  if($('testDesktopNotification'))$('testDesktopNotification').onclick=async()=>{
    const mode=await sendDesktopOrFallbackNotification(
      'OnlyBeats test notification',
      'Your notification system is working.'
    );
    toast(mode==='desktop'?'Desktop notification sent':mode==='in-app'?'In-app fallback used':'Notification not sent');
  };

  if($('desktopFallbackToggle'))$('desktopFallbackToggle').onchange=event=>{
    desktopState.notificationFallback=event.target.checked;
    saveDesktopState();
    toast(`In-app fallback ${desktopState.notificationFallback?'enabled':'disabled'}`);
  };

  if($('exportOnlyBeatsBundle'))$('exportOnlyBeatsBundle').onclick=exportOnlyBeatsBundle;
  if($('importOnlyBeatsBundle'))$('importOnlyBeatsBundle').onclick=importOnlyBeatsBundle;

  if($('runAboutProductionChecks'))$('runAboutProductionChecks').onclick=()=>{
    const report=runProductionReleaseChecks();
    toast(
      report.failed?`${report.failed} production checks need attention`:'All production checks passed',
      report.failed?'error':'success'
    );
  };
}

function initializeDesktopExperience(){
  loadDesktopState();
  installDesktopExperienceStyles();
  setTimeout(installDesktopNavigationPersistence,250);

  if(desktopState.lastPage&&pages.some(([route])=>route===desktopState.lastPage)){
    desktopState.lastOpenedAt=new Date().toISOString();
    saveDesktopState();
  }
}
