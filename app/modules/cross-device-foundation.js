'use strict';

// OnlyBeats v2.0 Cross-Device Foundation — Phase 1.
// PWA/mobile shell and sync-ready local data model. No cloud backend is claimed or simulated.

let crossDeviceState={
  deviceId:'',
  deviceName:'',
  createdAt:'',
  lastSnapshotAt:null,
  lastImportAt:null,
  pendingChanges:0,
  installDismissed:false
};
let deferredInstallPrompt=null;
let serviceWorkerState='Not registered';

function generateDeviceId(){
  return crypto.randomUUID?.()||`device-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
}

function defaultDeviceName(){
  const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return mobile?'OnlyBeats Mobile':'OnlyBeats Desktop';
}

function loadCrossDeviceState(){
  try{
    crossDeviceState={...crossDeviceState,...JSON.parse(localStorage.getItem(CROSS_DEVICE_KEY)||'{}')};
  }catch{}
  if(!crossDeviceState.deviceId)crossDeviceState.deviceId=generateDeviceId();
  if(!crossDeviceState.deviceName)crossDeviceState.deviceName=defaultDeviceName();
  if(!crossDeviceState.createdAt)crossDeviceState.createdAt=new Date().toISOString();
  saveCrossDeviceState();
}

function saveCrossDeviceState(){
  localStorage.setItem(CROSS_DEVICE_KEY,JSON.stringify(crossDeviceState));
}

function isPwaDisplayMode(){
  return window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true;
}

function pwaEnvironment(){
  const secure=location.protocol==='https:'||['localhost','127.0.0.1'].includes(location.hostname);
  const fileMode=location.protocol==='file:';
  return {
    secure,
    fileMode,
    standalone:isPwaDisplayMode(),
    serviceWorker:'serviceWorker' in navigator,
    installable:Boolean(deferredInstallPrompt)
  };
}

async function registerOnlyBeatsServiceWorker(){
  if(!('serviceWorker' in navigator)){
    serviceWorkerState='Unsupported';
    return false;
  }
  if(location.protocol==='file:'){
    serviceWorkerState='Desktop file mode';
    return false;
  }
  try{
    const registration=await navigator.serviceWorker.register('./service-worker.js');
    serviceWorkerState=registration.active?'Active':'Registered';
    return true;
  }catch(error){
    serviceWorkerState=`Failed: ${error?.message||error}`;
    return false;
  }
}

function allSyncableStorage(){
  const storage={};
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(!key||key===CROSS_DEVICE_KEY)continue;
    storage[key]=localStorage.getItem(key);
  }
  return storage;
}

function createDeviceSnapshot(){
  const storage=allSyncableStorage();
  return {
    format:'OnlyBeats Device Snapshot',
    snapshotVersion:1,
    appVersion:VERSION,
    generatedAt:new Date().toISOString(),
    sourceDevice:{
      id:crossDeviceState.deviceId,
      name:crossDeviceState.deviceName
    },
    counts:{
      predictions:predictions.length,
      futures:futures.length,
      favorites:favorites.length,
      archives:seasonArchives.length,
      alerts:liveAlerts.length,
      availability:availabilityEntries.length,
      timeline:timelineEvents.length
    },
    storage
  };
}

function downloadDeviceSnapshot(){
  const payload=createDeviceSnapshot();
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`onlybeats-device-${crossDeviceState.deviceName.replace(/[^a-z0-9]+/gi,'-').toLowerCase()}-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  crossDeviceState.lastSnapshotAt=new Date().toISOString();
  crossDeviceState.pendingChanges=0;
  saveCrossDeviceState();
}

function validateDeviceSnapshot(payload){
  if(!payload||payload.format!=='OnlyBeats Device Snapshot'){
    throw new Error('This is not an OnlyBeats device snapshot.');
  }
  if(payload.snapshotVersion!==1){
    throw new Error(`Unsupported snapshot version: ${payload.snapshotVersion}`);
  }
  if(!payload.storage||typeof payload.storage!=='object'||Array.isArray(payload.storage)){
    throw new Error('Snapshot storage is invalid.');
  }
  return true;
}

function snapshotConflictSummary(payload){
  const incoming=Object.keys(payload.storage||{});
  const existing=incoming.filter(key=>localStorage.getItem(key)!==null);
  const newKeys=incoming.filter(key=>localStorage.getItem(key)===null);
  return {incoming:incoming.length,existing:existing.length,newKeys:newKeys.length};
}

function importDeviceSnapshot(){
  const input=document.createElement('input');
  input.type='file';
  input.accept='application/json,.json';
  input.onchange=async()=>{
    const file=input.files?.[0];
    if(!file)return;
    try{
      const payload=JSON.parse(await file.text());
      validateDeviceSnapshot(payload);
      const conflicts=snapshotConflictSummary(payload);
      const source=payload.sourceDevice?.name||'another device';
      const approved=confirm(`Import snapshot from ${source}? ${conflicts.existing} matching local entries will be replaced and ${conflicts.newKeys} new entries will be added.`);
      if(!approved)return;
      for(const [key,value] of Object.entries(payload.storage)){
        if(value!==null&&value!==undefined)localStorage.setItem(key,String(value));
      }
      crossDeviceState.lastImportAt=new Date().toISOString();
      saveCrossDeviceState();
      sessionStorage.clear();
      alert('Device snapshot imported. OnlyBeats will reload now.');
      location.reload();
    }catch(error){
      toast(error?.message||'Snapshot import failed','error');
    }
  };
  input.click();
}

function installMobileNavigation(){
  if(document.getElementById('onlybeatsMobileNav'))return;
  const nav=document.createElement('nav');
  nav.id='onlybeatsMobileNav';
  nav.className='mobile-bottom-nav';
  nav.setAttribute('aria-label','Mobile navigation');
  const items=[
    ['dashboard','⌂','Home'],
    ['gameday','◉','GameDay'],
    ['alerts','⚠','Alerts'],
    ['predictions','✓','Picks'],
    ['devices','▱','Devices']
  ];
  nav.innerHTML=items.map(([route,icon,label])=>`<button data-mobile-route="${route}" aria-label="${label}"><span>${icon}</span><small>${label}</small></button>`).join('');
  document.body.appendChild(nav);
  nav.querySelectorAll('[data-mobile-route]').forEach(button=>{
    button.onclick=()=>navigate(button.dataset.mobileRoute);
  });
}

function updateMobileNavigation(){
  document.querySelectorAll('[data-mobile-route]').forEach(button=>{
    button.classList.toggle('active',button.dataset.mobileRoute===currentPage);
  });
}

function installCrossDeviceStyles(){
  if(document.getElementById('onlybeatsCrossDeviceStyles'))return;
  const style=document.createElement('style');
  style.id='onlybeatsCrossDeviceStyles';
  style.textContent=`
    .mobile-bottom-nav{display:none}
    .device-code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;word-break:break-all}
    .sync-readiness-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .sync-readiness-item{padding:14px;border:1px solid rgba(255,255,255,.09);border-radius:14px}
    .sync-readiness-item span{display:block;color:#9aabbd;font-size:.85rem;margin-bottom:5px}
    @media(max-width:760px){
      body{padding-bottom:72px}
      .sidebar{display:none!important}
      .app-shell{grid-template-columns:1fr!important}
      main{width:100vw!important}
      .topbar{position:sticky;top:0;z-index:40;padding:12px 14px!important;background:#080d14}
      .top-actions .search-button span,.top-actions .search-button kbd{display:none}
      .content{padding:14px!important}
      .statusbar{display:none!important}
      .mobile-bottom-nav{
        position:fixed;display:grid;grid-template-columns:repeat(5,1fr);
        left:0;right:0;bottom:0;height:68px;z-index:10000;
        background:#0b1119;border-top:1px solid rgba(255,255,255,.1);
        padding:5px max(6px,env(safe-area-inset-right))
          calc(5px + env(safe-area-inset-bottom))
          max(6px,env(safe-area-inset-left))
      }
      .mobile-bottom-nav button{
        border:0;background:transparent;color:#9aabbd;display:flex;
        flex-direction:column;align-items:center;justify-content:center;
        gap:2px;border-radius:10px
      }
      .mobile-bottom-nav button.active{color:#f4bd45;background:rgba(244,189,69,.1)}
      .mobile-bottom-nav span{font-size:1.15rem}
      .mobile-bottom-nav small{font-size:.66rem}
      .sync-readiness-grid{grid-template-columns:1fr}
      .command-center-grid,.reports-grid{grid-template-columns:1fr!important}
    }
  `;
  document.head.appendChild(style);
}


function devicesCloudState(){
  const available=typeof cloudSyncState==='object'&&cloudSyncState!==null;
  const connected=Boolean(available&&cloudSyncState.connected);
  const queue=Array.isArray(typeof cloudQueue!=='undefined'?cloudQueue:null)
    ?cloudQueue
    :[];

  return {
    available,
    connected,
    backend:connected?'Firebase connected':available?'Firebase configured':'Cloud unavailable',
    account:connected
      ?String(cloudSyncState.accountEmail||cloudSyncState.accountId||'Connected account')
      :'Not signed in',
    sync:connected
      ?(cloudSyncState.autoSync?'Automatic cloud sync':'Manual cloud sync')
      :'Local snapshot transfer',
    queue:queue.length,
    lastSyncAt:connected?cloudSyncState.lastSyncAt||null:null,
    status:connected?String(cloudSyncState.status||'Connected'):'Not connected',
    conflictPolicy:connected?String(cloudSyncState.conflictPolicy||'newest-wins'):'Not active'
  };
}

function devicesCloudDetail(cloud){
  if(!cloud.connected)return 'Sign in through Cloud Sync Beta';
  if(cloud.queue>0)return `${cloud.queue} cloud change${cloud.queue===1?'':'s'} pending`;
  if(cloud.lastSyncAt)return `Last sync ${new Date(cloud.lastSyncAt).toLocaleTimeString()}`;
  return cloud.status;
}

function syncReadinessStatus(){
  const env=pwaEnvironment();
  const cloud=devicesCloudState();

  return {
    install:env.standalone?'Installed':env.installable?'Ready to install':env.fileMode?'Desktop app mode':'Browser mode',
    offline:serviceWorkerState,
    backend:cloud.backend,
    sync:cloud.sync,
    device:crossDeviceState.deviceName,
    secure:env.secure?'Yes':'No',
    cloud
  };
}

function devicesSyncPage(){
  setHeading('Devices & Sync','PWA · MOBILE · OFFLINE · SYNC READY');
  const env=pwaEnvironment();
  const status=syncReadinessStatus();
  const storage=allSyncableStorage();
  const installAvailable=Boolean(deferredInstallPrompt);

  return `<section class="intel-hero">
    <div>
      <p class="eyebrow">ONLYBEATS v6.0.2 UNIFIED DEVICE STATUS</p>
      <h2>${status.cloud.connected?'Cloud and device sync are connected.':env.standalone?'Installed app mode active.':installAvailable?'OnlyBeats is ready to install.':'Cross-device foundation is ready.'}</h2>
      <p>${status.cloud.connected
        ?`Signed in as ${esc(status.cloud.account)}. Cloud sync, offline queueing, device snapshots, and mobile installation are available from one device workspace.`
        :'Install the hosted web edition on a phone, use the offline application shell, and connect through Cloud Sync Beta for automatic cross-device synchronization.'}</p>
    </div>
    <div class="button-row">
      <button class="button primary" id="installOnlyBeats" ${installAvailable?'':'disabled'}>Install OnlyBeats</button>
      <button class="button" id="exportDeviceSnapshot">Export device snapshot</button>
      <button class="button" id="importDeviceSnapshot">Import snapshot</button>
    </div>
  </section>

  <div class="metric-grid">
    ${metric('App Mode',status.install,env.fileMode?'Windows desktop build':'PWA/browser')}
    ${metric('Offline Shell',status.offline,'Hosted PWA only')}
    ${metric('Cloud Backend',status.backend,devicesCloudDetail(status.cloud))}
    ${metric('Current Sync',status.sync,status.cloud.connected?status.cloud.conflictPolicy:'Validated JSON transfer')}
    ${metric('Device Name',status.device,'Saved locally')}
    ${metric('Pending Changes',status.cloud.connected?status.cloud.queue:crossDeviceState.pendingChanges,status.cloud.connected?'Cloud queue':'Since last snapshot')}
  </div>

  <div class="reports-grid">
    ${card('This Device',`<div class="detail-list">
      <div><span>Name</span><strong>${esc(crossDeviceState.deviceName)}</strong></div>
      <div><span>Device ID</span><strong class="device-code">${esc(crossDeviceState.deviceId)}</strong></div>
      <div><span>Created</span><strong>${new Date(crossDeviceState.createdAt).toLocaleString()}</strong></div>
      <div><span>Last snapshot</span><strong>${crossDeviceState.lastSnapshotAt?new Date(crossDeviceState.lastSnapshotAt).toLocaleString():'Never'}</strong></div>
      <div><span>Last import</span><strong>${crossDeviceState.lastImportAt?new Date(crossDeviceState.lastImportAt).toLocaleString():'Never'}</strong></div>
    </div>
    <div class="button-row">
      <input id="deviceNameInput" value="${esc(crossDeviceState.deviceName)}" aria-label="Device name">
      <button class="button" id="saveDeviceName">Save name</button>
    </div>`)}

    ${card('Sync Readiness',`<div class="sync-readiness-grid">
      <div class="sync-readiness-item"><span>PWA manifest</span><strong>Ready</strong></div>
      <div class="sync-readiness-item"><span>Mobile navigation</span><strong>Ready</strong></div>
      <div class="sync-readiness-item"><span>Offline shell</span><strong>${esc(serviceWorkerState)}</strong></div>
      <div class="sync-readiness-item"><span>Secure host</span><strong>${status.secure}</strong></div>
      <div class="sync-readiness-item"><span>Local data keys</span><strong>${Object.keys(storage).length}</strong></div>
      <div class="sync-readiness-item"><span>Cloud account</span><strong>${esc(status.cloud.account)}</strong></div>
      <div class="sync-readiness-item"><span>Cloud status</span><strong>${esc(status.cloud.status)}</strong></div>
      <div class="sync-readiness-item"><span>Conflict policy</span><strong>${esc(status.cloud.conflictPolicy)}</strong></div>
    </div>`)}

    ${card('Phone Installation',`<div class="intel-list">
      <div class="intel-row"><span class="intel-icon">1</span><div><strong>Host over HTTPS</strong><small>Service workers and installation require a secure website or localhost.</small></div></div>
      <div class="intel-row"><span class="intel-icon">2</span><div><strong>Open on the phone</strong><small>Use Safari on iPhone or Chrome on Android.</small></div></div>
      <div class="intel-row"><span class="intel-icon">3</span><div><strong>Add to Home Screen</strong><small>Install through the browser menu when the install button is unavailable.</small></div></div>
      <div class="intel-row"><span class="intel-icon">4</span><div><strong>Synchronize or transfer data</strong><small>Use Firebase cloud sync for normal use and snapshots for local recovery or manual transfer.</small></div></div>
    </div>`,'wide')}

    ${card('Cross-Device Capabilities',`<div class="detail-list">
      <div><span>Automatic cloud sync</span><strong>${status.cloud.connected?(cloudSyncState.autoSync?'Enabled':'Available'):'Connect account'}</strong></div>
      <div><span>User account</span><strong>${esc(status.cloud.account)}</strong></div>
      <div><span>Offline queue</span><strong>${status.cloud.queue} pending</strong></div>
      <div><span>Conflict policy</span><strong>${esc(status.cloud.conflictPolicy)}</strong></div>
      <div><span>Local recovery</span><strong>Snapshots available</strong></div>
      <div><span>Mobile installation</span><strong>PWA ready</strong></div>
    </div>`,'wide')}
  </div>`;
}

function bindDevicesSync(){
  if($('installOnlyBeats'))$('installOnlyBeats').onclick=async()=>{
    if(!deferredInstallPrompt)return;
    deferredInstallPrompt.prompt();
    const choice=await deferredInstallPrompt.userChoice;
    deferredInstallPrompt=null;
    toast(choice.outcome==='accepted'?'OnlyBeats installation started':'Installation dismissed');
    renderPage();
  };

  if($('exportDeviceSnapshot'))$('exportDeviceSnapshot').onclick=()=>{
    downloadDeviceSnapshot();
    toast('Device snapshot exported');
    renderPage();
  };

  if($('importDeviceSnapshot'))$('importDeviceSnapshot').onclick=importDeviceSnapshot;

  if($('saveDeviceName'))$('saveDeviceName').onclick=()=>{
    const name=$('deviceNameInput')?.value.trim();
    if(!name){
      toast('Enter a device name','error');
      return;
    }
    crossDeviceState.deviceName=name.slice(0,60);
    saveCrossDeviceState();
    renderPage();
    toast('Device name saved');
  };
}

function initializeCrossDeviceFoundation(){
  loadCrossDeviceState();
  installCrossDeviceStyles();
  installMobileNavigation();
  updateMobileNavigation();

  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferredInstallPrompt=event;
    if(currentPage==='devices')renderPage();
  });

  window.addEventListener('appinstalled',()=>{
    deferredInstallPrompt=null;
    toast('OnlyBeats installed successfully');
    if(currentPage==='devices')renderPage();
  });

  if(typeof renderNav==='function'&&!renderNav.__crossDeviceWrapped){
    const original=renderNav;
    const wrapped=function(){
      original();
      updateMobileNavigation();
    };
    wrapped.__crossDeviceWrapped=true;
    renderNav=wrapped;
  }

  registerOnlyBeatsServiceWorker();
}
