'use strict';

// OnlyBeats v2.5 Live Data Platform — Phase 1.
// Provider orchestration and normalization without claiming feeds are connected.

const LIVE_DATA_FEEDS=[
  {id:'scores',label:'Scores & Schedule',required:true,defaultInterval:60},
  {id:'rankings',label:'Rankings',required:false,defaultInterval:900},
  {id:'weather',label:'Weather',required:false,defaultInterval:600},
  {id:'availability',label:'Player Availability',required:false,defaultInterval:300},
  {id:'lines',label:'Prediction Market Data',required:false,defaultInterval:300}
];

let liveDataPlatformState={
  autoRefresh:true,
  paused:false,
  selectedFeed:'all',
  lastCycleAt:null,
  lastSuccessfulCycleAt:null,
  cycleCount:0,
  errorCount:0,
  providerStates:{}
};
let liveDataPlatformActivity=[];
let liveDataCycleTimer=null;
let liveDataCycleInFlight=false;

function loadLiveDataPlatformState(){
  try{
    liveDataPlatformState={
      ...liveDataPlatformState,
      ...JSON.parse(localStorage.getItem(LIVE_DATA_PLATFORM_KEY)||'{}')
    };
  }catch{}
  try{
    const rows=JSON.parse(localStorage.getItem(LIVE_DATA_ACTIVITY_KEY)||'[]');
    liveDataPlatformActivity=Array.isArray(rows)?rows:[];
  }catch{
    liveDataPlatformActivity=[];
  }
}

function saveLiveDataPlatformState(){
  localStorage.setItem(LIVE_DATA_PLATFORM_KEY,JSON.stringify(liveDataPlatformState));
  localStorage.setItem(LIVE_DATA_ACTIVITY_KEY,JSON.stringify(liveDataPlatformActivity.slice(-400)));
}

function liveDataRecord(type,message,detail=''){
  liveDataPlatformActivity.push({
    id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    time:new Date().toISOString(),
    type,
    message,
    detail
  });
  if(liveDataPlatformActivity.length>400){
    liveDataPlatformActivity=liveDataPlatformActivity.slice(-400);
  }
  saveLiveDataPlatformState();
}

function liveDataProviderRegistry(){
  const registry=window.ONLYBEATS_LIVE_DATA_PROVIDERS;
  return registry&&typeof registry==='object'?registry:{};
}

function liveDataAdapter(feedId){
  const registry=liveDataProviderRegistry();
  const adapter=registry[feedId];
  if(adapter&&typeof adapter==='object')return adapter;
  return {
    id:feedId,
    name:'Not connected',
    configured:false,
    licensed:false,
    async fetch(){
      throw new Error(`${feedId} provider is not connected.`);
    }
  };
}

function liveDataProviderState(feedId){
  return liveDataPlatformState.providerStates[feedId]||{
    status:'Not configured',
    lastAttemptAt:null,
    lastSuccessAt:null,
    duration:0,
    records:0,
    error:''
  };
}

function updateLiveDataProviderState(feedId,patch){
  liveDataPlatformState.providerStates[feedId]={
    ...liveDataProviderState(feedId),
    ...patch
  };
  saveLiveDataPlatformState();
}

function normalizeLiveScoreRecord(record){
  if(!record||typeof record!=='object')return null;
  if(!record.id||!record.date||!record.away||!record.home)return null;
  return {
    id:String(record.id),
    date:String(record.date),
    state:['pre','in','post'].includes(record.state)?record.state:'pre',
    status:String(record.status||'Scheduled'),
    network:String(record.network||''),
    venue:String(record.venue||''),
    away:{
      abbr:String(record.away.abbr||'AWAY'),
      name:String(record.away.name||record.away.shortName||'Away'),
      shortName:String(record.away.shortName||record.away.name||'Away'),
      score:Number(record.away.score)||0,
      rank:Number(record.away.rank)||0
    },
    home:{
      abbr:String(record.home.abbr||'HOME'),
      name:String(record.home.name||record.home.shortName||'Home'),
      shortName:String(record.home.shortName||record.home.name||'Home'),
      score:Number(record.home.score)||0,
      rank:Number(record.home.rank)||0
    }
  };
}

function normalizeRankingRecord(record){
  if(!record||typeof record!=='object'||!record.team)return null;
  return {
    rank:Number(record.rank)||0,
    team:String(record.team),
    abbr:String(record.abbr||''),
    record:String(record.record||''),
    points:Number(record.points)||0,
    source:String(record.source||'provider')
  };
}

function normalizeAvailabilityRecord(record){
  if(!record||typeof record!=='object'||!record.player||!record.team)return null;
  const allowed=['Available','Questionable','Doubtful','Unavailable','Unknown'];
  return {
    id:String(record.id||`${record.team}-${record.player}`),
    team:String(record.team),
    player:String(record.player),
    position:String(record.position||''),
    status:allowed.includes(record.status)?record.status:'Unknown',
    notes:String(record.notes||''),
    source:String(record.source||'provider'),
    updatedAt:String(record.updatedAt||new Date().toISOString())
  };
}

function normalizeWeatherRecord(record){
  if(!record||typeof record!=='object')return null;
  return {
    location:String(record.location||'Unknown'),
    temperature:Number(record.temperature),
    wind:Number(record.wind),
    gust:Number(record.gust),
    precipitation:Number(record.precipitation),
    condition:String(record.condition||''),
    observedAt:String(record.observedAt||new Date().toISOString())
  };
}

function normalizeLineRecord(record){
  if(!record||typeof record!=='object'||!record.gameId)return null;
  return {
    gameId:String(record.gameId),
    market:String(record.market||''),
    selection:String(record.selection||''),
    value:Number(record.value),
    source:String(record.source||'licensed provider'),
    observedAt:String(record.observedAt||new Date().toISOString())
  };
}

function normalizeLiveData(feedId,payload){
  const rows=Array.isArray(payload)?payload:Array.isArray(payload?.records)?payload.records:[];
  const normalizer={
    scores:normalizeLiveScoreRecord,
    rankings:normalizeRankingRecord,
    weather:normalizeWeatherRecord,
    availability:normalizeAvailabilityRecord,
    lines:normalizeLineRecord
  }[feedId];
  if(!normalizer)return [];
  return rows.map(normalizer).filter(Boolean);
}

function applyLiveDataFeed(feedId,records){
  if(feedId==='scores'&&records.length){
    games=records;
    localStorage.setItem(SCORE_CACHE_KEY,JSON.stringify(games));
    lastSync=new Date();
  }

  if(feedId==='availability'&&records.length){
    const manual=availabilityEntries.filter(entry=>entry.source!=='provider');
    availabilityEntries=[...manual,...records];
    localStorage.setItem(AVAILABILITY_KEY,JSON.stringify(availabilityEntries));
  }

  if(feedId==='rankings'){
    window.ONLYBEATS_NORMALIZED_RANKINGS=records;
  }

  if(feedId==='weather'&&records.length){
    window.ONLYBEATS_NORMALIZED_WEATHER=records;
  }

  if(feedId==='lines'){
    window.ONLYBEATS_NORMALIZED_LINES=records;
  }

  return records.length;
}

async function refreshLiveDataFeed(feedId){
  const adapter=liveDataAdapter(feedId);
  const started=performance.now();

  updateLiveDataProviderState(feedId,{
    status:adapter.configured?'Refreshing':'Not configured',
    lastAttemptAt:new Date().toISOString(),
    error:''
  });

  if(!adapter.configured){
    const message=`${feedId} provider is not configured.`;
    updateLiveDataProviderState(feedId,{
      status:'Not configured',
      duration:performance.now()-started,
      error:message
    });
    liveDataRecord('skip',`${feedId} refresh skipped`,message);
    return {ok:false,skipped:true,records:0,error:message};
  }

  try{
    const payload=await adapter.fetch({
      feed:feedId,
      currentGames:games,
      favorites,
      settings,
      device:crossDeviceState
    });
    const normalized=normalizeLiveData(feedId,payload);
    const count=applyLiveDataFeed(feedId,normalized);
    const duration=performance.now()-started;

    updateLiveDataProviderState(feedId,{
      status:'Healthy',
      lastSuccessAt:new Date().toISOString(),
      duration,
      records:count,
      error:''
    });
    liveDataRecord('success',`${feedId} refresh completed`,`${count} normalized records · ${duration.toFixed(0)} ms`);
    return {ok:true,records:count,duration};
  }catch(error){
    const duration=performance.now()-started;
    const message=error?.message||String(error);
    liveDataPlatformState.errorCount+=1;
    updateLiveDataProviderState(feedId,{
      status:'Error',
      duration,
      error:message
    });
    liveDataRecord('error',`${feedId} refresh failed`,message);
    return {ok:false,records:0,duration,error:message};
  }
}

async function runLiveDataCycle(feedIds=LIVE_DATA_FEEDS.map(feed=>feed.id)){
  if(liveDataCycleInFlight)return false;
  liveDataCycleInFlight=true;
  liveDataPlatformState.lastCycleAt=new Date().toISOString();
  liveDataPlatformState.cycleCount+=1;
  saveLiveDataPlatformState();

  try{
    const results=[];
    for(const feedId of feedIds){
      results.push(await refreshLiveDataFeed(feedId));
    }
    const successful=results.filter(result=>result.ok).length;
    if(successful){
      liveDataPlatformState.lastSuccessfulCycleAt=new Date().toISOString();
    }
    saveLiveDataPlatformState();
    if(currentPage==='platform')renderPage();
    return results;
  }finally{
    liveDataCycleInFlight=false;
  }
}

function liveDataAutoRefreshInterval(){
  const configured=LIVE_DATA_FEEDS
    .map(feed=>({feed,adapter:liveDataAdapter(feed.id)}))
    .filter(item=>item.adapter.configured);
  if(!configured.length)return 300000;
  return Math.max(60000,Math.min(...configured.map(item=>
    Number(item.adapter.intervalSeconds||item.feed.defaultInterval)*1000
  )));
}

function startLiveDataScheduler(){
  clearInterval(liveDataCycleTimer);
  if(!liveDataPlatformState.autoRefresh||liveDataPlatformState.paused)return;

  liveDataCycleTimer=setInterval(()=>{
    if(!document.hidden&&navigator.onLine){
      runLiveDataCycle();
    }
  },liveDataAutoRefreshInterval());
}

function liveDataOverallStatus(){
  const states=LIVE_DATA_FEEDS.map(feed=>liveDataProviderState(feed.id));
  const configured=LIVE_DATA_FEEDS.filter(feed=>liveDataAdapter(feed.id).configured).length;
  const errors=states.filter(state=>state.status==='Error').length;
  const refreshing=states.filter(state=>state.status==='Refreshing').length;

  if(liveDataPlatformState.paused)return 'Paused';
  if(refreshing)return 'Refreshing';
  if(errors)return 'Degraded';
  if(configured)return 'Ready';
  return 'Not configured';
}

function liveDataFeedRow(feed){
  const adapter=liveDataAdapter(feed.id);
  const state=liveDataProviderState(feed.id);
  return `<div class="intel-row">
    <span class="intel-icon">${state.status==='Healthy'?'✓':state.status==='Error'?'×':adapter.configured?'•':'○'}</span>
    <div>
      <strong>${esc(feed.label)}</strong>
      <small>${esc(adapter.name||'Not connected')} · ${esc(state.status)}${state.records?` · ${state.records} records`:''}${state.duration?` · ${state.duration.toFixed(0)} ms`:''}</small>
      ${state.error?`<small>${esc(state.error)}</small>`:''}
    </div>
    <div class="button-row">
      <span class="provider-badge">${adapter.licensed?'LICENSED':adapter.configured?'CONFIGURED':'OFFLINE'}</span>
      <button class="button" data-platform-refresh="${feed.id}" ${adapter.configured?'':'disabled'}>Refresh</button>
    </div>
  </div>`;
}

function liveDataActivityRow(item){
  return `<div class="intel-row">
    <span class="intel-icon">${item.type==='success'?'✓':item.type==='error'?'×':'•'}</span>
    <div>
      <strong>${esc(item.message)}</strong>
      <small>${new Date(item.time).toLocaleString()}${item.detail?` · ${esc(item.detail)}`:''}</small>
    </div>
    <span class="provider-badge">${esc(item.type.toUpperCase())}</span>
  </div>`;
}

function liveDataPlatformPage(){
  setHeading('Live Data Platform','PROVIDERS · NORMALIZATION · REFRESH');
  const registry=liveDataProviderRegistry();
  const configured=LIVE_DATA_FEEDS.filter(feed=>liveDataAdapter(feed.id).configured).length;
  const healthy=LIVE_DATA_FEEDS.filter(feed=>liveDataProviderState(feed.id).status==='Healthy').length;
  const errors=LIVE_DATA_FEEDS.filter(feed=>liveDataProviderState(feed.id).status==='Error').length;
  const totalRecords=LIVE_DATA_FEEDS.reduce((sum,feed)=>sum+(liveDataProviderState(feed.id).records||0),0);

  return `<section class="intel-hero">
    <div>
      <p class="eyebrow">ONLYBEATS LIVE DATA PLATFORM</p>
      <h2>Provider status: ${esc(liveDataOverallStatus())}.</h2>
      <p>Connect approved data providers, normalize their records, control refresh cycles, and keep unavailable feeds clearly marked instead of showing invented data.</p>
    </div>
    <div class="button-row">
      <button class="button primary" id="platformRefreshAll" ${configured?'':'disabled'}>${liveDataCycleInFlight?'Refreshing feeds…':'Refresh all feeds'}</button>
      <button class="button" id="platformPause">${liveDataPlatformState.paused?'Resume':'Pause'} scheduler</button>
      <button class="button" id="platformClearActivity">Clear activity</button>
    </div>
  </section>

  <div class="metric-grid">
    ${metric('Overall Status',liveDataOverallStatus(),navigator.onLine?'Network online':'Network offline')}
    ${metric('Configured Feeds',configured,`${LIVE_DATA_FEEDS.length} supported feed types`)}
    ${metric('Healthy Feeds',healthy,'Most recent result')}
    ${metric('Feed Errors',errors,`${liveDataPlatformState.errorCount} total errors`)}
    ${metric('Normalized Records',totalRecords,'Most recent feed results')}
    ${metric('Auto Refresh',liveDataPlatformState.autoRefresh&&!liveDataPlatformState.paused?'On':'Off',`${Math.round(liveDataAutoRefreshInterval()/1000)} second scheduler`)}
  </div>

  <div class="reports-grid">
    ${card('Provider Registry',`<div class="intel-list">${LIVE_DATA_FEEDS.map(liveDataFeedRow).join('')}</div>`,'wide')}

    ${card('Platform Controls',`<div class="detail-list">
      <label class="toggle-row"><span>Automatic refresh</span><input type="checkbox" id="platformAutoRefresh" ${liveDataPlatformState.autoRefresh?'checked':''}></label>
      <div><span>Last cycle</span><strong>${liveDataPlatformState.lastCycleAt?new Date(liveDataPlatformState.lastCycleAt).toLocaleString():'Never'}</strong></div>
      <div><span>Last successful cycle</span><strong>${liveDataPlatformState.lastSuccessfulCycleAt?new Date(liveDataPlatformState.lastSuccessfulCycleAt).toLocaleString():'Never'}</strong></div>
      <div><span>Completed cycles</span><strong>${liveDataPlatformState.cycleCount}</strong></div>
      <div><span>Registered adapters</span><strong>${Object.keys(registry).length}</strong></div>
      <div><span>Scheduler state</span><strong>${liveDataPlatformState.paused?'Paused':'Running'}</strong></div>
    </div>`)}

    ${card('Data Integrity Rules',`<div class="intel-list">
      <div class="intel-row"><span class="intel-icon">1</span><div><strong>No invented records</strong><small>Disconnected feeds remain visibly unavailable.</small></div></div>
      <div class="intel-row"><span class="intel-icon">2</span><div><strong>Normalize before use</strong><small>Provider payloads must pass the OnlyBeats schema.</small></div></div>
      <div class="intel-row"><span class="intel-icon">3</span><div><strong>Manual notes are preserved</strong><small>Provider availability data does not erase user-created notes.</small></div></div>
      <div class="intel-row"><span class="intel-icon">4</span><div><strong>Licensed data is labeled</strong><small>Commercial feeds must declare licensed status.</small></div></div>
    </div>`)}

    ${card('Provider Activity',liveDataPlatformActivity.length?`<div class="intel-list">${liveDataPlatformActivity.slice().reverse().slice(0,120).map(liveDataActivityRow).join('')}</div>`:empty('No platform activity','Configure a provider and refresh a feed to begin activity tracking.'),'wide')}

    ${card('Connection Template',`<div class="detail-list">
      <div><span>Configuration file</span><strong>live-data-providers.js</strong></div>
      <div><span>Example file</span><strong>live-data-providers.example.js</strong></div>
      <div><span>Adapter method</span><strong>async fetch(context)</strong></div>
      <div><span>Required declaration</span><strong>configured: true</strong></div>
      <div><span>Licensed feed declaration</span><strong>licensed: true</strong></div>
    </div>`,'wide')}
  </div>`;
}

function bindLiveDataPlatform(){
  document.querySelectorAll('[data-platform-refresh]').forEach(button=>{
    button.onclick=async()=>{
      button.disabled=true;
      button.textContent='Refreshing…';
      await runLiveDataCycle([button.dataset.platformRefresh]);
      renderPage();
    };
  });

  if($('platformRefreshAll'))$('platformRefreshAll').onclick=async()=>{
    await runLiveDataCycle();
    renderPage();
  };

  if($('platformPause'))$('platformPause').onclick=()=>{
    liveDataPlatformState.paused=!liveDataPlatformState.paused;
    saveLiveDataPlatformState();
    startLiveDataScheduler();
    renderPage();
    toast(`Live data scheduler ${liveDataPlatformState.paused?'paused':'resumed'}`);
  };

  if($('platformAutoRefresh'))$('platformAutoRefresh').onchange=event=>{
    liveDataPlatformState.autoRefresh=event.target.checked;
    saveLiveDataPlatformState();
    startLiveDataScheduler();
    toast(`Automatic refresh ${liveDataPlatformState.autoRefresh?'enabled':'disabled'}`);
  };

  if($('platformClearActivity'))$('platformClearActivity').onclick=()=>{
    liveDataPlatformActivity=[];
    saveLiveDataPlatformState();
    renderPage();
    toast('Live data activity cleared');
  };
}

function initializeLiveDataPlatform(){
  loadLiveDataPlatformState();
  startLiveDataScheduler();
  window.addEventListener('online',()=>{
    liveDataRecord('network','Network restored');
    if(liveDataPlatformState.autoRefresh&&!liveDataPlatformState.paused){
      runLiveDataCycle();
    }
  });
  window.addEventListener('offline',()=>liveDataRecord('network','Network offline'));
}
