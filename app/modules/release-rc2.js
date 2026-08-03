'use strict';

const RC2_RENDER_METRICS_KEY='onlybeats.rc2.render.metrics.v1';
const RC2_STARTUP_KEY='onlybeats.rc2.startup.v1';

let rc2BootStarted=performance.now();
let rc2ProviderBanner=null;

function rc2ReadSession(key,fallback){
  try{
    const value=JSON.parse(sessionStorage.getItem(key)||'null');
    return value??fallback;
  }catch{
    return fallback;
  }
}

function rc2WriteSession(key,value){
  try{sessionStorage.setItem(key,JSON.stringify(value))}catch{}
}

function recordPageRenderMetric(page,duration){
  const rows=rc2ReadSession(RC2_RENDER_METRICS_KEY,[]);
  rows.push({page:String(page||'unknown'),duration:Number(duration||0),time:new Date().toISOString()});
  rc2WriteSession(RC2_RENDER_METRICS_KEY,rows.slice(-100));
}

function getPageRenderMetrics(){
  return rc2ReadSession(RC2_RENDER_METRICS_KEY,[]);
}

function summarizePageRenderMetrics(){
  const rows=getPageRenderMetrics();
  const byPage=new Map();
  for(const row of rows){
    if(!byPage.has(row.page))byPage.set(row.page,[]);
    byPage.get(row.page).push(row.duration);
  }
  return [...byPage.entries()].map(([page,durations])=>({
    page,
    count:durations.length,
    average:durations.reduce((a,b)=>a+b,0)/durations.length,
    max:Math.max(...durations)
  })).sort((a,b)=>b.average-a.average);
}

function installRc2Styles(){
  if(document.getElementById('onlybeatsRc2Styles'))return;
  const style=document.createElement('style');
  style.id='onlybeatsRc2Styles';
  style.textContent=`
    .rc2-provider-banner{position:sticky;top:0;z-index:500;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 16px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(13,19,27,.96);backdrop-filter:blur(14px)}
    .rc2-provider-banner.hidden{display:none}
    .rc2-provider-banner strong{display:block}
    .rc2-provider-banner small{opacity:.78}
    .rc2-provider-banner.offline{border-bottom-color:rgba(220,80,80,.45)}
    .rc2-provider-banner.cached{border-bottom-color:rgba(244,189,69,.45)}
    .rc2-provider-banner.online{border-bottom-color:rgba(84,190,120,.4)}
  `;
  document.head.appendChild(style);
}

function ensureReleaseProviderBanner(){
  if(rc2ProviderBanner&&document.body.contains(rc2ProviderBanner))return rc2ProviderBanner;
  rc2ProviderBanner=document.createElement('div');
  rc2ProviderBanner.id='rc2ProviderBanner';
  rc2ProviderBanner.className='rc2-provider-banner hidden';
  rc2ProviderBanner.innerHTML=`
    <div><strong id="rc2ProviderTitle">Provider status</strong><small id="rc2ProviderDetail">Checking connection…</small></div>
    <button class="button" id="rc2ProviderRetry">Refresh now</button>`;
  document.body.prepend(rc2ProviderBanner);
  rc2ProviderBanner.querySelector('#rc2ProviderRetry').onclick=async()=>{
    const button=rc2ProviderBanner.querySelector('#rc2ProviderRetry');
    button.disabled=true;
    button.textContent='Refreshing…';
    try{await syncScores(false);updateReleaseProviderBanner()}
    finally{button.disabled=false;button.textContent='Refresh now'}
  };
  return rc2ProviderBanner;
}

function updateReleaseProviderBanner(){
  const banner=ensureReleaseProviderBanner();
  const title=banner.querySelector('#rc2ProviderTitle');
  const detail=banner.querySelector('#rc2ProviderDetail');
  banner.classList.remove('hidden','offline','cached','online');

  if(!navigator.onLine){
    banner.classList.add('offline');
    title.textContent='You are offline';
    detail.textContent='OnlyBeats is using locally cached scores and saved data.';
    return;
  }
  if(syncError){
    banner.classList.add('cached');
    title.textContent='Live provider unavailable';
    detail.textContent=`Cached data remains available${lastSync?` · Last sync ${lastSync.toLocaleTimeString()}`:''}.`;
    return;
  }
  if(lastSync){
    banner.classList.add('online');
    title.textContent='Live services connected';
    detail.textContent=`Last score sync ${lastSync.toLocaleTimeString()}.`;
    setTimeout(()=>banner.classList.add('hidden'),3000);
    return;
  }
  banner.classList.add('cached');
  title.textContent='Live services ready';
  detail.textContent='Scores have not been refreshed in this session.';
}

function installProviderStateListeners(){
  window.addEventListener('online',updateReleaseProviderBanner);
  window.addEventListener('offline',updateReleaseProviderBanner);
}

function recordRc2StartupMetric(){
  const payload={
    time:new Date().toISOString(),
    duration:performance.now()-rc2BootStarted,
    page:typeof currentPage==='string'?currentPage:'unknown',
    games:Array.isArray(games)?games.length:0
  };
  rc2WriteSession(RC2_STARTUP_KEY,payload);
  return payload;
}

function getRc2StartupMetric(){
  return rc2ReadSession(RC2_STARTUP_KEY,null);
}

function rc2RecoverySnapshot(){
  return {
    version:VERSION,
    currentPage,
    online:navigator.onLine,
    syncError:String(syncError||''),
    lastSync:lastSync?lastSync.toISOString():null,
    games:Array.isArray(games)?games.length:0,
    predictions:Array.isArray(predictions)?predictions.length:0,
    futures:Array.isArray(futures)?futures.length:0,
    availability:Array.isArray(availabilityEntries)?availabilityEntries.length:0,
    timeline:Array.isArray(timelineEvents)?timelineEvents.length:0,
    pinned:Array.isArray(pinnedGameIds)?pinnedGameIds.length:0,
    startup:getRc2StartupMetric(),
    renderMetrics:summarizePageRenderMetrics()
  };
}

function exportRc2RecoverySnapshot(){
  const blob=new Blob([JSON.stringify(rc2RecoverySnapshot(),null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=`onlybeats-rc2-recovery-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function rc2ReleaseChecks(){
  const base=runReleaseReadinessChecks();
  const renderMetrics=summarizePageRenderMetrics();
  const checks=[
    ...base.checks,
    releaseCheck('Provider banner available',typeof updateReleaseProviderBanner==='function','Offline and cached-state messaging'),
    releaseCheck('Render metrics active',typeof recordPageRenderMetric==='function',`${renderMetrics.length} pages measured`),
    releaseCheck('Recovery export active',typeof exportRc2RecoverySnapshot==='function','Local diagnostic snapshot'),
    releaseCheck('Online state available',typeof navigator.onLine==='boolean',navigator.onLine?'Online':'Offline')
  ];
  releaseReadinessReport={time:new Date().toISOString(),checks,passed:checks.filter(c=>c.ok).length,failed:checks.filter(c=>!c.ok).length};
  return releaseReadinessReport;
}

function rc2SettingsCard(){
  const startup=getRc2StartupMetric();
  const metrics=summarizePageRenderMetrics();
  const slowest=metrics[0];
  return `<section class="card settings-card">
    <h3>RC2 performance & recovery</h3>
    <div class="detail-list">
      <div><span>Startup time</span><strong>${startup?`${startup.duration.toFixed(0)} ms`:'Pending'}</strong></div>
      <div><span>Pages measured</span><strong>${metrics.length}</strong></div>
      <div><span>Slowest average page</span><strong>${slowest?`${esc(slowest.page)} · ${slowest.average.toFixed(1)} ms`:'Not enough data'}</strong></div>
      <div><span>Provider state</span><strong>${!navigator.onLine?'Offline':syncError?'Cached':'Online'}</strong></div>
    </div>
    <div class="button-row"><button class="button primary" id="runRc2Checks">Run RC2 checks</button><button class="button" id="exportRc2Recovery">Export recovery snapshot</button></div>
  </section>`;
}

function bindRc2Settings(){
  if($('runRc2Checks'))$('runRc2Checks').onclick=()=>{
    const report=rc2ReleaseChecks();
    toast(report.failed?`${report.failed} RC2 checks need attention`:'All RC2 checks passed',report.failed?'error':'success');
    renderPage();
  };
  if($('exportRc2Recovery'))$('exportRc2Recovery').onclick=()=>{exportRc2RecoverySnapshot();toast('Recovery snapshot exported')};
}

function patchRc2SettingsCard(){
  const original=window.releaseReadinessSettingsCard;
  if(typeof original==='function'&&!original.__rc2Wrapped){
    const wrapped=function(){return original()+rc2SettingsCard()};
    wrapped.__rc2Wrapped=true;
    window.releaseReadinessSettingsCard=wrapped;
  }
  const originalBind=window.bindReleaseReadinessSettings;
  if(typeof originalBind==='function'&&!originalBind.__rc2Wrapped){
    const wrappedBind=function(){originalBind();bindRc2Settings()};
    wrappedBind.__rc2Wrapped=true;
    window.bindReleaseReadinessSettings=wrappedBind;
  }
}

function initializeReleaseCandidateTwo(){
  installRc2Styles();
  ensureReleaseProviderBanner();
  installProviderStateListeners();
  patchRc2SettingsCard();
  updateReleaseProviderBanner();
  window.addEventListener('load',()=>setTimeout(recordRc2StartupMetric,0),{once:true});
  setTimeout(recordRc2StartupMetric,1200);
}
