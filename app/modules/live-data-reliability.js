'use strict';

const REFRESH_HISTORY_LIMIT=250;
let dataHealthFilter='all';

function saveRefreshHistory(){
  localStorage.setItem(REFRESH_HISTORY_KEY,JSON.stringify(refreshHistory.slice(-REFRESH_HISTORY_LIMIT)));
}

function recordRefreshAttempt(source,status,extra={}){
  refreshHistory.push({
    id:`${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
    time:new Date().toISOString(),
    source:String(source||'unknown'),
    status:String(status||'unknown'),
    duration:Number(extra.duration||0),
    games:Number(extra.games||0),
    error:String(extra.error||'')
  });
  if(refreshHistory.length>REFRESH_HISTORY_LIMIT)refreshHistory=refreshHistory.slice(-REFRESH_HISTORY_LIMIT);
  saveRefreshHistory();
}

function dataAgeMinutes(){
  return lastSync?Math.max(0,(Date.now()-lastSync.getTime())/60000):null;
}

function dataFreshnessState(){
  const age=dataAgeMinutes();
  if(age===null)return {level:'unknown',label:'Not refreshed',detail:'No successful score refresh this session'};
  if(age<=2)return {level:'fresh',label:'Fresh',detail:`Updated ${age.toFixed(1)} minutes ago`};
  if(age<=10)return {level:'aging',label:'Aging',detail:`Updated ${age.toFixed(1)} minutes ago`};
  return {level:'stale',label:'Stale',detail:`Updated ${age.toFixed(1)} minutes ago`};
}

function refreshSuccessRate(){
  const completed=refreshHistory.filter(row=>['success','failure'].includes(row.status));
  const success=completed.filter(row=>row.status==='success').length;
  return {total:completed.length,success,failure:completed.length-success,rate:completed.length?success/completed.length*100:0};
}

function recentRefreshRows(){
  const rows=[...refreshHistory].sort((a,b)=>new Date(b.time)-new Date(a.time));
  return dataHealthFilter==='all'?rows:rows.filter(row=>row.status===dataHealthFilter);
}

function providerHealthSummary(){
  const freshness=dataFreshnessState();
  const rate=refreshSuccessRate();
  let overall='Healthy';
  if(!navigator.onLine)overall='Offline';
  else if(syncError)overall='Degraded';
  else if(freshness.level==='stale')overall='Stale';
  else if(rate.total>=3&&rate.rate<60)overall='Unstable';
  return {overall,freshness,rate,online:navigator.onLine,cached:Boolean(syncError&&games.length),active:loading};
}

function refreshHistoryRow(row){
  const icon=row.status==='success'?'✓':row.status==='failure'?'×':'•';
  return `<div class="intel-row">
    <span class="intel-icon">${icon}</span>
    <div><strong>${esc(row.source)} · ${esc(row.status)}</strong><small>${new Date(row.time).toLocaleString()}${row.duration?` · ${row.duration.toFixed(0)} ms`:''}${row.games?` · ${row.games} games`:''}${row.error?` · ${esc(row.error)}`:''}</small></div>
    <span class="provider-badge">${esc(row.status.toUpperCase())}</span>
  </div>`;
}

function liveDataHealthPage(){
  setHeading('Data Health','FRESHNESS · PROVIDER · RECOVERY');
  const health=providerHealthSummary();
  const rows=recentRefreshRows();
  const successful=[...refreshHistory].reverse().find(row=>row.status==='success');
  const failed=[...refreshHistory].reverse().find(row=>row.status==='failure');

  return `<section class="intel-hero">
    <div><p class="eyebrow">LIVE DATA RELIABILITY</p><h2>Provider status: ${esc(health.overall)}.</h2><p>Review data freshness, refresh success rate, cache availability, recent failures, and recovery state.</p></div>
    <div class="button-row"><button class="button primary" id="dataHealthRefresh">${loading?'Refreshing provider…':'Refresh provider now'}</button><button class="button" id="exportRefreshHistory">Export history</button><button class="button" id="clearRefreshHistory">Clear history</button></div>
  </section>
  <div class="metric-grid">
    ${metric('Overall Status',health.overall,health.online?'Network available':'Network offline')}
    ${metric('Data Freshness',health.freshness.label,health.freshness.detail)}
    ${metric('Success Rate',`${health.rate.rate.toFixed(1)}%`,`${health.rate.success}/${health.rate.total} completed refreshes`)}
    ${metric('Cached Games',games.length,health.cached?'Fallback active':'Live or ready')}
    ${metric('Last Success',successful?new Date(successful.time).toLocaleTimeString():'—',successful?`${successful.games} games`:'No successful history')}
    ${metric('Last Failure',failed?new Date(failed.time).toLocaleTimeString():'—',failed?failed.error||'Refresh failed':'No recorded failures')}
  </div>
  ${health.freshness.level==='stale'?`<div class="provider-notice"><div><strong>Score data may be stale</strong><p class="muted">${esc(health.freshness.detail)}. Refresh before relying on live status.</p></div><button class="button primary" id="dataHealthRefreshSecondary">Refresh now</button></div>`:''}
  <div class="reports-grid">
    ${card('Provider State',`<div class="detail-list"><div><span>Browser online</span><strong>${health.online?'Yes':'No'}</strong></div><div><span>Refresh active</span><strong>${health.active?'Yes':'No'}</strong></div><div><span>Cached fallback</span><strong>${health.cached?'Active':'Not active'}</strong></div><div><span>Last sync</span><strong>${lastSync?lastSync.toLocaleString():'Not yet'}</strong></div><div><span>Current provider error</span><strong>${esc(syncError||'None')}</strong></div><div><span>History retained</span><strong>${refreshHistory.length}/${REFRESH_HISTORY_LIMIT}</strong></div></div>`)}
    ${card('Recovery Guidance',`<div class="intel-list"><div class="intel-row"><span class="intel-icon">1</span><div><strong>Retry once</strong><small>Use Refresh Provider Now to test the live feed.</small></div></div><div class="intel-row"><span class="intel-icon">2</span><div><strong>Use cached data</strong><small>OnlyBeats keeps the latest successful scoreboard available.</small></div></div><div class="intel-row"><span class="intel-icon">3</span><div><strong>Check diagnostics</strong><small>Open Developer Tools if failures continue.</small></div><button class="button" data-page-jump="developer">Open</button></div></div>`)}
    ${card('Refresh History',`<div class="wall-status-tabs">${[['all','All'],['success','Success'],['failure','Failures'],['started','Started']].map(([id,label])=>`<button class="filter-button ${dataHealthFilter===id?'active':''}" data-datahealth-filter="${id}">${label}</button>`).join('')}</div>${rows.length?`<div class="intel-list">${rows.slice(0,100).map(refreshHistoryRow).join('')}</div>`:empty('No refresh history','Run a provider refresh to begin recording history.')}`,'wide')}
  </div>`;
}

function exportRefreshHistory(){
  const payload={generatedAt:new Date().toISOString(),version:VERSION,provider:providerHealthSummary(),history:[...refreshHistory].sort((a,b)=>new Date(a.time)-new Date(b.time))};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=`onlybeats-refresh-history-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);
}

async function runDataHealthRefresh(button){
  button.disabled=true;button.textContent='Refreshing provider…';
  try{await syncScores(false);renderPage()}
  finally{
    const active=$('dataHealthRefresh')||$('dataHealthRefreshSecondary');
    if(active){active.disabled=false;active.textContent=active.id==='dataHealthRefresh'?'Refresh provider now':'Refresh now'}
  }
}

function bindLiveDataHealth(){
  document.querySelectorAll('[data-datahealth-filter]').forEach(button=>button.onclick=()=>{dataHealthFilter=button.dataset.datahealthFilter;renderPage()});
  if($('dataHealthRefresh'))$('dataHealthRefresh').onclick=()=>runDataHealthRefresh($('dataHealthRefresh'));
  if($('dataHealthRefreshSecondary'))$('dataHealthRefreshSecondary').onclick=()=>runDataHealthRefresh($('dataHealthRefreshSecondary'));
  if($('exportRefreshHistory'))$('exportRefreshHistory').onclick=exportRefreshHistory;
  if($('clearRefreshHistory'))$('clearRefreshHistory').onclick=()=>{if(confirm('Clear all local refresh history?')){refreshHistory=[];saveRefreshHistory();renderPage();toast('Refresh history cleared')}};
}
