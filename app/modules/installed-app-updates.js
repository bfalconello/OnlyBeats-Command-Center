'use strict';

// OnlyBeats v6.0 Installed App & Automatic Updates.

let installedAppUpdateState={
  autoCheck:true,
  notifyAvailable:true,
  notifyDownloaded:true,
  lastViewedAt:null,
  lastManualCheckAt:null
};

let installedAppRuntimeState={
  supported:false,
  packaged:false,
  status:'loading',
  currentVersion:VERSION,
  availableVersion:'',
  downloadedVersion:'',
  percent:0,
  bytesPerSecond:0,
  transferred:0,
  total:0,
  releaseName:'',
  releaseNotes:'',
  error:'',
  checkedAt:null,
  downloadedAt:null
};

let installedAppUpdateHistory=[];
let installedAppUpdateUnsubscribe=null;

function loadInstalledAppUpdateState(){
  try{
    installedAppUpdateState={
      ...installedAppUpdateState,
      ...JSON.parse(localStorage.getItem(INSTALLED_APP_UPDATE_KEY)||'{}')
    };
  }catch{}

  try{
    const rows=JSON.parse(localStorage.getItem(UPDATE_HISTORY_KEY)||'[]');
    installedAppUpdateHistory=Array.isArray(rows)?rows:[];
  }catch{
    installedAppUpdateHistory=[];
  }
}

function saveInstalledAppUpdateState(){
  localStorage.setItem(INSTALLED_APP_UPDATE_KEY,JSON.stringify(installedAppUpdateState));
  localStorage.setItem(UPDATE_HISTORY_KEY,JSON.stringify(installedAppUpdateHistory.slice(-100)));
}

function updateStatusLabel(){
  const labels={
    loading:'Loading',
    development:'Development mode',
    idle:'Ready',
    checking:'Checking',
    available:'Update available',
    current:'Up to date',
    downloading:'Downloading',
    downloaded:'Ready to install',
    error:'Update issue'
  };
  return labels[installedAppRuntimeState.status]||installedAppRuntimeState.status;
}

function updateStatusDetail(){
  const state=installedAppRuntimeState;
  if(state.status==='development')return 'Install the Windows build to test automatic updates.';
  if(state.status==='checking')return 'Checking the stable GitHub release channel.';
  if(state.status==='available')return `Version ${state.availableVersion} is available.`;
  if(state.status==='current')return `Version ${state.currentVersion} is current.`;
  if(state.status==='downloading')return `${Math.max(0,Math.min(100,state.percent)).toFixed(1)}% downloaded.`;
  if(state.status==='downloaded')return `Version ${state.downloadedVersion||state.availableVersion} is ready.`;
  if(state.status==='error')return state.error||'The update check could not be completed.';
  return state.supported?'Automatic update service is ready.':'Updater unavailable.';
}

function recordInstalledAppUpdateEvent(type,state){
  const latest=installedAppUpdateHistory[installedAppUpdateHistory.length-1];
  const signature=`${type}|${state.status}|${state.availableVersion}|${state.downloadedVersion}|${state.error}`;
  if(latest?.signature===signature)return;

  installedAppUpdateHistory.push({
    id:`update-${Date.now()}`,
    signature,
    type,
    status:state.status,
    currentVersion:state.currentVersion,
    availableVersion:state.availableVersion,
    downloadedVersion:state.downloadedVersion,
    detail:updateStatusDetail(),
    time:new Date().toISOString()
  });
  saveInstalledAppUpdateState();
}

function receiveInstalledAppUpdateState(state){
  const previousStatus=installedAppRuntimeState.status;
  installedAppRuntimeState={...installedAppRuntimeState,...state};

  if(previousStatus!==installedAppRuntimeState.status){
    recordInstalledAppUpdateEvent('status',installedAppRuntimeState);

    if(
      installedAppRuntimeState.status==='available' &&
      installedAppUpdateState.notifyAvailable &&
      typeof addInAppNotification==='function'
    ){
      addInAppNotification(
        'info',
        `OnlyBeats ${installedAppRuntimeState.availableVersion} is available`,
        'Open Updates & Release to download it.',
        'updates'
      );
    }

    if(
      installedAppRuntimeState.status==='downloaded' &&
      installedAppUpdateState.notifyDownloaded &&
      typeof addInAppNotification==='function'
    ){
      addInAppNotification(
        'success',
        'OnlyBeats update is ready',
        'Restart the app to complete installation.',
        'updates'
      );
    }
  }

  if(currentPage==='updates')renderPage();
}

function formatUpdateBytes(value){
  const bytes=Number(value)||0;
  if(bytes<1024)return `${bytes} B`;
  if(bytes<1024*1024)return `${(bytes/1024).toFixed(1)} KB`;
  if(bytes<1024*1024*1024)return `${(bytes/1024/1024).toFixed(1)} MB`;
  return `${(bytes/1024/1024/1024).toFixed(2)} GB`;
}

function updateProgressPanel(){
  const state=installedAppRuntimeState;
  if(state.status!=='downloading'){
    return `<div class="ultimate-unavailable">
      <strong>${esc(updateStatusLabel())}</strong>
      <small>${esc(updateStatusDetail())}</small>
    </div>`;
  }

  const percent=Math.max(0,Math.min(100,Number(state.percent)||0));
  return `<div class="installed-update-progress">
    <div><strong>${percent.toFixed(1)}%</strong><span>${formatUpdateBytes(state.transferred)} / ${formatUpdateBytes(state.total)}</span></div>
    <div class="installed-update-progress-track"><i style="width:${percent}%"></i></div>
    <small>${formatUpdateBytes(state.bytesPerSecond)}/s</small>
  </div>`;
}

function releaseNotesPanel(){
  const notes=String(installedAppRuntimeState.releaseNotes||'').trim();
  if(!notes){
    return empty(
      'No release notes loaded',
      'Release notes appear when GitHub reports a newer version.'
    );
  }

  return `<div class="installed-release-notes">${esc(notes).replace(/\n/g,'<br>')}</div>`;
}

function installedUpdateHistoryPanel(){
  if(!installedAppUpdateHistory.length){
    return empty('No update history','Update checks, downloads, and errors will appear here.');
  }

  return `<div class="intel-list">${installedAppUpdateHistory.slice().reverse().map(item=>`
    <div class="intel-row">
      <span class="intel-icon">${item.status==='error'?'×':item.status==='downloaded'?'✓':'•'}</span>
      <div>
        <strong>${esc(item.status)}${item.availableVersion?` · v${esc(item.availableVersion)}`:''}</strong>
        <small>${new Date(item.time).toLocaleString()} · ${esc(item.detail)}</small>
      </div>
    </div>`).join('')}</div>`;
}

function installedAppUpdatesPage(){
  setHeading('Updates & Release','INSTALL · DOWNLOAD · RESTART');

  installedAppUpdateState.lastViewedAt=new Date().toISOString();
  saveInstalledAppUpdateState();

  const state=installedAppRuntimeState;
  const canCheck=Boolean(window.onlyBeatsDesktop?.update);
  const canDownload=state.status==='available';
  const canInstall=state.status==='downloaded';

  return `<section class="installed-update-hero">
    <div>
      <p class="eyebrow">ONLYBEATS v6.0</p>
      <h1>${esc(updateStatusLabel())}</h1>
      <p>${esc(updateStatusDetail())}</p>
    </div>
    <div class="button-row">
      <button class="button primary" id="installedUpdateCheck" ${canCheck?'':'disabled'}>Check for updates</button>
      <button class="button" id="installedUpdateDownload" ${canDownload?'':'disabled'}>Download update</button>
      <button class="button" id="installedUpdateInstall" ${canInstall?'':'disabled'}>Restart and install</button>
    </div>
  </section>

  <div class="metric-grid">
    ${metric('Installed Version',state.currentVersion||VERSION,state.packaged?'Installed app':'Development mode')}
    ${metric('Update Status',updateStatusLabel(),state.supported?'Stable channel':'Installer required')}
    ${metric('Available Version',state.availableVersion||'None',state.releaseName||'GitHub Releases')}
    ${metric('Download',state.status==='downloading'?`${state.percent.toFixed(1)}%`:state.status==='downloaded'?'Complete':'Not active',formatUpdateBytes(state.total))}
    ${metric('Last Check',state.checkedAt?new Date(state.checkedAt).toLocaleString():'Never','Automatic and manual')}
    ${metric('Firebase Config','Persistent','Stored outside installed program files')}
  </div>

  ${state.error?`<div class="provider-notice"><div><strong>Update service needs attention</strong><p class="muted">${esc(state.error)}</p></div></div>`:''}

  <div class="reports-grid">
    ${card('Download Progress',updateProgressPanel())}

    ${card('Update Preferences',`<div class="detail-list">
      <label class="toggle-row"><span>Check automatically after startup</span><input id="installedUpdateAutoCheck" type="checkbox" ${installedAppUpdateState.autoCheck?'checked':''}></label>
      <label class="toggle-row"><span>Notify when an update is available</span><input id="installedUpdateNotifyAvailable" type="checkbox" ${installedAppUpdateState.notifyAvailable?'checked':''}></label>
      <label class="toggle-row"><span>Notify when download finishes</span><input id="installedUpdateNotifyDownloaded" type="checkbox" ${installedAppUpdateState.notifyDownloaded?'checked':''}></label>
      <div><span>Release channel</span><strong>Stable</strong></div>
      <div><span>Automatic install</span><strong>On restart after download</strong></div>
    </div>`)}

    ${card('Release Notes',releaseNotesPanel(),'wide')}

    ${card('Update Recovery',`<div class="intel-list">
      <div class="intel-row"><span class="intel-icon">✓</span><div><strong>Local app data is preserved</strong><small>The installer does not delete AppData during upgrades or uninstall by default.</small></div></div>
      <div class="intel-row"><span class="intel-icon">✓</span><div><strong>Firebase configuration persists</strong><small>A copy is stored in the OnlyBeats user-data directory and reused after updates.</small></div></div>
      <div class="intel-row"><span class="intel-icon">✓</span><div><strong>Cloud data remains available</strong><small>Predictions, favorites, notes, settings, and synced records remain attached to your Firebase account.</small></div></div>
      <div class="intel-row"><span class="intel-icon">△</span><div><strong>Unsigned beta installer</strong><small>Windows may continue showing a publisher warning until code signing is configured.</small></div></div>
    </div>`)}

    ${card('Release Tools',`<div class="button-stack">
      <button class="button" id="installedUpdateOpenReleases">Open GitHub Releases</button>
      <button class="button" id="installedUpdateShowLog">Show updater log</button>
      <button class="button" data-page-jump="developer">Run Developer & QA</button>
      <button class="button" data-page-jump="release">Open Desktop Release</button>
    </div>`)}

    ${card('Update History',installedUpdateHistoryPanel(),'wide')}

    ${card('Release Requirements',`<div class="intel-list">
      <div class="intel-row"><span class="intel-icon">1</span><div><strong>Increment package version</strong><small>Every update must have a version higher than the installed build.</small></div></div>
      <div class="intel-row"><span class="intel-icon">2</span><div><strong>Push a matching version tag</strong><small>Example: package version 6.0.1 uses tag v6.0.1.</small></div></div>
      <div class="intel-row"><span class="intel-icon">3</span><div><strong>Let GitHub Actions publish all update files</strong><small>The installer, blockmap, and latest.yml must be attached to the published release.</small></div></div>
      <div class="intel-row"><span class="intel-icon">4</span><div><strong>Do not leave the release as a draft</strong><small>The installed updater reads published releases from the stable channel.</small></div></div>
    </div>`,'wide')}
  </div>`;
}

function bindInstalledAppUpdates(){
  if($('installedUpdateCheck'))$('installedUpdateCheck').onclick=async()=>{
    installedAppUpdateState.lastManualCheckAt=new Date().toISOString();
    saveInstalledAppUpdateState();

    try{
      receiveInstalledAppUpdateState(await window.onlyBeatsDesktop.update.check());
    }catch(error){
      receiveInstalledAppUpdateState({status:'error',error:error?.message||String(error)});
    }
  };

  if($('installedUpdateDownload'))$('installedUpdateDownload').onclick=async()=>{
    try{
      receiveInstalledAppUpdateState(await window.onlyBeatsDesktop.update.download());
    }catch(error){
      receiveInstalledAppUpdateState({status:'error',error:error?.message||String(error)});
    }
  };

  if($('installedUpdateInstall'))$('installedUpdateInstall').onclick=async()=>{
    const confirmed=window.onlyBeatsDesktop?.confirm
      ?await window.onlyBeatsDesktop.confirm({
        title:'Install OnlyBeats update',
        message:'OnlyBeats will close, install the downloaded update, and restart.'
      })
      :confirm('Restart OnlyBeats and install the downloaded update?');

    if(!confirmed)return;

    try{
      await window.onlyBeatsDesktop.update.install();
    }catch(error){
      receiveInstalledAppUpdateState({status:'error',error:error?.message||String(error)});
    }
  };

  const toggle=(id,key)=>{
    if($(id))$(id).onchange=event=>{
      installedAppUpdateState[key]=event.target.checked;
      saveInstalledAppUpdateState();
    };
  };

  toggle('installedUpdateAutoCheck','autoCheck');
  toggle('installedUpdateNotifyAvailable','notifyAvailable');
  toggle('installedUpdateNotifyDownloaded','notifyDownloaded');

  if($('installedUpdateOpenReleases'))$('installedUpdateOpenReleases').onclick=()=>{
    window.onlyBeatsDesktop?.update?.openReleases();
  };

  if($('installedUpdateShowLog'))$('installedUpdateShowLog').onclick=()=>{
    window.onlyBeatsDesktop?.update?.showLog();
  };
}

function installInstalledAppUpdateStyles(){
  if(document.getElementById('onlybeatsInstalledAppUpdateStyles'))return;

  const style=document.createElement('style');
  style.id='onlybeatsInstalledAppUpdateStyles';
  style.textContent=`
    .installed-update-hero{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:30px;margin-bottom:18px;border:1px solid rgba(244,189,69,.28);border-radius:24px;background:radial-gradient(circle at 84% 10%,rgba(244,189,69,.13),transparent 38%),#101822}
    .installed-update-hero h1{font-size:clamp(2.2rem,5vw,4rem);line-height:1;margin:5px 0 12px}
    .installed-update-progress{display:grid;gap:12px}
    .installed-update-progress>div:first-child{display:flex;justify-content:space-between;align-items:center}
    .installed-update-progress-track{height:13px;overflow:hidden;border:1px solid rgba(255,255,255,.1);border-radius:999px;background:rgba(255,255,255,.04)}
    .installed-update-progress-track i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#f4bd45,#ffe28a);transition:width .25s ease}
    .installed-release-notes{max-height:360px;overflow:auto;padding:14px;border:1px solid rgba(255,255,255,.08);border-radius:13px;background:rgba(255,255,255,.025);line-height:1.6}
    .button-stack{display:grid;gap:10px}
    @media(max-width:760px){.installed-update-hero{align-items:flex-start;flex-direction:column;padding:22px}}
  `;
  document.head.appendChild(style);
}

async function initializeInstalledAppUpdates(){
  loadInstalledAppUpdateState();
  installInstalledAppUpdateStyles();

  if(window.onlyBeatsDesktop?.update){
    try{
      receiveInstalledAppUpdateState(await window.onlyBeatsDesktop.update.getState());
    }catch{}

    installedAppUpdateUnsubscribe=window.onlyBeatsDesktop.update.onState(state=>{
      receiveInstalledAppUpdateState(state);
    });

    if(installedAppUpdateState.autoCheck){
      setTimeout(()=>{
        if(!['checking','downloading','downloaded'].includes(installedAppRuntimeState.status)){
          window.onlyBeatsDesktop.update.check().catch(()=>{});
        }
      },15000);
    }
  }else{
    receiveInstalledAppUpdateState({
      supported:false,
      packaged:false,
      status:'development',
      currentVersion:VERSION
    });
  }
}
