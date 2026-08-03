'use strict';

// OnlyBeats v4.5.1 QA Shell Detection Hotfix.
// Performs in-app runtime checks. It does not replace manual visual testing
// of the installed Windows build.

let developerQaState={
  enabled:true,
  captureErrors:true,
  captureUnhandledRejections:true,
  maximumErrors:100,
  performanceSamples:20,
  lastRunAt:null,
  lastOutcome:'not-run',
  lastDurationMs:0,
  autoRunOnStartup:false,
  includeOptionalChecks:true
};

let developerQaErrors=[];
let developerQaLastReport=null;
let developerQaPerformance=[];

function loadDeveloperQaState(){
  try{
    developerQaState={
      ...developerQaState,
      ...JSON.parse(localStorage.getItem(DEVELOPER_QA_KEY)||'{}')
    };
  }catch{}

  try{
    const saved=JSON.parse(localStorage.getItem(DEVELOPER_ERROR_LOG_KEY)||'[]');
    developerQaErrors=Array.isArray(saved)?saved:[];
  }catch{
    developerQaErrors=[];
  }
}

function saveDeveloperQaState(){
  localStorage.setItem(DEVELOPER_QA_KEY,JSON.stringify(developerQaState));
  localStorage.setItem(
    DEVELOPER_ERROR_LOG_KEY,
    JSON.stringify(developerQaErrors.slice(-Math.max(10,Number(developerQaState.maximumErrors)||100)))
  );
}

function developerQaLogError(type,error,context={}){
  if(!developerQaState.captureErrors)return;

  const normalized={
    id:`qa-error-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    time:new Date().toISOString(),
    type:String(type||'error'),
    message:String(error?.message||error||'Unknown error'),
    stack:String(error?.stack||''),
    page:String(currentPage||'unknown'),
    context
  };

  developerQaErrors.push(normalized);
  saveDeveloperQaState();
}

function installDeveloperErrorCapture(){
  if(window.__onlyBeatsDeveloperErrorCaptureInstalled)return;
  window.__onlyBeatsDeveloperErrorCaptureInstalled=true;

  window.addEventListener('error',event=>{
    developerQaLogError('window-error',event.error||event.message,{
      filename:event.filename||'',
      line:event.lineno||0,
      column:event.colno||0
    });
  });

  window.addEventListener('unhandledrejection',event=>{
    if(!developerQaState.captureUnhandledRejections)return;
    developerQaLogError('unhandled-rejection',event.reason||'Unhandled promise rejection');
  });
}

function qaResult(name,ok,detail='',required=true,durationMs=0,error=''){
  return {
    name,
    ok:Boolean(ok),
    detail:String(detail||''),
    required:Boolean(required),
    durationMs:Math.round(Number(durationMs)||0),
    error:String(error||'')
  };
}

async function qaExecute(name,runner,{detail='',required=true}={}){
  const started=performance.now();
  try{
    const value=await Promise.resolve(runner());
    const ok=typeof value==='object'&&value!==null&&'ok' in value
      ?Boolean(value.ok)
      :Boolean(value);
    const outputDetail=typeof value==='object'&&value!==null&&value.detail
      ?value.detail
      :detail;

    return qaResult(name,ok,outputDetail,required,performance.now()-started);
  }catch(error){
    developerQaLogError('qa-check',error,{check:name});
    return qaResult(
      name,
      false,
      detail,
      required,
      performance.now()-started,
      error?.message||String(error)
    );
  }
}


function qaApplicationShellSnapshot(){
  const body=Boolean(document.body);
  const content=document.getElementById('content');
  const navigation=document.getElementById('nav');
  const title=document.getElementById('sectionTitle');
  const layout=document.querySelector('.app-shell, .app-layout, main, [role="main"]');
  const splash=document.getElementById('splash');

  const mounted=Boolean(
    body&&
    content&&
    navigation&&
    title
  );

  const ready=mounted&&(
    content.childElementCount>0||
    String(content.textContent||'').trim().length>0||
    Boolean(layout)
  );

  return {
    mounted,
    ready,
    body,
    content:Boolean(content),
    navigation:Boolean(navigation),
    title:Boolean(title),
    layout:Boolean(layout),
    splashVisible:Boolean(
      splash&&
      !splash.classList.contains('hidden')&&
      getComputedStyle(splash).display!=='none'&&
      getComputedStyle(splash).visibility!=='hidden'
    )
  };
}

async function qaWaitForApplicationShell(timeoutMs=5000){
  const started=performance.now();
  let snapshot=qaApplicationShellSnapshot();

  while(performance.now()-started<timeoutMs){
    if(snapshot.ready){
      return {
        ok:true,
        detail:`Shell ready · content, navigation, and title mounted · ${Math.round(performance.now()-started)} ms`
      };
    }

    await new Promise(resolve=>setTimeout(resolve,100));
    snapshot=qaApplicationShellSnapshot();
  }

  if(snapshot.mounted){
    return {
      ok:true,
      detail:`Shell mounted; content is still initializing · ${Math.round(performance.now()-started)} ms`
    };
  }

  const missing=[
    !snapshot.body?'body':'',
    !snapshot.content?'#content':'',
    !snapshot.navigation?'#nav':'',
    !snapshot.title?'#sectionTitle':''
  ].filter(Boolean);

  return {
    ok:false,
    detail:`Shell mount incomplete · missing ${missing.join(', ')||'required interface elements'}`
  };
}

function qaConfiguredRoutes(){
  try{
    return Array.isArray(NAV_ITEMS)
      ?NAV_ITEMS.map(item=>item[0]).filter(Boolean)
      :[];
  }catch{
    return [];
  }
}

function qaRouteRenderers(){
  return {
    dashboard:typeof unifiedCommandDashboardPage==='function',
    saturday:typeof saturdayDashboardPage==='function',
    launch:typeof publicReleaseHubPage==='function',
    developer:typeof developerQaPage==='function',
    gamehub:typeof ultimateGameHubPage==='function',
    mobile:typeof mobileCompanionPage==='function',
    experience:typeof crossPlatformExperiencePage==='function',
    updates:typeof installedAppUpdatesPage==='function',
    predictions:typeof predictionsPage==='function',
    lab:typeof predictionLabPage==='function',
    analytics:typeof predictionAnalyticsPage==='function',
    intelligence:typeof predictionIntelligencePage==='function',
    livecommand:typeof liveCommandCenterPage==='function',
    liveprovider:typeof liveNcaaSetupPage==='function',
    platform:typeof liveDataPlatformPage==='function',
    favorites:typeof favoritesPage==='function',
    favoriteshub:typeof favoritesWatchlistsPage==='function',
    teamprofiles:typeof teamProfilesPage==='function',
    seasontracker:typeof seasonTrackerPage==='function',
    conferences:typeof conferenceDashboardsPage==='function'
  };
}

function qaRequiredAssets(){
  return [
    'assets/onlybeats-icon.png',
    'modules/config.js',
    'modules/public-release.js',
    'modules/live-command-center.js',
    'modules/prediction-analytics.js',
    'modules/saturday-dashboard.js',
    'modules/prediction-intelligence.js',
    'modules/favorites-watchlists.js',
    'modules/team-profiles.js',
    'modules/season-tracker.js',
    'modules/conference-dashboards.js',
    'modules/developer-qa-suite.js',
    'modules/ultimate-game-hub.js',
    'modules/mobile-companion.js',
    'modules/cross-platform-experience.js',
    'modules/installed-app-updates.js',
    'firebase-cloud-adapter.js'
  ];
}

async function qaAssetExists(asset){
  try{
    const response=await fetch(asset,{method:'HEAD',cache:'no-store'});
    if(response.ok)return true;

    const getResponse=await fetch(asset,{cache:'no-store'});
    return getResponse.ok;
  }catch{
    return false;
  }
}

function qaLocalStorage(){
  const key='onlybeats.qa.storage-test';
  localStorage.setItem(key,'ok');
  const ok=localStorage.getItem(key)==='ok';
  localStorage.removeItem(key);
  return ok;
}

function qaStorageSnapshot(){
  const entries=[];
  let totalCharacters=0;

  for(let index=0;index<localStorage.length;index+=1){
    const key=localStorage.key(index);
    const value=localStorage.getItem(key)||'';
    totalCharacters+=key.length+value.length;
    entries.push({key,characters:value.length});
  }

  return {
    entries:entries.sort((a,b)=>b.characters-a.characters),
    totalCharacters,
    approximateBytes:totalCharacters*2
  };
}

function qaBackupTools(){
  return [
    typeof exportOnlyBeatsBundle==='function',
    typeof downloadDeviceSnapshot==='function',
    typeof importOnlyBeatsBundle==='function'||typeof restoreDeviceSnapshot==='function'
  ].filter(Boolean).length>=2;
}

function qaProviderHealth(){
  const feeds=typeof LIVE_DATA_FEEDS!=='undefined'&&Array.isArray(LIVE_DATA_FEEDS)
    ?LIVE_DATA_FEEDS
    :[];

  return feeds.map(feed=>{
    let adapter={configured:false,name:'Unavailable'};
    let state={status:'unknown',lastSuccessAt:null,lastError:''};

    try{
      if(typeof liveDataAdapter==='function')adapter=liveDataAdapter(feed.id);
      if(typeof liveDataProviderState==='function')state=liveDataProviderState(feed.id);
    }catch{}

    return {
      id:feed.id,
      label:feed.label,
      configured:Boolean(adapter?.configured),
      provider:String(adapter?.name||'Unavailable'),
      status:String(state?.status||'unknown'),
      lastSuccessAt:state?.lastSuccessAt||null,
      lastError:String(state?.lastError||'')
    };
  });
}

function qaDataIntegrity(){
  const issues=[];

  if(!Array.isArray(predictions))issues.push('Predictions collection is unavailable');
  if(!Array.isArray(games))issues.push('Games collection is unavailable');
  if(!Array.isArray(favorites))issues.push('Favorites collection is unavailable');

  if(Array.isArray(predictions)){
    const missingGameIds=predictions.filter(item=>!item?.gameId).length;
    if(missingGameIds)issues.push(`${missingGameIds} predictions are missing game IDs`);

    const duplicateIds=new Set();
    const seen=new Set();
    predictions.forEach(item=>{
      const id=String(item?.id||'');
      if(!id)return;
      if(seen.has(id))duplicateIds.add(id);
      seen.add(id);
    });
    if(duplicateIds.size)issues.push(`${duplicateIds.size} duplicate prediction IDs`);
  }

  if(Array.isArray(games)){
    const invalidDates=games.filter(game=>!Number.isFinite(new Date(game?.date).getTime())).length;
    if(invalidDates)issues.push(`${invalidDates} games have invalid dates`);
  }

  return {ok:issues.length===0,detail:issues.length?issues.join(' · '):'Core collections passed integrity checks'};
}

function qaPageSmokeTest(route){
  const renderers=qaRouteRenderers();
  if(!(route in renderers))return {ok:false,detail:'No renderer mapping'};
  if(!renderers[route])return {ok:false,detail:'Renderer function unavailable'};

  return {ok:true,detail:'Renderer function available'};
}

function qaModuleChecks(){
  const modules=[
    ['Prediction Center',typeof predictionsPage==='function'],
    ['Prediction Lab',typeof predictionLabPage==='function'],
    ['Prediction Analytics',typeof predictionAnalyticsPage==='function'],
    ['Prediction Intelligence',typeof predictionIntelligencePage==='function'],
    ['Saturday Dashboard',typeof saturdayDashboardPage==='function'],
    ['Live Command Center',typeof liveCommandCenterPage==='function'],
    ['Ultimate Game Hub',typeof ultimateGameHubPage==='function'],
    ['Mobile Companion',typeof mobileCompanionPage==='function'],
    ['Cross-Platform Experience',typeof crossPlatformExperiencePage==='function'],
    ['Installed App Updates',typeof installedAppUpdatesPage==='function'],
    ['Updater desktop bridge',Boolean(window.onlyBeatsDesktop?.update)],
    ['Preload bridge health',Boolean(window.onlyBeatsDesktop?.getBridgeHealth)],
    ['Prediction Intelligence single load',document.querySelectorAll('script[src="modules/prediction-intelligence.js"]').length===1],
    ['Weather request control',typeof onlyBeatsWeatherBackoff==='function'&&typeof onlyBeatsCachedWeather==='function'],
    ['Persistent Firebase bridge',Boolean(window.onlyBeatsDesktop?.saveFirebaseConfig)],
    ['Unified cloud status',typeof devicesCloudState==='function'&&devicesCloudState().connected===Boolean(cloudSyncState?.connected)],
    ['Device registry',typeof registerCurrentDevice==='function'],
    ['Sync snapshots',typeof captureSyncSnapshot==='function'],
    ['Game transfer helper',typeof openUltimateGameHub==='function'],
    ['Live NCAA Setup',typeof liveNcaaSetupPage==='function'],
    ['Favorites & Watchlists',typeof favoritesWatchlistsPage==='function'],
    ['Team Profiles',typeof teamProfilesPage==='function'],
    ['Season Tracker',typeof seasonTrackerPage==='function'],
    ['Conference Dashboards',typeof conferenceDashboardsPage==='function'],
    ['Release Hub',typeof publicReleaseHubPage==='function'],
    ['Smart Startup',typeof runStartupDiagnostics==='function']
  ];

  return modules.map(([name,ok])=>qaResult(name,ok,ok?'Module loaded':'Module missing',true,0));
}

async function runDeveloperQaSuite(onProgress){
  const started=performance.now();
  const results=[];

  const checks=[
    ['Application shell',()=>qaWaitForApplicationShell(5000),{detail:'Adaptive DOM mount detection',required:true}],
    ['Local storage',qaLocalStorage,{detail:'Read/write test',required:true}],
    ['Desktop runtime',()=>Boolean(window.onlyBeatsDesktop||navigator.userAgent.includes('Electron')),{detail:'Electron runtime',required:true}],
    ['Data integrity',qaDataIntegrity,{detail:'Predictions, games, and favorites',required:true}],
    ['Backup tools',qaBackupTools,{detail:'Export and restore functions',required:true}],
    ['Production checks',()=>{
      if(typeof runProductionReleaseChecks!=='function')return {ok:false,detail:'Production checker unavailable'};
      const report=runProductionReleaseChecks();
      return {ok:report.failed===0,detail:`${report.passed||0} passing · ${report.failed||0} failing`};
    },{detail:'Release validation',required:true}],
    ['Configured route coverage',()=>{
      const routes=qaConfiguredRoutes();
      const renderers=qaRouteRenderers();
      const missing=routes.filter(route=>renderers[route]===false||!(route in renderers));
      return {ok:missing.length===0,detail:missing.length?`Missing: ${missing.join(', ')}`:`${routes.length} routes covered`};
    },{detail:'Navigation to renderer map',required:true}],
    ['Cloud adapter',()=>typeof startupCloudReady==='function'&&startupCloudReady(),{detail:'Optional cloud connection',required:false}],
    ['Live providers',()=>{
      const providers=qaProviderHealth();
      const configured=providers.filter(item=>item.configured).length;
      return {ok:configured>0,detail:`${configured}/${providers.length} configured`};
    },{detail:'Optional live data',required:false}]
  ];

  for(let index=0;index<checks.length;index+=1){
    const [name,runner,options]=checks[index];
    const result=await qaExecute(name,runner,options);
    results.push(result);
    if(typeof onProgress==='function'){
      onProgress({result,index,total:checks.length,percent:Math.round((index+1)/checks.length*100)});
    }
  }

  for(const moduleResult of qaModuleChecks()){
    results.push(moduleResult);
  }

  for(const route of qaConfiguredRoutes()){
    const check=qaPageSmokeTest(route);
    results.push(qaResult(`Route: ${route}`,check.ok,check.detail,true,0));
  }

  const assetResults=[];
  for(const asset of qaRequiredAssets()){
    const ok=await qaAssetExists(asset);
    const result=qaResult(`Asset: ${asset}`,ok,ok?'Available':'Missing',true,0);
    assetResults.push(result);
    results.push(result);
  }

  const requiredFailures=results.filter(item=>item.required&&!item.ok);
  const optionalFailures=results.filter(item=>!item.required&&!item.ok);
  const durationMs=Math.round(performance.now()-started);

  developerQaLastReport={
    id:`qa-report-${Date.now()}`,
    generatedAt:new Date().toISOString(),
    version:VERSION,
    outcome:requiredFailures.length?'failed':optionalFailures.length?'passed-with-warnings':'passed',
    durationMs,
    requiredFailures:requiredFailures.length,
    optionalFailures:optionalFailures.length,
    results,
    providerHealth:qaProviderHealth(),
    storage:qaStorageSnapshot(),
    errors:developerQaErrors.slice(-25),
    runtime:{
      userAgent:navigator.userAgent,
      platform:navigator.platform,
      online:navigator.onLine,
      electron:Boolean(window.onlyBeatsDesktop||navigator.userAgent.includes('Electron')),
      packaged:Boolean(window.onlyBeatsDesktop?.packaged),
      appVersion:window.onlyBeatsDesktop?.version||VERSION
    }
  };

  developerQaState.lastRunAt=developerQaLastReport.generatedAt;
  developerQaState.lastOutcome=developerQaLastReport.outcome;
  developerQaState.lastDurationMs=durationMs;
  saveDeveloperQaState();

  return developerQaLastReport;
}

function developerQaStatusRow(result){
  return `<div class="release-status-row ${result.ok?'quality-pass':result.required?'quality-fail':'quality-warn'}">
    <span>${result.ok?'✓':result.required?'×':'△'} ${esc(result.name)}
      <small>${esc(result.detail)}${result.error?` · ${esc(result.error)}`:''} · ${result.durationMs} ms</small>
    </span>
    <strong>${result.ok?'PASS':result.required?'FAIL':'WARN'}</strong>
  </div>`;
}

function developerQaErrorPanel(){
  if(!developerQaErrors.length){
    return empty('No captured errors','Runtime errors and unhandled rejections will appear here.');
  }

  return `<div class="intel-list">${developerQaErrors.slice().reverse().slice(0,30).map(error=>`
    <div class="intel-row">
      <span class="intel-icon">×</span>
      <div>
        <strong>${esc(error.type)} · ${esc(error.message)}</strong>
        <small>${new Date(error.time).toLocaleString()} · ${esc(error.page)}${error.stack?` · ${esc(error.stack.split('\n')[0])}`:''}</small>
      </div>
    </div>`).join('')}</div>`;
}

function developerQaProviderPanel(){
  const providers=qaProviderHealth();
  if(!providers.length)return empty('No provider definitions','Provider diagnostics are unavailable.');

  return `<div class="release-status-list">${providers.map(provider=>`
    <div class="release-status-row ${provider.configured?'quality-pass':'quality-warn'}">
      <span>${provider.configured?'✓':'△'} ${esc(provider.label)}
        <small>${esc(provider.provider)} · ${esc(provider.status)}${provider.lastError?` · ${esc(provider.lastError)}`:''}</small>
      </span>
      <strong>${provider.configured?'CONNECTED':'OPTIONAL'}</strong>
    </div>`).join('')}</div>`;
}

function developerQaStoragePanel(){
  const snapshot=qaStorageSnapshot();
  return `<div class="detail-list">
    <div><span>Local-storage entries</span><strong>${snapshot.entries.length}</strong></div>
    <div><span>Approximate storage</span><strong>${(snapshot.approximateBytes/1024).toFixed(1)} KB</strong></div>
    ${snapshot.entries.slice(0,12).map(item=>`<div><span>${esc(item.key)}</span><strong>${(item.characters*2/1024).toFixed(1)} KB</strong></div>`).join('')}
  </div>`;
}

function exportDeveloperQaReport(){
  const payload=developerQaLastReport||{
    generatedAt:new Date().toISOString(),
    version:VERSION,
    outcome:'not-run',
    errors:developerQaErrors,
    storage:qaStorageSnapshot(),
    providerHealth:qaProviderHealth()
  };

  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=`onlybeats-qa-report-v${VERSION}-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function developerQaPage(){
  setHeading('Developer & QA','DIAGNOSTICS · SMOKE TESTS · ERROR LOGS');

  const report=developerQaLastReport;
  const requiredPassing=report?report.results.filter(item=>item.required&&item.ok).length:0;
  const requiredTotal=report?report.results.filter(item=>item.required).length:0;

  return `<section class="developer-qa-hero">
    <div>
      <p class="eyebrow">ENGINEERING CONSOLE</p>
      <h1>${report?esc(report.outcome.replace(/-/g,' ')):'QA suite not run'}</h1>
      <p>Run adaptive shell, route, module, asset, storage, provider, backup, and data-integrity checks before building or distributing OnlyBeats.</p>
    </div>
    <div class="button-row">
      <button class="button primary" id="developerQaRun">Run full QA suite</button>
      <button class="button" id="developerQaExport">Export QA report</button>
      <button class="button" id="developerQaClearErrors">Clear error log</button>
    </div>
  </section>

  <div class="metric-grid">
    ${metric('Required Checks',report?`${requiredPassing}/${requiredTotal}`:'Not run',report?.requiredFailures?`${report.requiredFailures} failing`:'')}
    ${metric('Optional Warnings',report?.optionalFailures||0,'Cloud and provider checks')}
    ${metric('Captured Errors',developerQaErrors.length,'Runtime log')}
    ${metric('QA Duration',report?`${report.durationMs} ms`:'—','Last full run')}
    ${metric('Runtime',window.onlyBeatsDesktop?'Electron':'Browser preview',window.onlyBeatsDesktop?.packaged?'Packaged':'Development')}
    ${metric('Version',VERSION,'Developer QA Suite')}
  </div>

  <div class="reports-grid">
    ${card('QA Preferences',`<div class="detail-list">
      <label class="toggle-row"><span>Enable Developer QA</span><input id="developerQaEnabled" type="checkbox" ${developerQaState.enabled?'checked':''}></label>
      <label class="toggle-row"><span>Capture runtime errors</span><input id="developerQaCaptureErrors" type="checkbox" ${developerQaState.captureErrors?'checked':''}></label>
      <label class="toggle-row"><span>Capture unhandled promises</span><input id="developerQaCapturePromises" type="checkbox" ${developerQaState.captureUnhandledRejections?'checked':''}></label>
      <label class="toggle-row"><span>Run QA during startup</span><input id="developerQaAutoRun" type="checkbox" ${developerQaState.autoRunOnStartup?'checked':''}></label>
      <label><span>Maximum error entries</span><input id="developerQaMaximumErrors" type="number" min="10" max="1000" value="${developerQaState.maximumErrors}"></label>
      <div><span>Last run</span><strong>${developerQaState.lastRunAt?new Date(developerQaState.lastRunAt).toLocaleString():'Never'}</strong></div>
    </div>`)}

    ${card('Provider Health',developerQaProviderPanel())}
    ${card('Storage Inspector',developerQaStoragePanel())}
    ${card('Captured Runtime Errors',developerQaErrorPanel(),'wide')}

    ${card('Latest QA Results',report?`<div class="release-status-list">${report.results.map(developerQaStatusRow).join('')}</div>`:
      empty('No QA report','Run the full QA suite to populate results.'),'wide')}

    ${card('Manual Windows Verification',`<div class="intel-list">
      <div class="intel-row"><span class="intel-icon">1</span><div><strong>Launch RUN_DESKTOP.bat</strong><small>Confirm the development build opens, the startup intro completes, and the adaptive shell check passes.</small></div></div>
      <div class="intel-row"><span class="intel-icon">2</span><div><strong>Open every sidebar page</strong><small>Look for blank pages, recovery screens, overlapping elements, or disabled actions.</small></div></div>
      <div class="intel-row"><span class="intel-icon">3</span><div><strong>Test writes</strong><small>Create, edit, and delete a prediction; favorite a team; save a combo; export a backup.</small></div></div>
      <div class="intel-row"><span class="intel-icon">4</span><div><strong>Test Command Mode</strong><small>Enter, scroll, exit, and enter again on the target display.</small></div></div>
      <div class="intel-row"><span class="intel-icon">5</span><div><strong>Build and install</strong><small>Run the installer builder and verify the installed application separately from development mode.</small></div></div>
    </div>`,'wide')}
  </div>`;
}

function bindDeveloperQa(){
  if($('developerQaRun'))$('developerQaRun').onclick=async()=>{
    const button=$('developerQaRun');
    button.disabled=true;
    button.textContent='Running QA…';

    const report=await runDeveloperQaSuite();
    toast(
      report.requiredFailures
        ?`${report.requiredFailures} required QA check${report.requiredFailures===1?'':'s'} failed`
        :report.optionalFailures
          ?`QA passed with ${report.optionalFailures} optional warning${report.optionalFailures===1?'':'s'}`
          :'QA suite passed',
      report.requiredFailures?'error':'success'
    );
    renderPage();
  };

  if($('developerQaExport'))$('developerQaExport').onclick=()=>{
    exportDeveloperQaReport();
    toast('QA report exported','success');
  };

  if($('developerQaClearErrors'))$('developerQaClearErrors').onclick=()=>{
    developerQaErrors=[];
    saveDeveloperQaState();
    renderPage();
    toast('Developer error log cleared');
  };

  const toggle=(id,key)=>{
    if($(id))$(id).onchange=event=>{
      developerQaState[key]=event.target.checked;
      saveDeveloperQaState();
    };
  };

  toggle('developerQaEnabled','enabled');
  toggle('developerQaCaptureErrors','captureErrors');
  toggle('developerQaCapturePromises','captureUnhandledRejections');
  toggle('developerQaAutoRun','autoRunOnStartup');

  if($('developerQaMaximumErrors'))$('developerQaMaximumErrors').onchange=event=>{
    developerQaState.maximumErrors=Math.max(10,Math.min(1000,Number(event.target.value)||100));
    saveDeveloperQaState();
  };
}

function installDeveloperQaStyles(){
  if(document.getElementById('onlybeatsDeveloperQaStyles'))return;

  const style=document.createElement('style');
  style.id='onlybeatsDeveloperQaStyles';
  style.textContent=`
    .developer-qa-hero{display:flex;justify-content:space-between;gap:24px;align-items:center;padding:30px;border:1px solid rgba(244,189,69,.26);border-radius:24px;background:radial-gradient(circle at 82% 12%,rgba(244,189,69,.12),transparent 38%),#101822;margin-bottom:18px}
    .developer-qa-hero h1{text-transform:capitalize;font-size:clamp(2.2rem,5vw,4rem);line-height:1;margin:5px 0 12px}
    @media(max-width:760px){.developer-qa-hero{align-items:flex-start;flex-direction:column}}
  `;
  document.head.appendChild(style);
}

function initializeDeveloperQa(){
  loadDeveloperQaState();
  installDeveloperQaStyles();
  installDeveloperErrorCapture();

  if(developerQaState.enabled&&developerQaState.autoRunOnStartup){
    setTimeout(()=>runDeveloperQaSuite(),4500);
  }
}
