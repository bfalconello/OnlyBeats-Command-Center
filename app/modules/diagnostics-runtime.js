'use strict';

// v0.13.2 Runtime diagnostics and lightweight smoke testing.

const ONLYBEATS_RUNTIME_LOG_KEY='onlybeats.runtime.log.v1';
let onlyBeatsDiagnostics={
  time:new Date().toISOString(),
  checks:[],
  storageAvailable:true
};

function getOnlyBeatsRuntimeLog(){
  try{
    const parsed=JSON.parse(sessionStorage.getItem(ONLYBEATS_RUNTIME_LOG_KEY)||'[]');
    return Array.isArray(parsed)?parsed:[];
  }catch{
    return [];
  }
}

function writeOnlyBeatsRuntimeLog(level,message,context='app',extra=''){
  const rows=getOnlyBeatsRuntimeLog();
  rows.push({
    time:new Date().toISOString(),
    level,
    message:String(message||'Unknown event'),
    context:String(context||'app'),
    extra:String(extra||'')
  });
  sessionStorage.setItem(ONLYBEATS_RUNTIME_LOG_KEY,JSON.stringify(rows.slice(-200)));
}

function clearOnlyBeatsRuntimeLog(){
  sessionStorage.removeItem(ONLYBEATS_RUNTIME_LOG_KEY);
}

window.addEventListener('error',event=>{
  writeOnlyBeatsRuntimeLog(
    'error',
    event.message||'Unhandled runtime error',
    currentPage||'unknown page',
    event.error?.stack||''
  );
});

window.addEventListener('unhandledrejection',event=>{
  const reason=event.reason;
  writeOnlyBeatsRuntimeLog(
    'error',
    reason?.message||String(reason||'Unhandled promise rejection'),
    currentPage||'unknown page',
    reason?.stack||''
  );
});

function diagnosticCheck(name,ok,detail=''){
  return {name,ok:Boolean(ok),detail:String(detail||'')};
}

function storageIsAvailable(){
  try{
    const key='__onlybeats_diagnostic__';
    localStorage.setItem(key,'1');
    localStorage.removeItem(key);
    return true;
  }catch{
    return false;
  }
}

function runOnlyBeatsDiagnostics(){
  const checks=[
    diagnosticCheck('Application version',typeof VERSION==='string'&&VERSION.length>0,typeof VERSION==='string'?VERSION:'Missing'),
    diagnosticCheck('Navigation loaded',typeof navigate==='function','navigate()'),
    diagnosticCheck('Refresh controls loaded',typeof refreshActionFor==='function','refreshActionFor()'),
    diagnosticCheck('Prediction pick helper loaded',typeof refreshPredictionPickOptions==='function','refreshPredictionPickOptions()'),
    diagnosticCheck('Prediction page loaded',typeof predictionsPage==='function','predictionsPage()'),
    diagnosticCheck('Schedule Center loaded',typeof schedulePage==='function','schedulePage()'),
    diagnosticCheck('Team Intelligence loaded',typeof teamHubPage==='function','teamHubPage()'),
    diagnosticCheck('Live Game Focus loaded',typeof openFocus==='function','openFocus()'),
    diagnosticCheck('Watch Center loaded',typeof watchCenterPage==='function','watchCenterPage()'),
    diagnosticCheck('Intelligence Engine loaded',typeof intelligenceEnginePage==='function','intelligenceEnginePage()'),
    diagnosticCheck('Smart Briefing loaded',typeof smartBriefingPage==='function','smartBriefingPage()'),
    diagnosticCheck('Reports loaded',typeof reportsPage==='function','reportsPage()'),
    diagnosticCheck('Score collection valid',Array.isArray(games),`${Array.isArray(games)?games.length:0} games`),
    diagnosticCheck('Prediction collection valid',Array.isArray(predictions),`${Array.isArray(predictions)?predictions.length:0} predictions`),
    diagnosticCheck('Future collection valid',Array.isArray(futures),`${Array.isArray(futures)?futures.length:0} futures`),
    diagnosticCheck('Availability collection valid',Array.isArray(availabilityEntries),`${Array.isArray(availabilityEntries)?availabilityEntries.length:0} notes`),
    diagnosticCheck('Local storage available',storageIsAvailable(),'Read/write test'),
    diagnosticCheck('Content mount exists',Boolean(document.getElementById('content')),'#content')
  ];

  onlyBeatsDiagnostics={
    time:new Date().toISOString(),
    checks,
    storageAvailable:storageIsAvailable()
  };

  const failures=checks.filter(check=>!check.ok);
  writeOnlyBeatsRuntimeLog(
    failures.length?'warn':'info',
    failures.length?`${failures.length} diagnostic checks failed`:'All diagnostic checks passed',
    'diagnostics'
  );

  return onlyBeatsDiagnostics;
}

function getOnlyBeatsDiagnostics(){
  return onlyBeatsDiagnostics?.checks?.length?onlyBeatsDiagnostics:runOnlyBeatsDiagnostics();
}

async function runOnlyBeatsPageSmokeTests(){
  const routes=['dashboard','briefing','wall','watch','schedule','teams','rankings','news','weather','availability','predictions','reports','developer','settings'];
  const original=currentPage;
  const results=[];

  for(const route of routes){
    try{
      currentPage=route;
      const html=renderCurrentPage();
      const ok=typeof html==='string'&&html.length>0;
      results.push(diagnosticCheck(`Page: ${route}`,ok,ok?'Rendered HTML':'No HTML returned'));
    }catch(error){
      results.push(diagnosticCheck(`Page: ${route}`,false,error?.message||'Render failed'));
      writeOnlyBeatsRuntimeLog('error',error?.message||'Page smoke test failed',route,error?.stack||'');
    }
    await Promise.resolve();
  }

  currentPage=original;
  onlyBeatsDiagnostics={
    ...getOnlyBeatsDiagnostics(),
    time:new Date().toISOString(),
    checks:[...runOnlyBeatsDiagnostics().checks,...results],
    storageAvailable:storageIsAvailable()
  };

  return results;
}

function downloadDiagnosticFile(name,text){
  const blob=new Blob([text],{type:'application/json;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;
  anchor.download=name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function exportOnlyBeatsDiagnostics(){
  const payload={
    generatedAt:new Date().toISOString(),
    version:typeof VERSION==='string'?VERSION:'unknown',
    page:typeof currentPage==='string'?currentPage:'unknown',
    diagnostics:getOnlyBeatsDiagnostics(),
    runtimeLog:getOnlyBeatsRuntimeLog(),
    provider:{
      loading:Boolean(loading),
      syncError:String(syncError||''),
      lastSync:lastSync?lastSync.toISOString():null,
      games:Array.isArray(games)?games.length:0,
      predictions:Array.isArray(predictions)?predictions.length:0,
      futures:Array.isArray(futures)?futures.length:0,
      availability:Array.isArray(availabilityEntries)?availabilityEntries.length:0
    },
    environment:{
      userAgent:navigator.userAgent,
      online:navigator.onLine,
      language:navigator.language
    }
  };

  downloadDiagnosticFile(
    `onlybeats-diagnostics-${new Date().toISOString().replace(/[:.]/g,'-')}.json`,
    JSON.stringify(payload,null,2)
  );
  writeOnlyBeatsRuntimeLog('info','Diagnostics exported','developer');
}
