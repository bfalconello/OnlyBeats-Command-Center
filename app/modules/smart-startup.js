'use strict';

// OnlyBeats v3.1 Smart Startup & Sync Readiness.
// Performs transparent startup checks and continues in a safe local mode when
// optional providers or cloud services are not configured.

let smartStartupState={
  enabled:true,
  minimumDisplayMs:1800,
  autoOpenRecoveryOnFailure:true,
  continueOffline:true,
  runProviderChecks:true,
  runCloudChecks:true,
  showEveryLaunch:true,
  lastRunAt:null,
  lastOutcome:'not-run',
  lastDurationMs:0
};

let startupDiagnosticsHistory=[];
let activeStartupDiagnostics=null;

function loadSmartStartupState(){
  try{
    smartStartupState={
      ...smartStartupState,
      ...JSON.parse(localStorage.getItem(SMART_STARTUP_KEY)||'{}')
    };
  }catch{}

  try{
    const rows=JSON.parse(localStorage.getItem(STARTUP_DIAGNOSTICS_KEY)||'[]');
    startupDiagnosticsHistory=Array.isArray(rows)?rows:[];
  }catch{
    startupDiagnosticsHistory=[];
  }
}

function saveSmartStartupState(){
  localStorage.setItem(SMART_STARTUP_KEY,JSON.stringify(smartStartupState));
  localStorage.setItem(STARTUP_DIAGNOSTICS_KEY,JSON.stringify(startupDiagnosticsHistory.slice(-50)));
}

function startupCheck(name,runner,{required=true,detail=''}={}){
  return {name,runner,required,detail};
}

function startupDesktopBridge(){
  const raw=(typeof window!=='undefined'&&window.onlyBeatsDesktop)
    ?window.onlyBeatsDesktop
    :null;
  return raw&&typeof raw==='object'?raw:null;
}

function startupCloudReady(){
  try{
    if(typeof cloudPlatformAdapter!=='function')return false;
    return Boolean(cloudPlatformAdapter()?.configured);
  }catch{
    return false;
  }
}

function startupProviderSummary(){
  try{
    if(typeof LIVE_DATA_FEEDS==='undefined'||typeof liveDataAdapter!=='function'){
      return {configured:0,total:0};
    }
    const total=LIVE_DATA_FEEDS.length;
    const configured=LIVE_DATA_FEEDS.filter(feed=>{
      try{return Boolean(liveDataAdapter(feed.id)?.configured);}
      catch{return false;}
    }).length;
    return {configured,total};
  }catch{
    return {configured:0,total:0};
  }
}

function startupRequiredFiles(){
  return [
    'modules/config.js',
    'modules/public-release.js',
    'modules/live-command-center.js',
    'modules/prediction-combo-builder.js',
    'assets/onlybeats-icon.png'
  ];
}

function startupChecks(){
  const bridge=startupDesktopBridge();

  return [
    startupCheck(
      'Application shell',
      ()=>Boolean(document.getElementById('app')||document.body),
      {required:true,detail:'Main interface mount'}
    ),
    startupCheck(
      'Local storage',
      ()=>{
        const key='onlybeats.startup.test';
        localStorage.setItem(key,'ok');
        const ok=localStorage.getItem(key)==='ok';
        localStorage.removeItem(key);
        return ok;
      },
      {required:true,detail:'Preferences and local data'}
    ),
    startupCheck(
      'Desktop runtime',
      ()=>Boolean(bridge||navigator.userAgent.includes('Electron')),
      {required:true,detail:'Electron bridge or runtime'}
    ),
    startupCheck(
      'Prediction database',
      ()=>Array.isArray(typeof predictions!=='undefined'?predictions:null),
      {required:true,detail:'Prediction records'}
    ),
    startupCheck(
      'Favorites',
      ()=>Array.isArray(typeof favorites!=='undefined'?favorites:null),
      {required:true,detail:'Favorite-team records'}
    ),
    startupCheck(
      'Backup service',
      ()=>typeof exportOnlyBeatsBundle==='function'||typeof downloadDeviceSnapshot==='function',
      {required:true,detail:'Local recovery tools'}
    ),
    startupCheck(
      'Release Hub',
      ()=>typeof publicReleaseHubPage==='function',
      {required:true,detail:'Release and support tools'}
    ),
    startupCheck(
      'Live Command Center',
      ()=>typeof liveCommandCenterPage==='function',
      {required:true,detail:'Saturday Mode'}
    ),
    startupCheck(
      'Prediction Lab',
      ()=>typeof predictionLabPage==='function',
      {required:true,detail:'Prediction analytics'}
    ),
    startupCheck(
      'Cloud adapter',
      ()=>startupCloudReady(),
      {required:false,detail:'Optional remote synchronization'}
    ),
    startupCheck(
      'Live data providers',
      ()=>startupProviderSummary().configured>0,
      {required:false,detail:'Optional scores, rankings, and weather feeds'}
    ),
    startupCheck(
      'Network connection',
      ()=>navigator.onLine,
      {required:false,detail:'Offline mode remains available'}
    )
  ];
}

async function executeStartupCheck(check){
  const started=performance.now();
  try{
    const value=await Promise.resolve(check.runner());
    return {
      name:check.name,
      ok:Boolean(value),
      required:check.required,
      detail:check.detail,
      durationMs:Math.round(performance.now()-started),
      error:''
    };
  }catch(error){
    return {
      name:check.name,
      ok:false,
      required:check.required,
      detail:check.detail,
      durationMs:Math.round(performance.now()-started),
      error:error?.message||String(error)
    };
  }
}

async function runStartupDiagnostics(onProgress){
  const started=performance.now();
  const checks=startupChecks();
  const results=[];

  for(let index=0;index<checks.length;index+=1){
    const result=await executeStartupCheck(checks[index]);
    results.push(result);
    if(typeof onProgress==='function'){
      onProgress({
        result,
        index,
        total:checks.length,
        percent:Math.round(((index+1)/checks.length)*100)
      });
    }
    await new Promise(resolve=>setTimeout(resolve,55));
  }

  const requiredFailures=results.filter(item=>item.required&&!item.ok);
  const optionalUnavailable=results.filter(item=>!item.required&&!item.ok);
  const outcome=requiredFailures.length?'recovery':optionalUnavailable.length?'offline-ready':'ready';
  const durationMs=Math.round(performance.now()-started);

  activeStartupDiagnostics={
    id:`startup-${Date.now()}`,
    time:new Date().toISOString(),
    version:VERSION,
    outcome,
    durationMs,
    requiredFailures:requiredFailures.length,
    optionalUnavailable:optionalUnavailable.length,
    results
  };

  startupDiagnosticsHistory.push(activeStartupDiagnostics);
  smartStartupState.lastRunAt=activeStartupDiagnostics.time;
  smartStartupState.lastOutcome=outcome;
  smartStartupState.lastDurationMs=durationMs;
  saveSmartStartupState();

  return activeStartupDiagnostics;
}

function startupStatusText(outcome){
  if(outcome==='ready')return 'Ready';
  if(outcome==='offline-ready')return 'Ready in local mode';
  if(outcome==='recovery')return 'Recovery recommended';
  return 'Checking';
}

function createStartupOverlay(){
  const overlay=document.createElement('div');
  overlay.id='smartStartupOverlay';
  overlay.className='smart-startup-overlay';
  overlay.innerHTML=`<div class="smart-startup-card">
    <img src="assets/onlybeats-icon.png" alt="OnlyBeats">
    <p class="eyebrow">ONLYBEATS COMMAND CENTER</p>
    <h1>Starting OnlyBeats</h1>
    <p id="startupCurrentTask">Preparing startup diagnostics…</p>
    <div class="smart-startup-progress"><span id="startupProgressBar"></span></div>
    <div id="startupCheckList" class="smart-startup-checks"></div>
    <div class="smart-startup-footer">
      <span>Version ${esc(VERSION)}</span>
      <strong id="startupOutcome">Checking</strong>
    </div>
  </div>`;
  return overlay;
}

function startupResultRow(result){
  return `<div class="smart-startup-check ${result.ok?'pass':result.required?'fail':'warn'}">
    <span>${result.ok?'✓':result.required?'×':'△'}</span>
    <div><strong>${esc(result.name)}</strong><small>${esc(result.detail)}${result.error?` · ${esc(result.error)}`:''}</small></div>
  </div>`;
}

async function showSmartStartup(){
  if(!smartStartupState.enabled)return;
  if(!smartStartupState.showEveryLaunch&&smartStartupState.lastOutcome==='ready')return;
  if(document.getElementById('smartStartupOverlay'))return;

  const minimum=Number(smartStartupState.minimumDisplayMs)||1800;
  const openedAt=Date.now();
  const overlay=createStartupOverlay();
  document.body.appendChild(overlay);

  const list=overlay.querySelector('#startupCheckList');
  const bar=overlay.querySelector('#startupProgressBar');
  const task=overlay.querySelector('#startupCurrentTask');
  const outcome=overlay.querySelector('#startupOutcome');

  const diagnostics=await runStartupDiagnostics(({result,percent})=>{
    task.textContent=`Checking ${result.name}…`;
    bar.style.width=`${percent}%`;
    list.insertAdjacentHTML('beforeend',startupResultRow(result));
    list.scrollTop=list.scrollHeight;
  });

  outcome.textContent=startupStatusText(diagnostics.outcome);
  task.textContent=diagnostics.outcome==='ready'
    ?'All required services are ready.'
    :diagnostics.outcome==='offline-ready'
      ?'Optional services are unavailable. Launching in local mode.'
      :'A required startup service needs attention.';

  const remaining=Math.max(0,minimum-(Date.now()-openedAt));
  await new Promise(resolve=>setTimeout(resolve,remaining));

  if(diagnostics.outcome==='recovery'&&smartStartupState.autoOpenRecoveryOnFailure){
    overlay.classList.add('recovery');
    overlay.querySelector('.smart-startup-footer').insertAdjacentHTML(
      'beforeend',
      `<div class="button-row">
        <button class="button primary" id="startupOpenRecovery">Open recovery</button>
        ${smartStartupState.continueOffline?'<button class="button" id="startupContinueAnyway">Continue anyway</button>':''}
      </div>`
    );
    document.getElementById('startupOpenRecovery').onclick=()=>{
      overlay.remove();
      navigate('startup');
    };
    if(document.getElementById('startupContinueAnyway')){
      document.getElementById('startupContinueAnyway').onclick=()=>overlay.remove();
    }
    return;
  }

  overlay.classList.add('complete');
  await new Promise(resolve=>setTimeout(resolve,350));
  overlay.remove();
}

function startupRecoveryHistory(){
  if(!startupDiagnosticsHistory.length){
    return empty('No startup history','Run startup diagnostics to create a report.');
  }

  return `<div class="intel-list">${startupDiagnosticsHistory.slice().reverse().map(run=>`
    <div class="intel-row">
      <span class="intel-icon">${run.outcome==='ready'?'✓':run.outcome==='offline-ready'?'△':'×'}</span>
      <div>
        <strong>${esc(startupStatusText(run.outcome))}</strong>
        <small>${new Date(run.time).toLocaleString()} · ${run.durationMs} ms · ${run.requiredFailures} required failures · ${run.optionalUnavailable} optional unavailable</small>
      </div>
      <span class="provider-badge">${esc(run.outcome.toUpperCase())}</span>
    </div>`).join('')}</div>`;
}

function startupRecoveryPage(){
  setHeading('Startup & Recovery','DIAGNOSTICS · OFFLINE MODE · HISTORY');
  const latest=activeStartupDiagnostics||startupDiagnosticsHistory[startupDiagnosticsHistory.length-1]||null;
  const providers=startupProviderSummary();

  return `<section class="intel-hero">
    <div>
      <p class="eyebrow">SMART STARTUP</p>
      <h2>${latest?startupStatusText(latest.outcome):'Startup diagnostics have not run yet.'}</h2>
      <p>Review startup services, optional cloud and provider connections, offline readiness, and recent diagnostic history.</p>
    </div>
    <div class="button-row">
      <button class="button primary" id="startupRunAgain">Run diagnostics</button>
      <button class="button" id="startupShowIntro">Show intro</button>
      <button class="button" data-page-jump="about">Open backup tools</button>
    </div>
  </section>

  <div class="metric-grid">
    ${metric('Last Outcome',latest?startupStatusText(latest.outcome):'Not run',latest?new Date(latest.time).toLocaleString():'No diagnostics')}
    ${metric('Required Failures',latest?.requiredFailures||0,'Must be resolved')}
    ${metric('Optional Unavailable',latest?.optionalUnavailable||0,'Local mode supported')}
    ${metric('Startup Duration',latest?`${latest.durationMs} ms`:'—','Diagnostic duration')}
    ${metric('Live Providers',`${providers.configured}/${providers.total}`,'Configured feeds')}
    ${metric('Cloud Adapter',startupCloudReady()?'Connected':'Not connected','Optional sync')}
  </div>

  <div class="reports-grid">
    ${card('Startup Preferences',`<div class="detail-list">
      <label class="toggle-row"><span>Enable smart startup</span><input type="checkbox" id="startupEnabled" ${smartStartupState.enabled?'checked':''}></label>
      <label class="toggle-row"><span>Show intro every launch</span><input type="checkbox" id="startupEveryLaunch" ${smartStartupState.showEveryLaunch?'checked':''}></label>
      <label class="toggle-row"><span>Continue in offline mode</span><input type="checkbox" id="startupContinueOffline" ${smartStartupState.continueOffline?'checked':''}></label>
      <label class="toggle-row"><span>Open recovery after required failure</span><input type="checkbox" id="startupAutoRecovery" ${smartStartupState.autoOpenRecoveryOnFailure?'checked':''}></label>
      <label><span>Minimum intro duration</span>
        <select id="startupMinimumDuration">
          ${[1200,1800,2500,3500].map(value=>`<option value="${value}" ${Number(smartStartupState.minimumDisplayMs)===value?'selected':''}>${(value/1000).toFixed(1)} seconds</option>`).join('')}
        </select>
      </label>
    </div>`)}

    ${card('Latest Diagnostic',latest?`<div class="release-status-list">${latest.results.map(result=>`
      <div class="release-status-row ${result.ok?'quality-pass':result.required?'quality-fail':'quality-warn'}">
        <span>${result.ok?'✓':result.required?'×':'△'} ${esc(result.name)}<small>${esc(result.detail)} · ${result.durationMs} ms</small></span>
        <strong>${result.ok?'READY':result.required?'FAILED':'OPTIONAL'}</strong>
      </div>`).join('')}</div>`:empty('No diagnostic results','Run diagnostics to inspect startup services.'),'wide')}

    ${card('Startup History',startupRecoveryHistory(),'wide')}

    ${card('Offline-Safe Behavior',`<div class="intel-list">
      <div class="intel-row"><span class="intel-icon">✓</span><div><strong>Predictions and combos remain local</strong><small>Core records stay available without a cloud connection.</small></div></div>
      <div class="intel-row"><span class="intel-icon">✓</span><div><strong>Backups remain available</strong><small>Local export and restore tools do not require a provider.</small></div></div>
      <div class="intel-row"><span class="intel-icon">△</span><div><strong>Live feeds may be unavailable</strong><small>Scores, rankings, weather, and availability require configured providers.</small></div></div>
      <div class="intel-row"><span class="intel-icon">△</span><div><strong>Cross-device sync may be unavailable</strong><small>Production account sync requires a configured cloud backend.</small></div></div>
    </div>`,'wide')}
  </div>`;
}

function bindStartupRecovery(){
  const toggle=(id,key)=>{
    if($(id))$(id).onchange=event=>{
      smartStartupState[key]=event.target.checked;
      saveSmartStartupState();
    };
  };

  toggle('startupEnabled','enabled');
  toggle('startupEveryLaunch','showEveryLaunch');
  toggle('startupContinueOffline','continueOffline');
  toggle('startupAutoRecovery','autoOpenRecoveryOnFailure');

  if($('startupMinimumDuration'))$('startupMinimumDuration').onchange=event=>{
    smartStartupState.minimumDisplayMs=Number(event.target.value)||1800;
    saveSmartStartupState();
  };

  if($('startupRunAgain'))$('startupRunAgain').onclick=async()=>{
    const button=$('startupRunAgain');
    button.disabled=true;
    button.textContent='Running…';
    await runStartupDiagnostics();
    renderPage();
    toast('Startup diagnostics completed','success');
  };

  if($('startupShowIntro'))$('startupShowIntro').onclick=showSmartStartup;
}

function installSmartStartupStyles(){
  if(document.getElementById('onlybeatsSmartStartupStyles'))return;
  const style=document.createElement('style');
  style.id='onlybeatsSmartStartupStyles';
  style.textContent=`
    .smart-startup-overlay{position:fixed;inset:0;z-index:50000;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 20%,rgba(244,189,69,.09),transparent 36%),#070b11;opacity:1;transition:opacity .35s ease}
    .smart-startup-overlay.complete{opacity:0}
    .smart-startup-card{width:min(620px,100%);max-height:min(760px,92vh);overflow:hidden;padding:34px;border:1px solid rgba(244,189,69,.28);border-radius:28px;background:#101822;box-shadow:0 32px 110px rgba(0,0,0,.65)}
    .smart-startup-card>img{display:block;width:124px;height:124px;object-fit:contain;margin:0 auto 16px;border-radius:28px}
    .smart-startup-card h1{text-align:center;font-size:clamp(2rem,6vw,3.3rem);margin:4px 0 10px}
    .smart-startup-card>p{text-align:center}
    .smart-startup-progress{height:10px;margin:22px 0 16px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}
    .smart-startup-progress span{display:block;width:0;height:100%;border-radius:99px;background:#f4bd45;transition:width .25s ease}
    .smart-startup-checks{display:grid;gap:7px;max-height:310px;overflow-y:auto;padding-right:5px}
    .smart-startup-check{display:grid;grid-template-columns:28px 1fr;gap:10px;align-items:center;padding:9px 11px;border-radius:11px;background:rgba(255,255,255,.025)}
    .smart-startup-check.pass>span{color:#72e7a3}.smart-startup-check.warn>span{color:#f4bd45}.smart-startup-check.fail>span{color:#ff8a8a}
    .smart-startup-check small{display:block;color:#9aabbd;margin-top:2px}
    .smart-startup-footer{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,.08)}
    .smart-startup-footer strong{color:#f4bd45}
    .smart-startup-overlay.recovery .smart-startup-footer{align-items:flex-start;flex-direction:column}
    @media(max-width:650px){.smart-startup-card{padding:24px}.smart-startup-footer{align-items:flex-start;flex-direction:column}}
  `;
  document.head.appendChild(style);
}

function initializeSmartStartup(){
  loadSmartStartupState();
  installSmartStartupStyles();
  setTimeout(showSmartStartup,250);
}
